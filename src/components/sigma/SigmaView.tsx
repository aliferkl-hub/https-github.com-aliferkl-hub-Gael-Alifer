import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tv,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  RefreshCw,
  Search,
  Filter,
  Copy,
  ExternalLink,
  MessageCircle,
  XCircle,
  UserCheck,
  Building2,
  Calendar,
  Lock,
  Server,
  Package,
  Layers,
  Sliders,
  Check,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  SigmaConfig,
  SigmaCompanySettings,
  SigmaTestRequest,
  SigmaServer,
  SigmaPackage,
  PartnerCompany,
} from '../../types/index.ts';
import { SigmaClient } from '../../lib/sigma.ts';
import { Modal } from '../common/Modal.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface SigmaViewProps {
  companies: PartnerCompany[];
}

export const SigmaView: React.FC<SigmaViewProps> = ({ companies }) => {
  const { currentUser, isMasterOwner } = useAuth();

  // Status & Diagnostics State
  const [config, setConfig] = useState<SigmaConfig | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  // Catalogs
  const [servers, setServers] = useState<SigmaServer[]>([]);
  const [packages, setPackages] = useState<SigmaPackage[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // Company Settings & Requests
  const [companySettings, setCompanySettings] = useState<SigmaCompanySettings[]>([]);
  const [testRequests, setTestRequests] = useState<SigmaTestRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Tabs within Sigma view: 'testes' | 'aprovacoes' | 'regras_empresas' | 'configuracao'
  const [activeSubTab, setActiveSubTab] = useState<'testes' | 'aprovacoes' | 'regras_empresas' | 'configuracao'>('testes');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [companyFilter, setCompanyFilter] = useState<string>('todas');

  // New Test Modal State
  const [isNewTestModalOpen, setIsNewTestModalOpen] = useState(false);
  const [testClientName, setTestClientName] = useState('');
  const [testClientWhatsApp, setTestClientWhatsApp] = useState('');
  const [testClientEmail, setTestClientEmail] = useState('');
  const [testClientNotes, setTestClientNotes] = useState('');
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedTrialHours, setSelectedTrialHours] = useState<number>(2);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{ type: 'success' | 'error' | 'pending'; message: string; test?: SigmaTestRequest } | null>(null);

  // In-UI Toast Notification banner (replaces window.alert)
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToastNotification({ type, message });
    setTimeout(() => {
      setToastNotification(prev => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // View Credentials Modal
  const [selectedTestForCredentials, setSelectedTestForCredentials] = useState<SigmaTestRequest | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Approval / Rejection Modal State
  const [testToApprove, setTestToApprove] = useState<SigmaTestRequest | null>(null);
  const [testToReject, setTestToReject] = useState<SigmaTestRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Edit Company Settings Modal
  const [editingCompany, setEditingCompany] = useState<PartnerCompany | null>(null);
  const [editAutoApproval, setEditAutoApproval] = useState(true);
  const [editMaxDaily, setEditMaxDaily] = useState(10);
  const [editMaxMonthly, setEditMaxMonthly] = useState(100);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  // Load all initial data
  const loadData = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const [cfg, reqs, compSttgs] = await Promise.all([
        SigmaClient.getConfig(currentUser),
        SigmaClient.getTestRequests(currentUser, isMasterOwner && companyFilter !== 'todas' ? companyFilter : undefined),
        SigmaClient.getCompanySettings(currentUser),
      ]);
      setConfig(cfg);
      setTestRequests(reqs || []);
      setCompanySettings(compSttgs || []);

      // Pre-select defaults
      if (cfg?.defaultServerId) setSelectedServerId(cfg.defaultServerId);
      if (cfg?.defaultPackageId) setSelectedPackageId(cfg.defaultPackageId);
      if (cfg?.defaultTrialHours) setSelectedTrialHours(cfg.defaultTrialHours);
    } catch (err) {
      console.warn('Error loading Sigma data:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [currentUser, isMasterOwner, companyFilter]);

  // Load catalogs (servers & packages)
  const loadCatalogs = useCallback(async () => {
    if (!config?.hasToken) return;
    setLoadingCatalogs(true);
    try {
      const [srvs, pkgs] = await Promise.all([
        SigmaClient.getServers(currentUser),
        SigmaClient.getPackages(currentUser),
      ]);
      setServers(srvs || []);
      setPackages(pkgs || []);

      if (!selectedServerId && srvs && srvs.length > 0) {
        setSelectedServerId(srvs[0].id);
      }
      if (!selectedPackageId && pkgs && pkgs.length > 0) {
        setSelectedPackageId(pkgs[0].id);
      }
    } catch (err) {
      console.warn('Error loading Sigma catalogs:', err);
    } finally {
      setLoadingCatalogs(false);
    }
  }, [config?.hasToken, currentUser, selectedServerId, selectedPackageId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (config?.hasToken) {
      loadCatalogs();
    }
  }, [config?.hasToken, loadCatalogs]);

  // Handle Diagnostic
  const handleRunDiagnostic = async () => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const result = await SigmaClient.diagnose(currentUser);
      setDiagnosticResult(result);
      await loadData();
    } catch (err: any) {
      setDiagnosticResult({
        status: 'erro',
        message: err.message || 'Erro ao realizar diagnóstico.',
      });
    } finally {
      setDiagnosing(false);
    }
  };

  // Current company rule
  const currentCompanySettings = useMemo(() => {
    const targetCompId = currentUser?.role === 'MASTER_OWNER'
      ? (selectedCompanyId || companies[0]?.id || 'company-matriz-01')
      : currentUser?.companyId;

    return companySettings.find(s => s.companyId === targetCompId);
  }, [currentUser, selectedCompanyId, companies, companySettings]);

  // Quota calculation for current user's company
  const companyUsage = useMemo(() => {
    const targetCompId = currentUser?.role === 'MASTER_OWNER'
      ? (selectedCompanyId || 'company-matriz-01')
      : currentUser?.companyId;

    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    const compRequests = testRequests.filter(r => r.companyId === targetCompId && r.approvalStatus !== 'rejeitado');
    const todayCount = compRequests.filter(r => r.requestedAt.startsWith(todayStr)).length;
    const monthCount = compRequests.filter(r => r.requestedAt.startsWith(monthStr)).length;

    const maxDaily = currentCompanySettings?.maxDailyTests ?? 10;
    const maxMonthly = currentCompanySettings?.maxMonthlyTests ?? 100;
    const autoApproval = isMasterOwner ? true : (currentCompanySettings?.autoApproval ?? false);

    return {
      todayCount,
      monthCount,
      maxDaily,
      maxMonthly,
      autoApproval,
      canGenerate: isMasterOwner || (todayCount < maxDaily && monthCount < maxMonthly && currentCompanySettings?.enabled !== false),
    };
  }, [currentUser, selectedCompanyId, currentCompanySettings, isMasterOwner, testRequests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return testRequests.filter(req => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = req.clientName.toLowerCase().includes(q) || req.clientWhatsApp.includes(q);
        const matchesUser = req.externalUsername?.toLowerCase().includes(q) || false;
        const matchesComp = req.companyName.toLowerCase().includes(q);
        if (!matchesClient && !matchesUser && !matchesComp) return false;
      }

      // Status
      if (statusFilter !== 'todos') {
        if (statusFilter === 'aprovados' && req.approvalStatus !== 'aprovado' && req.approvalStatus !== 'auto_aprovado') return false;
        if (statusFilter === 'pendentes' && req.approvalStatus !== 'pendente_aprovacao') return false;
        if (statusFilter === 'criado' && req.integrationStatus !== 'criado') return false;
        if (statusFilter === 'erro' && req.integrationStatus !== 'erro') return false;
        if (statusFilter === 'desconhecido' && req.integrationStatus !== 'resultado_desconhecido') return false;
      }

      return true;
    });
  }, [testRequests, searchQuery, statusFilter]);

  // Pending approvals list
  const pendingApprovals = useMemo(() => {
    return testRequests.filter(r => r.approvalStatus === 'pendente_aprovacao');
  }, [testRequests]);

  // Packages filtered by selected server
  const filteredPackages = useMemo(() => {
    if (!selectedServerId) return packages;
    return packages.filter(p => String(p.server_id) === String(selectedServerId));
  }, [packages, selectedServerId]);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Submit New Test
  const handleSubmitNewTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingTest) return;

    if (!testClientName.trim()) {
      setSubmissionFeedback({
        type: 'error',
        message: 'Por favor, informe o nome do cliente.',
      });
      return;
    }
    if (!testClientWhatsApp.trim() || testClientWhatsApp.replace(/\D/g, '').length < 8) {
      setSubmissionFeedback({
        type: 'error',
        message: 'Por favor, informe um WhatsApp válido com DDD para entrega do teste.',
      });
      return;
    }

    // Determine effective Server and Package IDs gracefully
    const effectiveServerId = selectedServerId || (servers.length > 0 ? String(servers[0].id) : 'srv-default');
    const effectivePackageId = selectedPackageId || (filteredPackages.length > 0 ? String(filteredPackages[0].id) : (packages.length > 0 ? String(packages[0].id) : 'pkg-default'));

    setIsSubmittingTest(true);
    setSubmissionFeedback(null);

    const srv = (servers || []).find(s => String(s.id) === String(effectiveServerId));
    const pkg = (packages || []).find(p => String(p.id) === String(effectivePackageId));
    const targetCompId = isMasterOwner ? (selectedCompanyId || (companies && companies[0]?.id) || 'company-matriz-01') : currentUser?.companyId;

    try {
      const res = await SigmaClient.createTestRequest(currentUser, {
        clientName: testClientName.trim(),
        clientWhatsApp: testClientWhatsApp.trim(),
        clientEmail: testClientEmail.trim() || undefined,
        clientNotes: testClientNotes.trim() || undefined,
        serverId: effectiveServerId,
        serverName: srv?.name || 'Servidor Sigma',
        packageId: effectivePackageId,
        packageName: pkg?.name || 'Pacote Teste',
        trialHours: selectedTrialHours,
        companyId: targetCompId,
      });

      const created = res.data;
      if (created.approvalStatus === 'auto_aprovado' && created.integrationStatus === 'criado') {
        setSubmissionFeedback({
          type: 'success',
          message: 'Teste gerado com sucesso no Sigma!',
          test: created,
        });
        setSelectedTestForCredentials(created);
        showToast('success', `Teste de ${created.clientName} gerado com sucesso no Sigma!`);
      } else if (created.approvalStatus === 'pendente_aprovacao') {
        setSubmissionFeedback({
          type: 'pending',
          message: 'Solicitação registrada! Aguardando aprovação do Master Owner.',
          test: created,
        });
        showToast('info', `Solicitação de teste para ${created.clientName} enviada para aprovação.`);
      } else {
        setSubmissionFeedback({
          type: 'error',
          message: created.errorMessage || 'Solicitação processada com pendência.',
          test: created,
        });
      }

      await loadData();
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : (err?.message || (typeof err?.error === 'string' ? err.error : 'Falha ao processar solicitação de teste.'));
      setSubmissionFeedback({
        type: 'error',
        message: String(errorMsg),
      });
      showToast('error', String(errorMsg));
    } finally {
      setIsSubmittingTest(false);
    }
  };

  // Approve Test
  const handleApproveTest = async () => {
    if (!testToApprove || isProcessingApproval) return;
    setIsProcessingApproval(true);
    try {
      await SigmaClient.approveTestRequest(currentUser, testToApprove.id);
      showToast('success', `Teste de ${testToApprove.clientName} aprovado e gerado com sucesso no Sigma!`);
      setTestToApprove(null);
      await loadData();
    } catch (err: any) {
      showToast('error', `Falha ao aprovar teste: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Reject Test
  const handleRejectTest = async () => {
    if (!testToReject || isProcessingApproval) return;
    setIsProcessingApproval(true);
    try {
      await SigmaClient.rejectTestRequest(currentUser, testToReject.id, rejectReason);
      showToast('info', `Solicitação de ${testToReject.clientName} recusada.`);
      setTestToReject(null);
      setRejectReason('');
      await loadData();
    } catch (err: any) {
      showToast('error', `Falha ao recusar solicitação: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Reconcile Test
  const handleReconcileTest = async (testId: string) => {
    try {
      const res = await SigmaClient.reconcileTestRequest(currentUser, testId);
      showToast('info', res.message || 'Reconciliação concluída.');
      await loadData();
    } catch (err: any) {
      showToast('error', `Falha na reconciliação: ${err.message || 'Erro desconhecido'}`);
    }
  };

  // Save Company Setting (Master Owner)
  const handleSaveCompanyRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      await SigmaClient.saveCompanySettings(currentUser, {
        companyId: editingCompany.id,
        companyName: editingCompany.tradeName,
        autoApproval: editAutoApproval,
        maxDailyTests: editMaxDaily,
        maxMonthlyTests: editMaxMonthly,
        enabled: editEnabled,
        notes: editNotes,
      });

      showToast('success', `Regras da empresa ${editingCompany.tradeName} salvas com sucesso!`);
      setEditingCompany(null);
      await loadData();
    } catch (err: any) {
      showToast('error', `Erro ao salvar regras: ${err.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Integração Sigma / Atmos
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  Reseller API v1
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Geração de testes IPTV, controle de limites por empresa e aprovação centralizada.
              </p>
            </div>
          </div>
        </div>

        {/* Integration Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                config?.hasToken ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {config?.hasToken ? 'Token Configurado' : 'Configuração Pendente'}
            </span>
          </div>

          <button
            onClick={() => {
              setSubmissionFeedback(null);
              if (!selectedServerId && servers.length > 0) setSelectedServerId(String(servers[0].id));
              if (!selectedPackageId && packages.length > 0) setSelectedPackageId(String(packages[0].id));
              if (!selectedCompanyId && (companies || []).length > 0) setSelectedCompanyId(companies[0].id);
              setIsNewTestModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <Zap className="w-4 h-4" />
            Gerar Novo Teste
          </button>
        </div>
      </div>

      {/* Floating In-UI Toast Notification */}
      {toastNotification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${
          toastNotification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : toastNotification.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            {toastNotification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toastNotification.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
            {toastNotification.type === 'info' && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
            <span className="text-sm font-semibold">{toastNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('testes')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
            activeSubTab === 'testes'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Tv className="w-4 h-4" />
          Testes Gerados ({testRequests.length})
        </button>

        {isMasterOwner && (
          <button
            onClick={() => setActiveSubTab('aprovacoes')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap relative ${
              activeSubTab === 'aprovacoes'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Fila de Aprovação
            {pendingApprovals.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-slate-950 ml-1">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}

        {isMasterOwner && (
          <button
            onClick={() => setActiveSubTab('regras_empresas')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
              activeSubTab === 'regras_empresas'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Regras por Empresa
          </button>
        )}

        {isMasterOwner && (
          <button
            onClick={() => setActiveSubTab('configuracao')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
              activeSubTab === 'configuracao'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Configuração & Diagnóstico
          </button>
        )}
      </div>

      {/* Quota & Mode Info Banner for Current Company */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Modo de Operação</p>
              <p className="text-sm font-bold text-white">
                {companyUsage.autoApproval ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Modo A: Geração Automática
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Modo B: Exige Aprovação Master
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Cota Diária de Testes</p>
              <p className="text-sm font-bold text-white">
                {companyUsage.todayCount} / {isMasterOwner ? 'Ilimitado' : companyUsage.maxDaily} gerados hoje
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${companyUsage.todayCount >= companyUsage.maxDaily && !isMasterOwner ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {isMasterOwner ? 'Livre' : `${Math.max(0, companyUsage.maxDaily - companyUsage.todayCount)} restantes`}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Cota Mensal de Testes</p>
              <p className="text-sm font-bold text-white">
                {companyUsage.monthCount} / {isMasterOwner ? 'Ilimitado' : companyUsage.maxMonthly} no mês atual
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${companyUsage.monthCount >= companyUsage.maxMonthly && !isMasterOwner ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {isMasterOwner ? 'Livre' : `${Math.max(0, companyUsage.maxMonthly - companyUsage.monthCount)} restantes`}
            </span>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: TEST REQUESTS LIST */}
      {activeSubTab === 'testes' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, WhatsApp ou usuário..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 py-2 px-3 focus:outline-none focus:border-cyan-500"
              >
                <option value="todos">Todos os Status</option>
                <option value="criado">Criado no Sigma</option>
                <option value="pendentes">Aguardando Aprovação</option>
                <option value="erro">Com Erro</option>
                <option value="desconhecido">Resultado Desconhecido</option>
              </select>

              {isMasterOwner && (
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 py-2 px-3 focus:outline-none focus:border-cyan-500"
                >
                  <option value="todas">Todas as Empresas</option>
                  {(companies || []).map(c => (
                    <option key={c.id} value={c.id}>{c.tradeName}</option>
                  ))}
                </select>
              )}

              <button
                onClick={loadData}
                disabled={loadingRequests}
                className="p-2 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Recarregar"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRequests ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cliente & WhatsApp</th>
                    {isMasterOwner && <th className="py-3 px-4">Empresa</th>}
                    <th className="py-3 px-4">Servidor / Pacote</th>
                    <th className="py-3 px-4">Duração</th>
                    <th className="py-3 px-4">Aprovação</th>
                    <th className="py-3 px-4">Integração Sigma</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={isMasterOwner ? 8 : 7} className="py-12 text-center text-slate-500">
                        Nenhuma solicitação de teste encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const isCreated = req.integrationStatus === 'criado';
                      const isPending = req.approvalStatus === 'pendente_aprovacao';
                      const isUnknown = req.integrationStatus === 'resultado_desconhecido';
                      const isError = req.integrationStatus === 'erro';

                      return (
                        <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-white">{req.clientName}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                              <MessageCircle className="w-3 h-3 text-emerald-400" />
                              {req.clientWhatsApp}
                            </p>
                          </td>

                          {isMasterOwner && (
                            <td className="py-3 px-4">
                              <span className="text-xs text-slate-300 font-medium">
                                {req.companyName}
                              </span>
                            </td>
                          )}

                          <td className="py-3 px-4">
                            <p className="text-xs font-semibold text-slate-200">{req.serverName}</p>
                            <p className="text-xs text-slate-400">{req.packageName}</p>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {req.trialHours}h
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {req.approvalStatus === 'auto_aprovado' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Auto
                              </span>
                            )}
                            {req.approvalStatus === 'aprovado' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Aprovado
                              </span>
                            )}
                            {req.approvalStatus === 'pendente_aprovacao' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                <Clock className="w-3 h-3" /> Pendente
                              </span>
                            )}
                            {req.approvalStatus === 'rejeitado' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                                <XCircle className="w-3 h-3" /> Recusado
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isCreated && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                <Check className="w-3 h-3" /> Criado
                              </span>
                            )}
                            {req.integrationStatus === 'processando' && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Processando
                              </span>
                            )}
                            {isUnknown && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                                <AlertTriangle className="w-3 h-3" /> Desconhecido
                              </span>
                            )}
                            {isError && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium" title={req.errorMessage}>
                                <XCircle className="w-3 h-3" /> Erro
                              </span>
                            )}
                            {req.integrationStatus === 'pendente' && (
                              <span className="text-xs text-slate-500">Aguardando</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {req.externalExpiresAt ? (
                              <span className="text-xs font-mono text-slate-300">
                                {new Date(req.externalExpiresAt).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCreated && (
                                <>
                                  <button
                                    onClick={() => setSelectedTestForCredentials(req)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs rounded-lg font-medium transition-colors"
                                  >
                                    Ver Acesso
                                  </button>
                                  <a
                                    href={SigmaClient.generateWhatsAppShareLink(req)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                                    title="Enviar WhatsApp"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}

                              {isUnknown && (
                                <button
                                  onClick={() => handleReconcileTest(req.id)}
                                  className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs rounded-lg font-medium transition-colors"
                                  title="Verificar se o cliente foi criado no Sigma"
                                >
                                  Reconciliar
                                </button>
                              )}

                              {isPending && isMasterOwner && (
                                <>
                                  <button
                                    onClick={() => setTestToApprove(req)}
                                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs rounded-lg font-medium transition-colors"
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    onClick={() => setTestToReject(req)}
                                    className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded-lg font-medium transition-colors"
                                  >
                                    Recusar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: APPROVAL QUEUE (MASTER OWNER ONLY) */}
      {activeSubTab === 'aprovacoes' && isMasterOwner && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Solicitações de Testes Aguardando Aprovação ({pendingApprovals.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Empresas configuradas no <strong>Modo B</strong> geram solicitações pendentes. Ao aprovar, o backend enviará a criação ao fornecedor Sigma.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApprovals.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
                Nenhuma solicitação pendente no momento. Todas as empresas em dia!
              </div>
            ) : (
              pendingApprovals.map(req => (
                <div key={req.id} className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                        Aguardando Aprovação
                      </span>
                      <h3 className="text-base font-bold text-white mt-2">{req.clientName}</h3>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        {req.clientWhatsApp}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">Empresa Solicitante</span>
                      <p className="text-sm font-semibold text-cyan-400">{req.companyName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-500 block">Servidor:</span>
                      <span className="font-semibold text-slate-200">{req.serverName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pacote:</span>
                      <span className="font-semibold text-slate-200">{req.packageName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Duração:</span>
                      <span className="font-semibold text-slate-200">{req.trialHours} Horas</span>
                    </div>
                  </div>

                  {req.clientNotes && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/30 p-2 rounded border border-slate-800/60">
                      Obs: {req.clientNotes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-500">
                      Solicitado em {new Date(req.requestedAt).toLocaleString('pt-BR')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTestToReject(req)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 transition-colors"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => setTestToApprove(req)}
                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow-md shadow-emerald-500/20"
                      >
                        Aprovar e Criar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: COMPANY RULES & LIMITS (MASTER OWNER ONLY) */}
      {activeSubTab === 'regras_empresas' && isMasterOwner && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Controle de Cotas e Autorização por Empresa Parceira
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Defina se a empresa gera testes automaticamente (Modo A) ou se exige aprovação do Master Owner (Modo B), além dos limites diários e mensais.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Modo de Operação</th>
                    <th className="py-3 px-4">Limite Diário</th>
                    <th className="py-3 px-4">Limite Mensal</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Configurar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(companies || []).map(comp => {
                    const setting = companySettings.find(s => s.companyId === comp.id);
                    const autoApproval = setting ? setting.autoApproval : (comp.id === 'company-matriz-01');
                    const maxDaily = setting?.maxDailyTests ?? (comp.id === 'company-matriz-01' ? 50 : 10);
                    const maxMonthly = setting?.maxMonthlyTests ?? (comp.id === 'company-matriz-01' ? 500 : 100);
                    const isEnabled = setting ? setting.enabled : true;

                    return (
                      <tr key={comp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white">{comp.tradeName}</p>
                          <p className="text-xs text-slate-500">{comp.code} • {comp.corporateName}</p>
                        </td>

                        <td className="py-3 px-4">
                          {autoApproval ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Modo A: Automático
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              <Clock className="w-3 h-3" /> Modo B: Exige Aprovação
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-slate-200">{maxDaily} testes</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-slate-200">{maxMonthly} testes</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isEnabled ? 'Ativo' : 'Suspenso'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingCompany(comp);
                              setEditAutoApproval(autoApproval);
                              setEditMaxDaily(maxDaily);
                              setEditMaxMonthly(maxMonthly);
                              setEditEnabled(isEnabled);
                              setEditNotes(setting?.notes || '');
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Editar Regras
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CONFIGURATION & DIAGNOSTICS (MASTER OWNER ONLY) */}
      {activeSubTab === 'configuracao' && isMasterOwner && (
        <div className="space-y-6">
          {/* Diagnostic Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  Diagnóstico e Status da Conexão
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifica a autenticação e conectividade com a API oficial sem expor credenciais.
                </p>
              </div>

              <button
                onClick={handleRunDiagnostic}
                disabled={diagnosing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl border border-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagnosing ? 'animate-spin' : ''}`} />
                {diagnosing ? 'Diagnosticando...' : 'Executar Diagnóstico'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Status da Credencial</span>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  {config?.hasToken ? (
                    <span className="text-emerald-400">SIGMA_API_TOKEN Ativo</span>
                  ) : (
                    <span className="text-amber-400">Ausente no Servidor (.env)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">Armazenado exclusivamente em variável de ambiente do servidor.</p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Escopos Solicitados</span>
                <p className="text-xs font-mono text-cyan-300">servers.read</p>
                <p className="text-xs font-mono text-cyan-300">packages.read</p>
                <p className="text-xs font-mono text-cyan-300">customers.create</p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">URL Base Oficial</span>
                <p className="text-xs font-mono text-slate-300 truncate">
                  https://atmos.panelbr.site/api/reseller-api/v1
                </p>
                <span className="text-xs text-slate-500 mt-1 block">Cabeçalho Bearer autenticado</span>
              </div>
            </div>

            {/* Diagnostic Result Box */}
            {diagnosticResult && (
              <div className={`p-4 rounded-xl border ${
                diagnosticResult.status === 'configurada'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center gap-2">
                  {diagnosticResult.status === 'configurada' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  )}
                  <p className="text-sm font-bold">{diagnosticResult.message}</p>
                  {diagnosticResult.responseTimeMs && (
                    <span className="text-xs font-mono ml-auto px-2 py-0.5 rounded bg-slate-900/60">
                      {diagnosticResult.responseTimeMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Webhooks Guidance Section */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Orientações sobre Webhooks
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              As operações de webhook (<code className="text-cyan-300">/me/webhooks*</code>) da API Reseller exigem autenticação de sessão diretamente pelo painel Sigma e <strong>não aceitam o token da API de Revenda</strong>.
              Caso deseje receber webhooks, acesse diretamente a página de integrações do seu painel Sigma e cadastre o endpoint com a assinatura HMAC fornecida.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: GERAR NOVO TESTE */}
      <Modal
        isOpen={isNewTestModalOpen}
        onClose={() => {
          if (!isSubmittingTest) {
            setIsNewTestModalOpen(false);
            setSubmissionFeedback(null);
          }
        }}
        title="Gerar Teste IPTV Sigma"
      >
        {submissionFeedback?.type === 'success' && submissionFeedback.test ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Teste Gerado com Sucesso!</h3>
              <p className="text-xs text-slate-300">
                Os dados de acesso foram gerados pela API Sigma e estão prontos para envio.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl space-y-2 text-sm font-mono border border-slate-800">
              {submissionFeedback.test.externalUsername && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Usuário:</span>
                  <span className="text-cyan-400 font-bold">{submissionFeedback.test.externalUsername}</span>
                </div>
              )}
              {submissionFeedback.test.externalPassword && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Senha:</span>
                  <span className="text-cyan-400 font-bold">{submissionFeedback.test.externalPassword}</span>
                </div>
              )}
              {submissionFeedback.test.externalExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expira em:</span>
                  <span className="text-slate-200">
                    {new Date(submissionFeedback.test.externalExpiresAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <a
                href={SigmaClient.generateWhatsAppShareLink(submissionFeedback.test)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                Enviar WhatsApp
              </a>
              <button
                onClick={() => {
                  setIsNewTestModalOpen(false);
                  setSubmissionFeedback(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitNewTest} className="space-y-4">
            {!config?.hasToken && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-200">Configuração da API Sigma Pendente no Servidor</p>
                  <p className="text-amber-300/90 leading-relaxed">
                    A credencial <code className="bg-slate-900 px-1 py-0.5 rounded text-cyan-300 font-mono">SIGMA_API_TOKEN</code> não foi definida no Cloud Run. O teste será registrado e validará regras, mas a ativação externa dependerá da chave.
                  </p>
                </div>
              </div>
            )}

            {submissionFeedback?.type === 'pending' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{submissionFeedback.message}</span>
              </div>
            )}

            {submissionFeedback?.type === 'error' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{submissionFeedback.message}</span>
              </div>
            )}

            {isMasterOwner && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Empresa Parceira Responsável:
                </label>
                <select
                  value={selectedCompanyId || ((companies && companies[0]?.id) || 'company-matriz-01')}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {(companies || []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Cliente <span className="text-red-400">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo Silva"
                value={testClientName}
                onChange={e => setTestClientName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                WhatsApp com DDD <span className="text-red-400">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="Ex: (11) 98765-4321"
                value={testClientWhatsApp}
                onChange={e => setTestClientWhatsApp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Servidor <span className="text-red-400">*</span>:
                </label>
                <select
                  value={selectedServerId || (servers.length > 0 ? String(servers[0].id) : 'srv-default')}
                  onChange={e => setSelectedServerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {servers.length === 0 ? (
                    <option value="srv-default">Servidor Principal</option>
                  ) : (
                    servers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pacote <span className="text-red-400">*</span>:
                </label>
                <select
                  value={selectedPackageId || (filteredPackages.length > 0 ? String(filteredPackages[0].id) : (packages.length > 0 ? String(packages[0].id) : 'pkg-default'))}
                  onChange={e => setSelectedPackageId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {filteredPackages.length === 0 ? (
                    <option value="pkg-default">Pacote Completo Teste</option>
                  ) : (
                    filteredPackages.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Duração do Teste:
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 4, 6].map(hours => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setSelectedTrialHours(hours)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      selectedTrialHours === hours
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {hours} Horas
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observações (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ex: Teste solicitado via Instagram"
                value={testClientNotes}
                onChange={e => setTestClientNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNewTestModalOpen(false)}
                disabled={isSubmittingTest}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingTest}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-sm font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmittingTest && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isSubmittingTest ? 'Processando...' : 'Gerar Teste'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: VER DADOS DE ACESSO */}
      <Modal
        isOpen={Boolean(selectedTestForCredentials)}
        onClose={() => setSelectedTestForCredentials(null)}
        title="Dados de Acesso - Teste IPTV"
      >
        {selectedTestForCredentials && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">Cliente:</span>
                <span className="text-sm font-bold text-white">{selectedTestForCredentials.clientName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">WhatsApp:</span>
                <span className="text-sm font-mono text-slate-300">{selectedTestForCredentials.clientWhatsApp}</span>
              </div>
              {selectedTestForCredentials.externalUsername && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-xs text-slate-400">Usuário:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-cyan-400">{selectedTestForCredentials.externalUsername}</span>
                    <button
                      onClick={() => handleCopy(selectedTestForCredentials.externalUsername!, 'user')}
                      className="text-slate-400 hover:text-white"
                      title="Copiar"
                    >
                      {copiedField === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {selectedTestForCredentials.externalPassword && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-xs text-slate-400">Senha:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-cyan-400">{selectedTestForCredentials.externalPassword}</span>
                    <button
                      onClick={() => handleCopy(selectedTestForCredentials.externalPassword!, 'pass')}
                      className="text-slate-400 hover:text-white"
                      title="Copiar"
                    >
                      {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {selectedTestForCredentials.externalExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Expiração:</span>
                  <span className="text-xs font-mono text-slate-200">
                    {new Date(selectedTestForCredentials.externalExpiresAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            {(selectedTestForCredentials.externalM3uUrl || selectedTestForCredentials.externalM3uShortUrl) && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">Link M3U:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedTestForCredentials.externalM3uShortUrl || selectedTestForCredentials.externalM3uUrl}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono"
                  />
                  <button
                    onClick={() => handleCopy(selectedTestForCredentials.externalM3uShortUrl || selectedTestForCredentials.externalM3uUrl!, 'm3u')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-cyan-400"
                  >
                    {copiedField === 'm3u' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <a
                href={SigmaClient.generateWhatsAppShareLink(selectedTestForCredentials)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <Send className="w-4 h-4" />
                Enviar WhatsApp
              </a>
              <button
                onClick={() => setSelectedTestForCredentials(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM APROVAR MODAL */}
      <ConfirmDialog
        isOpen={Boolean(testToApprove)}
        title="Aprovar Solicitação de Teste"
        message={`Confirma a aprovação do teste para ${testToApprove?.clientName}? O backend enviará imediatamente a criação para a API Sigma.`}
        confirmLabel="Aprovar e Criar"
        cancelLabel="Cancelar"
        onConfirm={handleApproveTest}
        onClose={() => setTestToApprove(null)}
      />

      {/* MODAL RECUSAR */}
      <Modal
        isOpen={Boolean(testToReject)}
        onClose={() => setTestToReject(null)}
        title="Recusar Solicitação de Teste"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Informe o motivo da recusa para a empresa <strong>{testToReject?.companyName}</strong>:
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Ex: Cota diária excedida ou pacote não homologado..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-red-500"
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setTestToReject(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejectTest}
              className="px-4 py-2 bg-red-500 hover:bg-red-400 text-slate-950 text-sm font-bold rounded-xl"
            >
              Confirmar Recusa
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL EDITAR REGRAS DA EMPRESA */}
      <Modal
        isOpen={Boolean(editingCompany)}
        onClose={() => setEditingCompany(null)}
        title={`Regras de Testes - ${editingCompany?.tradeName}`}
      >
        {editingCompany && (
          <form onSubmit={handleSaveCompanyRule} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modo de Operação da Empresa:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditAutoApproval(true)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-left flex items-center gap-2 ${
                    editAutoApproval
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="block">Modo A</span>
                    <span className="text-[10px] text-slate-400 font-normal">Geração Automática</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditAutoApproval(false)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border text-left flex items-center gap-2 ${
                    !editAutoApproval
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="block">Modo B</span>
                    <span className="text-[10px] text-slate-400 font-normal">Exige Aprovação</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Limite Diário de Testes:
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={editMaxDaily}
                  onChange={e => setEditMaxDaily(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Limite Mensal de Testes:
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={editMaxMonthly}
                  onChange={e => setEditMaxMonthly(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status da Empresa para Geração de Testes:
              </label>
              <select
                value={editEnabled ? 'true' : 'false'}
                onChange={e => setEditEnabled(e.target.value === 'true')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
              >
                <option value="true">Habilitada (Pode gerar/solicitar)</option>
                <option value="false">Suspensa (Geração bloqueada)</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCompany(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold rounded-xl"
              >
                Salvar Regras
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
