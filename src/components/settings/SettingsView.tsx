import React, { useState } from 'react';
import { CompanySettings, WhatsAppApiSettings } from '../../types/index.ts';
import { Settings, Shield, KeyRound, Lock, Save, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService, DEFAULT_MASTER_EMAIL } from '../../lib/db.ts';

interface SettingsViewProps {
  settings: CompanySettings;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onRefresh }) => {
  const { isMasterOwner, currentUser, setupMasterOwnerPassword, toggleTwoFactor } = useAuth();
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Backup & Restore
  const handleExportBackup = async () => {
    const customers = await DatabaseService.getCustomers();
    const plans = await DatabaseService.getPlans();
    const contracts = await DatabaseService.getContracts();
    const invoices = await DatabaseService.getInvoices();
    const payments = await DatabaseService.getPayments();
    const partners = await DatabaseService.getPartners();
    const commissions = await DatabaseService.getCommissions();
    const employees = await DatabaseService.getEmployees();
    const auditLogs = await DatabaseService.getAuditLogs();

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      company: formData,
      customers,
      plans,
      contracts,
      invoices,
      payments,
      partners,
      commissions,
      employees,
      auditLogs,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_onnix_play_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    await DatabaseService.logAudit(
      currentUser?.email || 'master',
      'BACKUP_GERADO',
      'settings',
      'database',
      'Exportação completa de backup em formato JSON'
    );
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    try {
      await DatabaseService.saveSettings(formData, currentUser?.email || 'sistema');
      setSuccessMsg('Configurações da empresa salvas com sucesso!');
      onRefresh();
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar dados da empresa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword.length < 8) {
      setPassError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('As senhas não coincidem.');
      return;
    }

    const res = await setupMasterOwnerPassword(newPassword, securityAnswer);
    if (res.success) {
      setPassSuccess('Senha do Master Owner atualizada com sucesso com novo salt e hash PBKDF2!');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
    } else {
      setPassError(res.error || 'Erro ao alterar senha.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          Configurações Gerais & Segurança
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Dados da empresa para faturas e contratos, chaves PIX e credenciais de segurança do Master Owner.
        </p>
      </div>

      {/* Grid: Company Details + Master Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COMPANY INFORMATION */}
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              Dados Oficiais da Empresa (ONNIX PLAY)
            </h3>
            {successMsg && (
              <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                {successMsg}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chave PIX Padrão
                </label>
                <input
                  type="text"
                  value={formData.pixKey}
                  onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo da Chave PIX
                </label>
                <select
                  value={formData.pixKeyType}
                  onChange={e => setFormData({ ...formData, pixKeyType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="Email">E-mail</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Aleatoria">Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp de Suporte
                </label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail Oficial
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Endereço da Sede
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Dados da Empresa'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* MASTER OWNER SECURITY & 2FA */}
        <div className="space-y-6">
          <div className="bg-[#0b1222] border border-purple-500/20 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Segurança do Master Owner
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                {DEFAULT_MASTER_EMAIL}
              </span>
            </div>

            {passError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            {isMasterOwner ? (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <p className="text-xs text-slate-400">
                  Atualize a senha de acesso mestre. A nova senha substituirá o hash anterior com novas iterações criptográficas.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nova Senha Forte
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirme a Nova Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable2fa"
                      checked={Boolean(currentUser?.isTwoFactorEnabled)}
                      onChange={e => toggleTwoFactor(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="enable2fa" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Exigir 2FA no login do Master Owner
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Atualizar Senha
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                Apenas o usuário autenticado como Master Owner pode alterar as chaves mestras.
              </p>
            )}
          </div>

          {/* BACKUP & RESTORE BOX */}
          <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              Backup & Retenção de Dados
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Exporte uma cópia completa de segurança contendo clientes, contratos, faturas, pagamentos e trilha de auditoria em formato JSON legível e verificável.
            </p>

            <button
              onClick={handleExportBackup}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Gerar Arquivo de Backup Completo (JSON)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
