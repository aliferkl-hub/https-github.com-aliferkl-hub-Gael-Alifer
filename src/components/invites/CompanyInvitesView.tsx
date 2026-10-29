import React, { useState, useMemo } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Share2,
  Clock,
  ShieldCheck,
  Building2,
  Sparkles,
  AlertTriangle,
  X,
  RefreshCw,
  Ban,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  Calendar,
  Lock,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CompanyInvite, InviteStatus, InviteType, PartnerCompany } from '../../types/index.ts';
import { DatabaseService } from '../../lib/db.ts';
import { generateSecureCompanyInviteCode } from '../../lib/crypto.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface CompanyInvitesViewProps {
  invites: CompanyInvite[];
  companies: PartnerCompany[];
  onRefresh: () => Promise<void>;
}

export const CompanyInvitesView: React.FC<CompanyInvitesViewProps> = ({
  invites,
  companies,
  onRefresh,
}) => {
  const { currentUser } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | InviteStatus | 'pendente_aprovacao'>('todos');
  const [typeFilter, setTypeFilter] = useState<'todos' | InviteType>('todos');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailInvite, setDetailInvite] = useState<CompanyInvite | null>(null);
  const [revokeModalInvite, setRevokeModalInvite] = useState<CompanyInvite | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [rejectModalInvite, setRejectModalInvite] = useState<CompanyInvite | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Creation form state
  const [formType, setFormType] = useState<InviteType>('nova_empresa');
  const [formCode, setFormCode] = useState(() => generateSecureCompanyInviteCode('ONX-INV'));
  const [formSelectedCompanyId, setFormSelectedCompanyId] = useState('');
  const [formRecipientEmail, setFormRecipientEmail] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formRecipientPhone, setFormRecipientPhone] = useState('');
  const [formSuggestedPlan, setFormSuggestedPlan] = useState('Empresarial Pro');
  const [formBranchesLimit, setFormBranchesLimit] = useState(5);
  const [formClientsLimit, setFormClientsLimit] = useState(500);
  const [formValidityOption, setFormValidityOption] = useState<'24h' | '48h' | '7d' | '15d' | '30d' | '90d' | 'custom'>('7d');
  const [formCustomExpiresAt, setFormCustomExpiresAt] = useState('');
  const [formRequiresApproval, setFormRequiresApproval] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  // UI feedback
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedLinkInviteId, setCopiedLinkInviteId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick expiration calculation
  const getExpiresAtDate = (option: string, customDate: string): string => {
    const now = new Date();
    switch (option) {
      case '24h':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case '48h':
        return new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case '15d':
        return new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      case 'custom':
        return customDate ? new Date(customDate).toISOString() : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  // Open Create Modal with clean defaults
  const handleOpenCreateModal = (type: InviteType = 'nova_empresa', preselectedComp?: PartnerCompany) => {
    setFormType(type);
    setFormCode(generateSecureCompanyInviteCode('ONX-INV'));
    if (preselectedComp) {
      setFormSelectedCompanyId(preselectedComp.id);
      setFormRecipientEmail(preselectedComp.adminEmail);
      setFormRecipientName(preselectedComp.adminName || preselectedComp.contactName);
      setFormRecipientPhone(preselectedComp.phone);
    } else {
      setFormSelectedCompanyId(companies[0]?.id || '');
      setFormRecipientEmail('');
      setFormRecipientName('');
      setFormRecipientPhone('');
    }
    setFormSuggestedPlan('Empresarial Pro');
    setFormBranchesLimit(5);
    setFormClientsLimit(500);
    setFormValidityOption('7d');
    setFormCustomExpiresAt('');
    setFormRequiresApproval(false);
    setFormNotes('');
    setErrorMsg(null);
    setCreateModalOpen(true);
  };

  // Handle Form Submit
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoadingAction(true);

    try {
      const cleanCode = formCode.trim().toUpperCase();
      if (!cleanCode) {
        throw new Error('Informe o código de convite.');
      }

      const expiresAt = getExpiresAtDate(formValidityOption, formCustomExpiresAt);

      let targetCompName: string | undefined = undefined;
      let targetCompId: string | undefined = undefined;

      if (formType === 'empresa_existente') {
        const comp = companies.find(c => c.id === formSelectedCompanyId);
        if (!comp) throw new Error('Selecione uma empresa parceira existente.');
        targetCompId = comp.id;
        targetCompName = comp.tradeName;
      }

      await DatabaseService.createCompanyInvite(
        {
          code: cleanCode,
          type: formType,
          companyId: targetCompId,
          companyName: targetCompName,
          suggestedPlan: formSuggestedPlan,
          suggestedBranchesLimit: formBranchesLimit,
          suggestedClientsLimit: formClientsLimit,
          recipientEmail: formRecipientEmail.trim() || undefined,
          recipientName: formRecipientName.trim() || undefined,
          recipientPhone: formRecipientPhone.trim() || undefined,
          maxUses: 1, // Enforce single use
          expiresAt,
          requiresApproval: formRequiresApproval,
          notes: formNotes.trim() || undefined,
          createdBy: currentUser?.email || 'master@onnix.com',
        },
        currentUser?.email || 'master@onnix.com'
      );

      setSuccessMsg(`Convite "${cleanCode}" gerado com sucesso!`);
      setCreateModalOpen(false);
      await onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gerar convite.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Revoke Invite
  const handleRevokeInvite = async () => {
    if (!revokeModalInvite) return;
    setLoadingAction(true);
    try {
      await DatabaseService.revokeCompanyInvite(
        revokeModalInvite.id,
        revokeReason.trim() || 'Revogado pelo Master Owner',
        currentUser?.email || 'master@onnix.com'
      );
      setSuccessMsg(`Convite "${revokeModalInvite.code}" revogado com sucesso.`);
      setRevokeModalInvite(null);
      setRevokeReason('');
      await onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao revogar convite.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Approve Registration
  const handleApproveRegistration = async (invite: CompanyInvite) => {
    setLoadingAction(true);
    try {
      await DatabaseService.approveCompanyRegistration(invite.id, currentUser?.email || 'master@onnix.com');
      setSuccessMsg(`Cadastro da empresa "${invite.registeredCompanyName || 'Parceira'}" aprovado com sucesso!`);
      await onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aprovar cadastro.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Reject Registration
  const handleRejectRegistration = async () => {
    if (!rejectModalInvite) return;
    setLoadingAction(true);
    try {
      await DatabaseService.rejectCompanyRegistration(
        rejectModalInvite.id,
        rejectReason.trim() || 'Cadastro rejeitado na validação documental',
        currentUser?.email || 'master@onnix.com'
      );
      setSuccessMsg(`Cadastro associado ao convite "${rejectModalInvite.code}" rejeitado.`);
      setRejectModalInvite(null);
      setRejectReason('');
      await onRefresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao rejeitar cadastro.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Copy helpers
  const handleCopyCode = (invite: CompanyInvite) => {
    navigator.clipboard.writeText(invite.code);
    setCopiedCodeId(invite.id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleCopyInstructions = (invite: CompanyInvite) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://onnixplay.com';
    const link = `${origin}?convite=${encodeURIComponent(invite.code)}`;
    const expiresFormatted = new Date(invite.expiresAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isNew = invite.type === 'nova_empresa';
    const text = `*ONNIX PLAY GESTÃO — CONVITE DE PARCEIRO EMPRESARIAL*\n\n` +
      `Olá${invite.recipientName ? ', ' + invite.recipientName : ''}!\n` +
      `Você recebeu um convite exclusivo de credenciamento para a plataforma *ONNIX PLAY*.\n\n` +
      `🔑 *Código de Convite:* ${invite.code}\n` +
      `📅 *Validade:* ${expiresFormatted}\n` +
      `🔒 *Regra:* Uso único e intransferível\n` +
      (invite.suggestedPlan ? `📦 *Plano Contratado:* ${invite.suggestedPlan}\n` : '') +
      `\n*Como realizar seu cadastro/acesso:*\n` +
      `1. Acesse o portal: ${link}\n` +
      `2. Vá até a aba *"1º Acesso / Convite"*\n` +
      `3. Digite o código *${invite.code}*\n` +
      (isNew
        ? `4. Preencha os dados da sua empresa e defina sua senha de administrador.\n`
        : `4. Confirme seu e-mail e defina sua senha de acesso pessoal.\n`) +
      `\nSeja bem-vindo à rede ONNIX PLAY!`;

    navigator.clipboard.writeText(text);
    setCopiedLinkInviteId(invite.id);
    setTimeout(() => setCopiedLinkInviteId(null), 3000);
  };

  const handleSendWhatsApp = (invite: CompanyInvite) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://onnixplay.com';
    const link = `${origin}?convite=${encodeURIComponent(invite.code)}`;
    const expiresFormatted = new Date(invite.expiresAt).toLocaleDateString('pt-BR');

    const msg = `Olá! Você recebeu um convite exclusivo da ONNIX PLAY. Acesse ${link} na aba "1º Acesso" e use o código ${invite.code} (válido até ${expiresFormatted}) para criar seu acesso.`;
    const cleanPhone = (invite.recipientPhone || '').replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = invites.length;
    const pending = invites.filter(i => i.status === 'pendente').length;
    const used = invites.filter(i => i.status === 'utilizado').length;
    const expired = invites.filter(i => i.status === 'expirado').length;
    const revoked = invites.filter(i => i.status === 'revogado').length;
    const pendingApproval = invites.filter(i => i.approvalStatus === 'pendente_aprovacao').length;

    return { total, pending, used, expired, revoked, pendingApproval };
  }, [invites]);

  // Filtered invites
  const filteredInvites = useMemo(() => {
    return invites.filter(inv => {
      // Status filter
      if (statusFilter === 'pendente_aprovacao') {
        if (inv.approvalStatus !== 'pendente_aprovacao') return false;
      } else if (statusFilter !== 'todos' && inv.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'todos' && inv.type !== typeFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchCode = inv.code.toLowerCase().includes(term);
        const matchCompany = (inv.companyName || '').toLowerCase().includes(term) || (inv.registeredCompanyName || '').toLowerCase().includes(term);
        const matchRecipient = (inv.recipientName || '').toLowerCase().includes(term) || (inv.recipientEmail || '').toLowerCase().includes(term);
        const matchUsedBy = (inv.usedByEmail || '').toLowerCase().includes(term);
        return matchCode || matchCompany || matchRecipient || matchUsedBy;
      }

      return true;
    });
  }, [invites, statusFilter, typeFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0d1629] via-[#091122] to-[#0d1830] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-cyan-500/10 via-purple-500/5 to-transparent pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Painel Master Owner
            </span>
            <span className="text-xs text-slate-400">• Sistema de Credenciamento & Onboarding</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-cyan-400" />
            Convites de Empresas Parceiras
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Gere códigos exclusivos com validade, uso único obrigatório e controle de aprovação. O parceiro cria seu próprio acesso seguro sem expor credenciais do Master.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onRefresh()}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('nova_empresa')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Gerar Novo Convite
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 shadow-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 block">Total de Convites</span>
          <span className="text-2xl font-black text-white mt-1 block">{metrics.total}</span>
        </div>

        <div className="bg-slate-900/60 border border-cyan-500/30 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-cyan-400">Pendentes</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <span className="text-2xl font-black text-cyan-300 mt-1 block">{metrics.pending}</span>
        </div>

        <div className="bg-slate-900/60 border border-emerald-500/30 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-emerald-400 block">Utilizados</span>
          <span className="text-2xl font-black text-emerald-300 mt-1 block">{metrics.used}</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-500/40 p-4 rounded-xl relative overflow-hidden">
          {metrics.pendingApproval > 0 && (
            <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-bl">
              AÇÃO
            </div>
          )}
          <span className="text-[11px] font-medium text-amber-400 block">Aprovação Pendente</span>
          <span className="text-2xl font-black text-amber-300 mt-1 block">{metrics.pendingApproval}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-500 block">Expirados</span>
          <span className="text-2xl font-black text-slate-400 mt-1 block">{metrics.expired}</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-rose-400/80 block">Revogados</span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">{metrics.revoked}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por código, empresa, e-mail ou responsável..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-2"
            >
              <option value="todos" className="bg-slate-900">Todos ({metrics.total})</option>
              <option value="pendente" className="bg-slate-900">Pendentes ({metrics.pending})</option>
              <option value="utilizado" className="bg-slate-900">Utilizados ({metrics.used})</option>
              <option value="pendente_aprovacao" className="bg-slate-900">Aprovação Pendente ({metrics.pendingApproval})</option>
              <option value="expirado" className="bg-slate-900">Expirados ({metrics.expired})</option>
              <option value="revogado" className="bg-slate-900">Revogados ({metrics.revoked})</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Tipo:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer pr-2"
            >
              <option value="todos" className="bg-slate-900">Todos</option>
              <option value="nova_empresa" className="bg-slate-900">Nova Empresa (Onboarding)</option>
              <option value="empresa_existente" className="bg-slate-900">Empresa Já Cadastrada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invites Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredInvites.map(invite => {
          const isPending = invite.status === 'pendente';
          const isUsed = invite.status === 'utilizado';
          const isExpired = invite.status === 'expirado';
          const isRevoked = invite.status === 'revogado';
          const isAwaitingApproval = invite.approvalStatus === 'pendente_aprovacao';
          const isDemoInvite = invite.code === 'ONNIX-PARCEIRO-2026';

          const expiresDate = new Date(invite.expiresAt);
          const isCloseToExpiring = isPending && (expiresDate.getTime() - Date.now() < 24 * 60 * 60 * 1000) && expiresDate.getTime() > Date.now();

          return (
            <div
              key={invite.id}
              className={`p-5 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between ${
                isAwaitingApproval
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-950/20'
                  : isPending
                  ? 'bg-slate-900/60 border-slate-800/90 hover:border-cyan-500/50 shadow-sm'
                  : isUsed
                  ? 'bg-slate-900/40 border-emerald-950/60'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-80'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isPending
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : isUsed
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Ticket className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-300">
                          {invite.type === 'nova_empresa' ? 'Onboarding Nova Empresa' : '1º Acesso Empresa'}
                        </span>
                        {isDemoInvite && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                            Exemplo Oficial
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block">
                        Criado por {invite.createdBy} • {new Date(invite.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-1.5">
                    {isPending && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isCloseToExpiring
                          ? 'bg-amber-950 text-amber-300 border-amber-700 animate-pulse'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      }`}>
                        {isCloseToExpiring ? 'Expira em breve' : 'Pendente (Disponível)'}
                      </span>
                    )}

                    {isUsed && !isAwaitingApproval && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Utilizado
                      </span>
                    )}

                    {isAwaitingApproval && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" /> Aguardando Aprovação
                      </span>
                    )}

                    {isExpired && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Expirado
                      </span>
                    )}

                    {isRevoked && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                        Revogado
                      </span>
                    )}
                  </div>
                </div>

                {/* Big Code Display Bar */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Lock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider truncate">
                      {invite.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyCode(invite)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copiar apenas o código"
                    >
                      {copiedCodeId === invite.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">Código</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopyInstructions(invite)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold border border-cyan-800/80 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copiar mensagem completa de acesso para enviar ao parceiro"
                    >
                      {copiedLinkInviteId === invite.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Instruções Copiadas!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] hidden sm:inline">Compartilhar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSendWhatsApp(invite)}
                      className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/80 transition-colors cursor-pointer"
                      title="Compartilhar via WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                  {/* Target / Recipient */}
                  <div className="flex items-center justify-between">
                    <span>Destinatário:</span>
                    <span className="text-white font-medium">
                      {invite.companyName
                        ? invite.companyName
                        : invite.recipientName || invite.recipientEmail || 'Qualquer parceiro autorizado'}
                    </span>
                  </div>

                  {invite.recipientEmail && (
                    <div className="flex items-center justify-between">
                      <span>E-mail informado:</span>
                      <span className="text-slate-300 font-mono text-[11px]">{invite.recipientEmail}</span>
                    </div>
                  )}

                  {/* Plan & Limits */}
                  <div className="flex items-center justify-between">
                    <span>Plano Pré-Configurado:</span>
                    <span className="text-cyan-300 font-semibold">{invite.suggestedPlan || 'Empresarial Pro'}</span>
                  </div>

                  {/* Expiration date */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> Validade:
                    </span>
                    <span className={`font-medium ${isExpired ? 'text-rose-400 line-through' : 'text-slate-300'}`}>
                      {expiresDate.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Single use enforcement */}
                  <div className="flex items-center justify-between">
                    <span>Regra de Uso:</span>
                    <span className="text-purple-300 font-medium">Uso Único ({invite.usedCount} / {invite.maxUses})</span>
                  </div>

                  {/* Approval requirement */}
                  <div className="flex items-center justify-between">
                    <span>Aprovação Prévia Master:</span>
                    <span className={invite.requiresApproval ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                      {invite.requiresApproval ? 'Sim (Exige validação do Master)' : 'Não (Liberação imediata)'}
                    </span>
                  </div>

                  {/* Usage Info if consumed */}
                  {isUsed && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 bg-slate-950/40 p-2.5 rounded-xl space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-emerald-400 font-semibold">
                        <span>Consumido por:</span>
                        <span>{invite.usedByEmail}</span>
                      </div>
                      {invite.registeredCompanyName && (
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Empresa Cadastrada:</span>
                          <span className="font-bold">{invite.registeredCompanyName}</span>
                        </div>
                      )}
                      {invite.usedAt && (
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Data do Consumo:</span>
                          <span>{new Date(invite.usedAt).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rejection / Revocation Reason */}
                  {invite.rejectionReason && (
                    <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] mt-1">
                      <strong>Motivo da Rejeição:</strong> {invite.rejectionReason}
                    </div>
                  )}

                  {invite.revocationReason && (
                    <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] mt-1">
                      <strong>Motivo do Cancelamento:</strong> {invite.revocationReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                {isAwaitingApproval ? (
                  <div className="w-full flex items-center gap-2">
                    <button
                      onClick={() => handleApproveRegistration(invite)}
                      disabled={loadingAction}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprovar Cadastro
                    </button>

                    <button
                      onClick={() => setRejectModalInvite(invite)}
                      disabled={loadingAction}
                      className="py-2 px-3 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </div>
                ) : isPending ? (
                  <div className="w-full flex items-center justify-between gap-2">
                    <button
                      onClick={() => setRevokeModalInvite(invite)}
                      disabled={loadingAction}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Revogar Convite
                    </button>

                    <button
                      onClick={() => handleCopyInstructions(invite)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-cyan-950/40 transition-colors cursor-pointer font-medium"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Enviar Convite
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-500">
                    <span>ID: {invite.id}</span>
                    <button
                      onClick={() => setDetailInvite(invite)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalhes
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredInvites.length === 0 && (
        <div className="p-12 text-center bg-slate-900/30 rounded-2xl border border-slate-800">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">Nenhum convite encontrado</h3>
          <p className="text-sm text-slate-500 mt-1">Ajuste os filtros de pesquisa ou gere um novo código de convite.</p>
        </div>
      )}

      {/* MODAL 1: GERAR NOVO CONVITE */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Gerar Novo Convite Exclusivo</h3>
                  <p className="text-xs text-slate-400">Credenciamento de empresa parceira com uso único e validade controlada</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Tipo de Convite */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                  1. Finalidade do Convite
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('nova_empresa')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formType === 'nova_empresa'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white">Nova Empresa Parceira</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Onboarding completo: o parceiro preenche os dados cadastrais da empresa e cria seu próprio acesso.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('empresa_existente')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formType === 'empresa_existente'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">Empresa Já Cadastrada</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Gera convite de 1º acesso para o gestor de uma empresa parceira previamente cadastrada no painel.
                    </p>
                  </button>
                </div>
              </div>

              {/* Se for empresa existente -> Dropdown */}
              {formType === 'empresa_existente' && (
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Selecione a Empresa Parceira Cadastrada *
                  </label>
                  <select
                    value={formSelectedCompanyId}
                    onChange={e => {
                      setFormSelectedCompanyId(e.target.value);
                      const comp = companies.find(c => c.id === e.target.value);
                      if (comp) {
                        setFormRecipientEmail(comp.adminEmail);
                        setFormRecipientName(comp.adminName || comp.contactName);
                        setFormRecipientPhone(comp.phone);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.tradeName} ({c.adminEmail})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Código do Convite */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                  2. Código do Convite (Exclusivo e Difícil de Adivinhar)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={e => setFormCode(e.target.value.toUpperCase())}
                    placeholder="ONX-INV-XXXX-YYYY"
                    className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-cyan-400 font-bold tracking-wider focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setFormCode(generateSecureCompanyInviteCode('ONX-INV'))}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Gerar código aleatório seguro"
                  >
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    Gerar Novo
                  </button>
                </div>
              </div>

              {/* 3. Validade e Regras de Uso */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                  3. Prazo de Validade & Uso Único
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: '24h', label: '24 Horas' },
                    { id: '48h', label: '48 Horas' },
                    { id: '7d', label: '7 Dias' },
                    { id: '15d', label: '15 Dias' },
                    { id: '30d', label: '30 Dias' },
                    { id: '90d', label: '90 Dias' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormValidityOption(opt.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        formValidityOption === opt.id
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl flex items-center justify-between text-xs text-purple-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    Regra Obrigatória de Segurança:
                  </span>
                  <span className="font-bold">Uso Único (1 Consumo)</span>
                </div>
              </div>

              {/* 4. Destinatário Previsto (Opcional) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                  4. Destinatário / Responsável (Opcional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nome do Responsável</label>
                    <input
                      type="text"
                      placeholder="Ex: Carlos Mendes"
                      value={formRecipientName}
                      onChange={e => setFormRecipientName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">E-mail Sugerido</label>
                    <input
                      type="email"
                      placeholder="carlos@empresa.com"
                      value={formRecipientEmail}
                      onChange={e => setFormRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      placeholder="+55 (11) 98888-0000"
                      value={formRecipientPhone}
                      onChange={e => setFormRecipientPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Parâmetros e Aprovação Prévia */}
              {formType === 'nova_empresa' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400">
                    5. Plano Sugerido & Aprovação Prévia
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Plano Sugerido</label>
                      <select
                        value={formSuggestedPlan}
                        onChange={e => setFormSuggestedPlan(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                      >
                        <option value="Empresarial Start">Empresarial Start (Até 2 Filiais)</option>
                        <option value="Empresarial Pro">Empresarial Pro (Até 5 Filiais)</option>
                        <option value="Empresarial Platinum">Empresarial Platinum (Até 10 Filiais)</option>
                        <option value="Enterprise Unlimited">Enterprise Unlimited</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Limite Filiais</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formBranchesLimit}
                        onChange={e => setFormBranchesLimit(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Limite Clientes</label>
                      <input
                        type="number"
                        min="50"
                        max="50000"
                        value={formClientsLimit}
                        onChange={e => setFormClientsLimit(parseInt(e.target.value) || 100)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Toggle Exigir Aprovação */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Exigir Aprovação do Master Owner após o cadastro?</span>
                      <span className="text-[11px] text-slate-400 block">
                        Se ativado, a empresa ficará pendente de validação até que você a aprove neste painel.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formRequiresApproval}
                        onChange={e => setFormRequiresApproval(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500" />
                    </label>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Observações Internas (Master)</label>
                <input
                  type="text"
                  placeholder="Anotações para controle da equipe Master..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {loadingAction ? 'Gerando...' : 'Confirmar e Criar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAÇÃO DE REVOGAÇÃO DE CONVITE */}
      {revokeModalInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <Ban className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Revogar Código de Convite</h3>
            </div>
            <p className="text-sm text-slate-300">
              Você está cancelando o convite com código <strong className="font-mono text-cyan-400">{revokeModalInvite.code}</strong>.
            </p>
            <p className="text-xs text-slate-400">
              Após a revogação, qualquer tentativa de uso deste código será imediatamente bloqueada pelo sistema.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Motivo do Cancelamento:</label>
              <input
                type="text"
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                placeholder="Ex: Dados inconsistentes ou convite emitido incorretamente"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRevokeModalInvite(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRevokeInvite}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingAction ? 'Revogando...' : 'Confirmar Revogação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJEIÇÃO DE CADASTRO PENDENTE */}
      {rejectModalInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <XCircle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Rejeitar Cadastro da Empresa</h3>
            </div>
            <p className="text-sm text-slate-300">
              Você está rejeitando a solicitação de adesão da empresa <strong className="text-white">{rejectModalInvite.registeredCompanyName || 'Parceira'}</strong>.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Motivo da Rejeição:</label>
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white"
                placeholder="Ex: CNPJ inapto ou dados cadastrais divergentes"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalInvite(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRejectRegistration}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingAction ? 'Processando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DETALHES COMPLETOS DO CONVITE */}
      {detailInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Detalhes do Convite</h3>
              </div>
              <button
                onClick={() => setDetailInvite(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-center text-cyan-400 font-bold text-lg">
                {detailInvite.code}
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold uppercase text-white">{detailInvite.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Tipo:</span>
                <span className="font-medium text-slate-300">{detailInvite.type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Criado em:</span>
                <span className="text-slate-300">{new Date(detailInvite.createdAt).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Expira em:</span>
                <span className="text-slate-300">{new Date(detailInvite.expiresAt).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Uso Máximo:</span>
                <span className="text-slate-300">{detailInvite.usedCount} de {detailInvite.maxUses}</span>
              </div>
              {detailInvite.usedByEmail && (
                <div className="flex justify-between py-1 border-b border-slate-800/60 text-emerald-400">
                  <span>Consumido por:</span>
                  <span className="font-semibold">{detailInvite.usedByEmail}</span>
                </div>
              )}
              {detailInvite.registeredCompanyName && (
                <div className="flex justify-between py-1 border-b border-slate-800/60 text-emerald-400">
                  <span>Empresa Criada:</span>
                  <span className="font-semibold">{detailInvite.registeredCompanyName}</span>
                </div>
              )}
              {detailInvite.notes && (
                <div className="p-3 bg-slate-950/60 rounded-xl text-slate-400 mt-2">
                  <span className="block font-semibold text-slate-300 mb-1">Notas Internas:</span>
                  {detailInvite.notes}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailInvite(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
