/**
 * Filiais (Branches) Management View (Multiempresa)
 * Allows managing branches, viewing branch metrics, and transferring customers/contracts between branches
 */

import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Building2,
  Plus,
  Search,
  Filter,
  ArrowRightLeft,
  MapPin,
  Phone,
  Mail,
  Users,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Edit2,
  CheckCircle2,
  Power,
  X,
  ExternalLink
} from 'lucide-react';
import { Branch, PartnerCompany, Customer, Contract, BranchStatus } from '../../types/index.ts';
import { DatabaseService } from '../../lib/db.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface BranchesViewProps {
  branches: Branch[];
  companies: PartnerCompany[];
  customers: Customer[];
  contracts: Contract[];
  onRefresh: () => Promise<void>;
  preselectedCompanyId?: string;
}

export const BranchesView: React.FC<BranchesViewProps> = ({
  branches,
  companies,
  customers,
  contracts,
  onRefresh,
  preselectedCompanyId,
}) => {
  const { currentUser, isMasterOwner, activeCompanyId } = useAuth();
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>(
    preselectedCompanyId || (activeCompanyId !== 'TODAS' ? activeCompanyId : 'TODAS')
  );
  const [statusFilter, setStatusFilter] = useState<'todos' | BranchStatus>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'customer' | 'contract'>('customer');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferDestBranchId, setTransferDestBranchId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    companyId: companies[0]?.id || '',
    name: '',
    cnpj: '',
    managerName: '',
    managerEmail: '',
    phone: '',
    email: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    status: 'ativa' as BranchStatus,
    notes: '',
  });

  // Effective visible branches based on RBAC & Company filter
  const visibleBranches = useMemo(() => {
    return branches.filter(b => {
      // Role enforcement
      if (currentUser?.role === 'EMPRESA_ADMIN' && currentUser.companyId) {
        if (b.companyId !== currentUser.companyId) return false;
      } else if (currentUser?.role === 'GERENTE_FILIAL' && currentUser.branchId) {
        if (b.id !== currentUser.branchId) return false;
      }

      // Company dropdown filter
      if (selectedCompanyFilter !== 'TODAS' && b.companyId !== selectedCompanyFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'todos' && b.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          b.name.toLowerCase().includes(term) ||
          b.code.toLowerCase().includes(term) ||
          b.city.toLowerCase().includes(term) ||
          b.managerName.toLowerCase().includes(term) ||
          (b.cnpj && b.cnpj.includes(term))
        );
      }

      return true;
    });
  }, [branches, currentUser, selectedCompanyFilter, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = visibleBranches.length;
    const ativas = visibleBranches.filter(b => b.status === 'ativa').length;
    const suspensas = visibleBranches.filter(b => b.status === 'suspensa').length;
    const totalClientsLinked = customers.filter(c => visibleBranches.some(b => b.id === c.branchId)).length;
    return { total, ativas, suspensas, totalClientsLinked };
  }, [visibleBranches, customers]);

  const openNewBranchModal = () => {
    setEditingBranch(null);
    const defaultCompId = selectedCompanyFilter !== 'TODAS' ? selectedCompanyFilter : companies[0]?.id || '';
    const nextNum = branches.length + 1;
    const nextCode = `FIL-${String(nextNum).padStart(3, '0')}`;
    setFormData({
      code: nextCode,
      companyId: defaultCompId,
      name: '',
      cnpj: '',
      managerName: '',
      managerEmail: '',
      phone: '',
      email: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: 'SP',
      status: 'ativa',
      notes: '',
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      companyId: branch.companyId,
      name: branch.name,
      cnpj: branch.cnpj || '',
      managerName: branch.managerName,
      managerEmail: branch.managerEmail,
      phone: branch.phone,
      email: branch.email,
      cep: branch.cep || '',
      street: branch.street || '',
      number: branch.number || '',
      complement: branch.complement || '',
      neighborhood: branch.neighborhood || '',
      city: branch.city || '',
      state: branch.state || 'SP',
      status: branch.status,
      notes: branch.notes || '',
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('O Nome da Filial / Unidade é obrigatório.');
      return;
    }
    if (!formData.companyId) {
      setErrorMsg('Selecione a Empresa Matriz vinculada.');
      return;
    }

    // Check branch quota for the parent company
    const parentComp = companies.find(c => c.id === formData.companyId);
    if (!editingBranch && parentComp) {
      const currentBranchCount = branches.filter(b => b.companyId === parentComp.id).length;
      if (currentBranchCount >= parentComp.branchesLimit) {
        setErrorMsg(
          `Limite de filiais atingido para a empresa ${parentComp.tradeName} (Máx: ${parentComp.branchesLimit}). Aumente o plano nas configurações da empresa.`
        );
        return;
      }
    }

    setSaving(true);
    setErrorMsg('');
    try {
      if (editingBranch) {
        await DatabaseService.updateBranch(
          editingBranch.id,
          {
            ...formData,
            updatedAt: new Date().toISOString(),
          },
          currentUser?.email || 'master@onnix.com'
        );
        setSuccessMsg(`Filial "${formData.name}" atualizada com sucesso!`);
      } else {
        await DatabaseService.createBranch(
          formData,
          currentUser?.email || 'master@onnix.com'
        );
        setSuccessMsg(`Filial "${formData.name}" cadastrada com sucesso!`);
      }
      setModalOpen(false);
      await onRefresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar filial.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBranchStatus = async (branch: Branch) => {
    const nextStatus: BranchStatus = branch.status === 'ativa' ? 'suspensa' : 'ativa';
    try {
      await DatabaseService.updateBranch(
        branch.id,
        { status: nextStatus },
        currentUser?.email || 'master@onnix.com'
      );
      setSuccessMsg(`Status da filial "${branch.name}" alterado para ${nextStatus}.`);
      await onRefresh();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status da filial.');
    }
  };

  // Execute Transfer of Customer or Contract to another Branch
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetId) {
      setErrorMsg('Selecione o registro a ser transferido.');
      return;
    }
    if (!transferDestBranchId) {
      setErrorMsg('Selecione a filial de destino.');
      return;
    }

    const destBranch = branches.find(b => b.id === transferDestBranchId);
    if (!destBranch) {
      setErrorMsg('Filial de destino inválida.');
      return;
    }

    setTransferring(true);
    setErrorMsg('');
    try {
      if (transferType === 'customer') {
        await DatabaseService.transferCustomerBranch(
          transferTargetId,
          destBranch.id,
          destBranch.companyId,
          transferReason || 'Transferência operacional de unidade',
          currentUser?.email || 'admin@onnix.com'
        );
        setSuccessMsg(`Cliente transferido com sucesso para a filial "${destBranch.name}".`);
      } else {
        await DatabaseService.transferContractBranch(
          transferTargetId,
          destBranch.id,
          destBranch.companyId,
          transferReason || 'Transferência operacional de contrato',
          currentUser?.email || 'admin@onnix.com'
        );
        setSuccessMsg(`Contrato transferido com sucesso para a filial "${destBranch.name}".`);
      }
      setTransferModalOpen(false);
      setTransferTargetId('');
      setTransferReason('');
      await onRefresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar transferência.');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              Gestão de Filiais & Unidades
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/40">
                Rede Multiempresa
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              Administração de filiais regionais, vinculação operacional e transferência entre unidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTransferModalOpen(true);
              setErrorMsg('');
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            Transferir Clientes / Contratos
          </button>

          {(isMasterOwner || currentUser?.role === 'EMPRESA_ADMIN') && (
            <button
              onClick={openNewBranchModal}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Filial
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Total de Filiais</span>
            <GitBranch className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Unidades operacionais</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Filiais Ativas</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.ativas}</div>
          <div className="text-[11px] text-slate-500 mt-1">Em pleno funcionamento</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Filiais Suspensas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats.suspensas}</div>
          <div className="text-[11px] text-slate-500 mt-1">Acesso retido</div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Clientes nas Filiais</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">{stats.totalClientsLinked}</div>
          <div className="text-[11px] text-slate-500 mt-1">Atendidos na ponta</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar filial por nome, código, cidade, CNPJ ou gestor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Company Selector for Master Owner */}
          {isMasterOwner && (
            <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedCompanyFilter}
                onChange={e => setSelectedCompanyFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="TODAS">Todas as Empresas Matrizes</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativa">Ativas</option>
            <option value="suspensa">Suspensas</option>
            <option value="inativa">Inativas</option>
          </select>
        </div>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleBranches.map(branch => {
          const parentCompany = companies.find(c => c.id === branch.companyId);
          const branchCustomers = customers.filter(c => c.branchId === branch.id);
          const branchContracts = contracts.filter(c => c.branchId === branch.id);

          return (
            <div
              key={branch.id}
              className="flex flex-col justify-between rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all duration-200 p-5"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-base">
                      {branch.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                          {branch.code}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            branch.status === 'ativa'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                          }`}
                        >
                          {branch.status === 'ativa' ? 'Ativa' : 'Suspensa'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1 line-clamp-1">{branch.name}</h3>
                      <p className="text-xs text-cyan-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {parentCompany?.tradeName || 'Matriz Principal'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Responsável / Gerente:</span>
                    <span className="font-semibold text-slate-200">{branch.managerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">E-mail:</span>
                    <span className="text-slate-200 truncate max-w-[180px]">{branch.managerEmail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Telefone:</span>
                    <span className="font-mono text-slate-200">{branch.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Localização:</span>
                    <span className="text-slate-200">{branch.city}/{branch.state}</span>
                  </div>
                  {branch.cnpj && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">CNPJ Filial:</span>
                      <span className="font-mono text-slate-200">{branch.cnpj}</span>
                    </div>
                  )}
                </div>

                {/* Counters */}
                <div className="grid grid-cols-2 gap-3 py-3">
                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Clientes Ativos</span>
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1">{branchCustomers.length}</div>
                  </div>

                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Contratos Vinculados</span>
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-xl font-bold text-white mt-1">{branchContracts.length}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => openEditModal(branch)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Filial
                </button>

                {(isMasterOwner || currentUser?.role === 'EMPRESA_ADMIN') && (
                  <button
                    onClick={() => handleToggleBranchStatus(branch)}
                    className={`text-xs flex items-center gap-1 py-1 px-2 rounded transition-colors cursor-pointer ${
                      branch.status === 'suspensa'
                        ? 'text-emerald-400 hover:bg-emerald-950/40'
                        : 'text-amber-400 hover:bg-amber-950/40'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {branch.status === 'suspensa' ? 'Reativar' : 'Suspender'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleBranches.length === 0 && (
        <div className="p-12 text-center bg-slate-900/30 rounded-2xl border border-slate-800">
          <GitBranch className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Nenhuma filial encontrada</h3>
          <p className="text-sm text-slate-500 mt-1">Verifique os filtros selecionados ou cadastre uma nova filial.</p>
        </div>
      )}

      {/* Modal Criar / Editar Filial */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingBranch ? 'Editar Filial' : 'Nova Filial / Unidade'}
                  </h3>
                  <p className="text-xs text-slate-400">Dados operacionais, responsável e localização regional</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Parent Company & Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Empresa Matriz *</label>
                  <select
                    disabled={!isMasterOwner && currentUser?.role === 'EMPRESA_ADMIN'}
                    value={formData.companyId}
                    onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.tradeName} ({c.code}) - Limite: {c.branchesLimit} filiais
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Código da Filial</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Name & CNPJ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome da Filial / Unidade *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Filial Campinas Centro"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">CNPJ da Filial (se houver)</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0002-00"
                    value={formData.cnpj}
                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Responsible Manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Gestor / Responsável *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Juliana Santos"
                    value={formData.managerName}
                    onChange={e => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">E-mail do Gestor *</label>
                  <input
                    type="email"
                    required
                    placeholder="juliana.santos@parceiro.com"
                    value={formData.managerEmail}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        managerEmail: e.target.value,
                        email: formData.email || e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefone da Filial</label>
                  <input
                    type="text"
                    placeholder="(19) 3333-4444"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status Operacional</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as BranchStatus })}
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                  >
                    <option value="ativa">Ativa (Operação Normal)</option>
                    <option value="suspensa">Suspensa (Bloqueada)</option>
                    <option value="inativa">Inativa (Desativada)</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Endereço da Unidade</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">CEP</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={e => setFormData({ ...formData, cep: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      placeholder="Rua Barão de Jaguara"
                      value={formData.street}
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Número</label>
                    <input
                      type="text"
                      value={formData.number}
                      onChange={e => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={formData.neighborhood}
                      onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-white font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : editingBranch ? 'Salvar Filial' : 'Criar Filial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferência de Filial */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Transferência de Filial / Unidade</h3>
                  <p className="text-xs text-slate-400">Migração segura de cliente ou contrato com registro de auditoria</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Type Switch */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTransferType('customer');
                    setTransferTargetId('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transferType === 'customer'
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transferir Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferType('contract');
                    setTransferTargetId('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    transferType === 'contract'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transferir Contrato
                </button>
              </div>

              {/* Select Target */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {transferType === 'customer' ? 'Selecione o Cliente:' : 'Selecione o Contrato:'}
                </label>
                <select
                  required
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                >
                  <option value="">-- Selecione --</option>
                  {transferType === 'customer'
                    ? customers.map(c => {
                        const curBranch = branches.find(b => b.id === c.branchId);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name} (Atual: {curBranch?.name || 'Matriz / Sem Filial'})
                          </option>
                        );
                      })
                    : contracts.map(ctr => {
                        const curBranch = branches.find(b => b.id === ctr.branchId);
                        return (
                          <option key={ctr.id} value={ctr.id}>
                            {ctr.documentNumber} - {ctr.title} (Atual: {curBranch?.name || 'Matriz'})
                          </option>
                        );
                      })}
                </select>
              </div>

              {/* Destination Branch */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Filial de Destino:</label>
                <select
                  required
                  value={transferDestBranchId}
                  onChange={e => setTransferDestBranchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                >
                  <option value="">-- Selecione a Filial de Destino --</option>
                  {branches.map(b => {
                    const comp = companies.find(c => c.id === b.companyId);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city}/{b.state}) - Empresa: {comp?.tradeName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Motivo da Transferência:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mudança de endereço do cliente ou reestruturação regional"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {transferring ? 'Transferindo...' : 'Confirmar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
