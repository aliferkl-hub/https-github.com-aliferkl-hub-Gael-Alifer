import React, { useState } from 'react';
import { EmployeeProfile, PermissionKey, UserStatus, UserRole, PartnerCompany, Branch } from '../../types/index.ts';
import { UserCheck, Plus, Shield, ShieldOff, Edit3, Trash2, CheckSquare, Square, AlertCircle, Building2, GitBranch } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';
import { formatBrDate } from '../../lib/date.ts';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface EmployeesViewProps {
  employees: EmployeeProfile[];
  companies?: PartnerCompany[];
  branches?: Branch[];
  onRefresh: () => void;
}

const AVAILABLE_PERMISSIONS: { key: PermissionKey; label: string; desc: string }[] = [
  { key: 'consultar_clientes', label: 'Consultar Clientes', desc: 'Visualizar ficha de clientes e mensalistas' },
  { key: 'cadastrar_clientes', label: 'Cadastrar Clientes', desc: 'Inserir novos registros de clientes' },
  { key: 'editar_clientes', label: 'Editar Clientes', desc: 'Atualizar endereços, telefones e dados cadastrais' },
  { key: 'consultar_contratos', label: 'Consultar Contratos', desc: 'Visualizar contratos emitidos e cláusulas' },
  { key: 'emitir_contratos', label: 'Emitir Contratos', desc: 'Gerar e emitir novos contratos para clientes' },
  { key: 'consultar_cobrancas', label: 'Consultar Cobranças', desc: 'Visualizar faturas e vencimentos' },
  { key: 'registrar_pagamentos', label: 'Registrar Pagamentos', desc: 'Dar baixa e confirmar recebimentos' },
  { key: 'consultar_relatorios', label: 'Consultar Relatórios', desc: 'Acessar relatórios gerenciais e dashboards' },
  { key: 'administrar_parceiros', label: 'Administrar Parceiros', desc: 'Cadastrar e editar afiliados' },
  { key: 'consultar_comissoes', label: 'Consultar Comissões', desc: 'Ver valores calculados e aprovar comissões' },
  { key: 'exportar_dados', label: 'Exportar Dados', desc: 'Baixar planilhas em CSV' },
  { key: 'gerenciar_empresas', label: 'Gerenciar Empresas', desc: 'Cadastrar e configurar empresas parceiras' },
  { key: 'gerenciar_filiais', label: 'Gerenciar Filiais', desc: 'Cadastrar e gerenciar filiais e unidades operacionais' },
  { key: 'transferir_registros', label: 'Transferir Registros', desc: 'Transferir clientes e contratos entre filiais' },
];

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees,
  companies = [],
  branches = [],
  onRefresh,
}) => {
  const { isMasterOwner, currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeProfile | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Atendente Comercial');
  const [userRoleType, setUserRoleType] = useState<UserRole>('EMPLOYEE');
  const [companyId, setCompanyId] = useState<string>('company-matriz-01');
  const [branchId, setBranchId] = useState<string>('branch-matriz-01');
  const [status, setStatus] = useState<UserStatus>('ativo');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([
    'consultar_clientes',
    'cadastrar_clientes',
    'consultar_contratos',
    'consultar_cobrancas',
  ]);

  if (!isMasterOwner) {
    return (
      <div className="p-8 text-center bg-[#0b1222] border border-rose-500/30 rounded-2xl">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-base font-bold text-white">Acesso Restrito ao Master Owner</h3>
        <p className="text-xs text-slate-400 mt-1">
          Somente o proprietário mestre pode gerenciar a equipe de funcionários e atribuir permissões.
        </p>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setName('');
    setEmail('');
    setPhone('+55 ');
    setRole('Atendente Comercial');
    setUserRoleType('EMPLOYEE');
    setCompanyId(companies[0]?.id || 'company-matriz-01');
    setBranchId(branches[0]?.id || 'branch-matriz-01');
    setStatus('ativo');
    setSelectedPermissions([
      'consultar_clientes',
      'cadastrar_clientes',
      'consultar_contratos',
      'consultar_cobrancas',
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: EmployeeProfile) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone || '');
    setRole(emp.role);
    setUserRoleType(emp.userRoleType || 'EMPLOYEE');
    setCompanyId(emp.companyId || companies[0]?.id || 'company-matriz-01');
    setBranchId(emp.branchId || '');
    setStatus(emp.status);
    setSelectedPermissions(emp.permissions || []);
    setIsModalOpen(true);
  };

  const togglePermission = (key: PermissionKey) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      alert('Nome e E-mail são obrigatórios.');
      return;
    }

    const employee: EmployeeProfile = {
      id: editingEmployee ? editingEmployee.id : `emp-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: role.trim(),
      userRoleType,
      companyId,
      branchId,
      status,
      permissions: selectedPermissions,
      createdAt: editingEmployee ? editingEmployee.createdAt : new Date().toISOString(),
      createdBy: currentUser?.email || 'master',
    };

    await DatabaseService.saveEmployee(employee, currentUser?.email || 'master');
    setIsModalOpen(false);
    onRefresh();
  };

  const handleToggleStatus = async (emp: EmployeeProfile) => {
    const newStatus: UserStatus = emp.status === 'ativo' ? 'inativo' : 'ativo';
    const updated: EmployeeProfile = { ...emp, status: newStatus };
    await DatabaseService.saveEmployee(updated, currentUser?.email || 'master');
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deletingEmployee) return;
    await DatabaseService.deleteEmployee(deletingEmployee.id, currentUser?.email || 'master');
    setDeletingEmployee(null);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Funcionários & Controle de Permissões (RBAC)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerenciamento exclusivo do Master Owner. Configure acessos específicos e bloqueie colaboradores desligados.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Funcionário</span>
        </button>
      </div>

      {/* Grid of Employees */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.length === 0 ? (
          <div className="col-span-3 p-8 text-center bg-[#0b1222] border border-cyan-500/20 rounded-2xl">
            <p className="text-sm font-semibold text-white">Nenhum funcionário cadastrado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre operadores e atendentes para delegar tarefas com permissões restritas.
            </p>
          </div>
        ) : (
          employees.map(emp => (
            <div
              key={emp.id}
              className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-800 text-slate-300">
                    {emp.role}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      emp.status === 'ativo'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {emp.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-0.5">{emp.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{emp.email}</p>

                {/* Company & Branch Linkage Badge */}
                <div className="flex flex-col gap-1 mb-3 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>
                      {companies.find(c => c.id === emp.companyId)?.tradeName || 'Matriz Principal'}
                    </span>
                  </div>
                  {emp.branchId && (
                    <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>
                        {branches.find(b => b.id === emp.branchId)?.name || 'Filial Designada'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1 text-xs text-slate-300 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Perfil de Acesso:</span>
                    <span className="font-mono text-cyan-300 font-bold">{emp.userRoleType || 'PADRÃO'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Permissões ativas:</span>
                    <span className="font-bold text-cyan-400">{emp.permissions.length} módulos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Criado em:</span>
                    <span>{formatBrDate(emp.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleToggleStatus(emp)}
                  title={emp.status === 'ativo' ? 'Desativar acesso imediatamente' : 'Reativar acesso'}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 ${
                    emp.status === 'ativo'
                      ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                  }`}
                >
                  {emp.status === 'ativo' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                  <span>{emp.status === 'ativo' ? 'Bloquear' : 'Ativar'}</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(emp)}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setDeletingEmployee(emp)}
                  className="p-2 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Employee Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? `Editar Funcionário: ${editingEmployee.name}` : 'Cadastrar Novo Funcionário'}
        subtitle="Defina o perfil de acesso e selecione individualmente as permissões autorizadas"
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Colaborador <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Ana Paula Ribeiro"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                E-mail Corporativo/Acesso <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ana.ribeiro@empresa.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cargo / Função
              </label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Ex: Atendente Comercial"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação do Acesso
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as UserStatus)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo / Desligado</option>
              </select>
            </div>
          </div>

          {/* Multiempresa Role & Assignment */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Atribuição Multiempresa & Nível de Acesso
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Perfil do Sistema *</label>
                <select
                  value={userRoleType}
                  onChange={e => setUserRoleType(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="EMPLOYEE">Colaborador Geral</option>
                  <option value="EMPRESA_ADMIN">Administrador da Empresa</option>
                  <option value="GERENTE_FILIAL">Gerente de Filial</option>
                  <option value="COMERCIAL">Comercial / Vendas</option>
                  <option value="FINANCEIRO">Financeiro / Cobrança</option>
                  <option value="CONSULTA">Apenas Consulta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Empresa Vinculada *</label>
                <select
                  value={companyId}
                  onChange={e => {
                    const cId = e.target.value;
                    setCompanyId(cId);
                    const validB = branches.filter(b => b.companyId === cId);
                    setBranchId(validB[0]?.id || '');
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Filial de Atuação</label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Matriz Geral (Sem restrição de filial)</option>
                  {branches
                    .filter(b => !companyId || b.companyId === companyId)
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city}/{b.state})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Granular Checkboxes for Permissions */}
          <div>
            <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
              Permissões Granulares Concedidas ({selectedPermissions.length} selecionadas)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-slate-800">
              {AVAILABLE_PERMISSIONS.map(p => {
                const isSelected = selectedPermissions.includes(p.key);
                return (
                  <div
                    key={p.key}
                    onClick={() => togglePermission(p.key)}
                    className={`p-2 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{p.label}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
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
              Salvar Funcionário
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingEmployee)}
        onClose={() => setDeletingEmployee(null)}
        onConfirm={handleDelete}
        title="Remover Acesso do Funcionário"
        message={`Deseja realmente remover o colaborador ${deletingEmployee?.name}? Todas as permissões serão revogadas instantaneamente.`}
        confirmLabel="Sim, Remover"
        isDestructive
      />
    </div>
  );
};
