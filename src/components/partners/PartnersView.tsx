import React, { useState } from 'react';
import { Partner, CommissionRuleType, Customer } from '../../types/index.ts';
import { Handshake, Plus, Search, Edit2, Users, DollarSign, Check } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';
import { formatBRL, formatBrDate, getTodaySaoPaulo } from '../../lib/date.ts';

interface PartnersViewProps {
  partners: Partner[];
  customers: Customer[];
  onRefresh: () => void;
}

export const PartnersView: React.FC<PartnersViewProps> = ({ partners, customers, onRefresh }) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  const canManage = isMasterOwner || hasPermission('administrar_parceiros');

  const [formData, setFormData] = useState<Partial<Partner>>({
    name: '',
    docNumber: '',
    whatsapp: '',
    email: '',
    commissionRuleType: 'percentual',
    defaultCommissionRate: 10,
    defaultFixedAmount: 0,
    status: 'ativo',
    contactInfo: '',
    notes: '',
  });

  const handleOpenCreate = () => {
    setEditingPartner(null);
    setFormData({
      code: `PARC-${String(partners.length + 1).padStart(3, '0')}`,
      name: '',
      docNumber: '',
      whatsapp: '+55 ',
      email: '',
      commissionRuleType: 'percentual',
      defaultCommissionRate: 10,
      defaultFixedAmount: 0,
      status: 'ativo',
      contactInfo: '',
      notes: '',
      joinDate: getTodaySaoPaulo(),
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Partner) => {
    setEditingPartner(p);
    setFormData(p);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.docNumber) {
      alert('Nome e CPF/CNPJ são obrigatórios.');
      return;
    }

    const partner: Partner = {
      id: editingPartner ? editingPartner.id : `partner-${Date.now()}`,
      code: formData.code || `PARC-${Math.floor(100 + Math.random() * 900)}`,
      name: formData.name.trim(),
      docNumber: formData.docNumber.trim(),
      whatsapp: formData.whatsapp?.trim() || '',
      email: formData.email?.trim() || '',
      joinDate: formData.joinDate || getTodaySaoPaulo(),
      commissionRuleType: (formData.commissionRuleType as CommissionRuleType) || 'percentual',
      defaultCommissionRate: Number(formData.defaultCommissionRate || 10),
      defaultFixedAmount: Number(formData.defaultFixedAmount || 0),
      status: formData.status || 'ativo',
      contactInfo: formData.contactInfo || '',
      notes: formData.notes || '',
      createdAt: editingPartner ? editingPartner.createdAt : new Date().toISOString(),
    };

    await DatabaseService.savePartner(partner, currentUser?.email || 'sistema');
    setIsModalOpen(false);
    onRefresh();
  };

  const filteredPartners = partners.filter(p => {
    return (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.docNumber.includes(searchTerm)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Parceiros Comerciais & Afiliados
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastro de indicadores, regras de comissionamento e rastreio de clientes indicados.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Parceiro</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar parceiro por nome, código ou documento..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPartners.map(p => {
          const linkedClients = customers.filter(c => c.partnerId === p.id);
          return (
            <div
              key={p.id}
              className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                    {p.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      p.status === 'ativo'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{p.name}</h3>
                <p className="text-xs text-slate-400 font-mono mb-4">CNPJ/CPF: {p.docNumber}</p>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Regra de Comissão:</span>
                    <span className="font-bold text-cyan-300 capitalize">
                      {p.commissionRuleType === 'percentual'
                        ? `${p.defaultCommissionRate}% recorrente`
                        : p.commissionRuleType === 'fixo'
                        ? `${formatBRL(p.defaultFixedAmount)} fixo`
                        : `${p.defaultCommissionRate}% + ${formatBRL(p.defaultFixedAmount)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Clientes Indicados:</span>
                    <span className="font-bold text-white">{linkedClients.length} cadastrados</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">WhatsApp:</span>
                    <span className="font-mono text-emerald-400">{p.whatsapp}</span>
                  </div>
                </div>
              </div>

              {canManage && (
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Editar Parceiro</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Partner Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPartner ? `Editar Parceiro: ${editingPartner.name}` : 'Cadastrar Novo Parceiro Comercial'}
        subtitle="Regras de comissão e dados cadastrais"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Código Único
              </label>
              <input
                type="text"
                readOnly
                value={formData.code || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-cyan-300 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação
              </label>
              <select
                value={formData.status || 'ativo'}
                onChange={e => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome ou Razão Social <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Prime Telecomunicações"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                CPF ou CNPJ <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.docNumber || ''}
                onChange={e => setFormData({ ...formData, docNumber: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                WhatsApp de Contato
              </label>
              <input
                type="text"
                value={formData.whatsapp || ''}
                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+55 (11) 99999-9999"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Regra de Comissão
              </label>
              <select
                value={formData.commissionRuleType || 'percentual'}
                onChange={e => setFormData({ ...formData, commissionRuleType: e.target.value as CommissionRuleType })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="percentual">Percentual (%) sobre pagamento</option>
                <option value="fixo">Valor Fixo (R$) por adesão</option>
                <option value="misto">Misto (% + Fixo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Percentual (%) Padrão
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.defaultCommissionRate || 10}
                onChange={e => setFormData({ ...formData, defaultCommissionRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-md"
            >
              Salvar Parceiro
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
