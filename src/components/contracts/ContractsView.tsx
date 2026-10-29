import React, { useState, useMemo } from 'react';
import {
  FileSignature,
  Plus,
  Download,
  Printer,
  Eye,
  CheckCircle,
  Clock,
  Search,
  FileText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Contract, Customer, Plan, ContractTemplate, CompanySettings, PartnerCompany, Branch } from '../../types/index.ts';
import { formatBRL, formatBrDate, getTodaySaoPaulo } from '../../lib/date.ts';
import { formatCpf } from '../../lib/cpf.ts';
import { generateContractPdf, printContractDocument } from '../../lib/pdf.ts';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService, DEFAULT_CONTRACT_TEMPLATE } from '../../lib/db.ts';
import { Building2, GitBranch, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react';

interface ContractsViewProps {
  contracts: Contract[];
  customers: Customer[];
  plans: Plan[];
  templates: ContractTemplate[];
  settings: CompanySettings;
  companies?: PartnerCompany[];
  branches?: Branch[];
  selectedCustomerForContract?: Customer | null;
  onClearCustomerSelection?: () => void;
  onRefresh: () => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contracts,
  customers,
  plans,
  templates,
  settings,
  companies = [],
  branches = [],
  selectedCustomerForContract,
  onClearCustomerSelection,
  onRefresh,
}) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Issue Contract Generator state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(Boolean(selectedCustomerForContract));
  const [targetCustomerId, setTargetCustomerId] = useState(selectedCustomerForContract?.id || '');
  const [targetPlanId, setTargetPlanId] = useState(plans[0]?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || DEFAULT_CONTRACT_TEMPLATE.id);

  // Custom contract terms and dates
  const today = getTodaySaoPaulo();
  const [contractTitle, setContractTitle] = useState('Contrato de Adesão & Assinatura ONNIX PLAY');
  const [startDate, setStartDate] = useState(today);
  const [firstDueDate, setFirstDueDate] = useState(today);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [customValue, setCustomValue] = useState<number>(39.9);
  const [editableBody, setEditableBody] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activeViewingContract, setActiveViewingContract] = useState<Contract | null>(null);

  const canIssue = isMasterOwner || hasPermission('emitir_contratos');

  // Trigger generator with prefill
  const handleStartGeneration = (client?: Customer) => {
    const cust = client || customers[0];
    if (!cust) {
      alert('Cadastre um cliente antes de gerar o contrato.');
      return;
    }
    const plan = plans[0];
    setTargetCustomerId(cust.id);
    setTargetPlanId(plan?.id || '');
    setCustomValue(plan?.price || 39.9);
    buildContractText(cust, plan, plan?.price || 39.9, startDate, firstDueDate, endDate);
    setIsGeneratorOpen(true);
  };

  const buildContractText = (
    cust: Customer,
    plan: Plan | undefined,
    val: number,
    sDate: string,
    dDate: string,
    eDate: string
  ) => {
    const template = templates.find(t => t.id === selectedTemplateId) || DEFAULT_CONTRACT_TEMPLATE;
    const clientAddress = `${cust.street || ''}, Nº ${cust.number || ''} ${cust.complement ? `(${cust.complement})` : ''} - ${cust.neighborhood || ''}, ${cust.city || ''}/${cust.state || ''} - CEP: ${cust.cep || ''}`;

    let text = template.templateContent
      .replace(/{{empresa_nome}}/g, settings.companyName || 'ONNIX PLAY')
      .replace(/{{empresa_cnpj}}/g, settings.cnpj || '48.912.430/0001-85')
      .replace(/{{empresa_endereco}}/g, settings.address || 'São Paulo - SP')
      .replace(/{{nome_cliente}}/g, cust.name)
      .replace(/{{cpf_cliente}}/g, formatCpf(cust.cpf))
      .replace(/{{endereco_cliente}}/g, clientAddress)
      .replace(/{{nome_plano}}/g, plan?.name || 'Plano Personalizado')
      .replace(/{{valor_contratado}}/g, formatBRL(val))
      .replace(/{{periodicidade}}/g, plan?.billingCycle || 'Mensal')
      .replace(/{{data_inicio}}/g, formatBrDate(sDate))
      .replace(/{{data_vencimento}}/g, formatBrDate(dDate))
      .replace(/{{data_final}}/g, formatBrDate(eDate))
      .replace(/{{data_atual}}/g, formatBrDate(today));

    setEditableBody(text);
  };

  // When form customer or plan changes in generator
  const handleClientOrPlanChange = (custId: string, pId: string, val: number) => {
    setTargetCustomerId(custId);
    setTargetPlanId(pId);
    setCustomValue(val);
    const cust = customers.find(c => c.id === custId);
    const plan = plans.find(p => p.id === pId);
    if (cust) {
      buildContractText(cust, plan, val, startDate, firstDueDate, endDate);
    }
  };

  const handleSaveAndIssueContract = async (status: Contract['status'] = 'emitido') => {
    const cust = customers.find(c => c.id === targetCustomerId);
    if (!cust) return;
    const plan = plans.find(p => p.id === targetPlanId);

    const docNum = `ONX-CTR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newContract: Contract = {
      id: `contract-${Date.now()}`,
      documentNumber: docNum,
      customerId: cust.id,
      companyId: cust.companyId || 'company-matriz-01',
      branchId: cust.branchId,
      templateId: selectedTemplateId,
      title: contractTitle,
      content: editableBody,
      terms: DEFAULT_CONTRACT_TEMPLATE.defaultClauses,
      dynamicValues: {
        nome_cliente: cust.name,
        cpf_cliente: formatCpf(cust.cpf),
        nome_plano: plan?.name || 'Personalizado',
        valor_contratado: formatBRL(customValue),
      },
      status: status === 'emitido' ? 'ativo' : status,
      startDate,
      dueDate: firstDueDate,
      endDate,
      contractValue: customValue,
      issuedAt: today,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    await DatabaseService.saveContract(newContract, currentUser?.email || 'sistema');
    setIsGeneratorOpen(false);
    if (onClearCustomerSelection) onClearCustomerSelection();
    onRefresh();
  };

  const expiryMetrics = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    let vencidos = 0;
    let em7Dias = 0;
    let em15Dias = 0;
    let em30Dias = 0;
    let ativos = 0;

    contracts.forEach(ctr => {
      if (ctr.status === 'ativo' || ctr.status === 'assinado' || ctr.status === 'emitido') {
        ativos++;
      }
      const expDateStr = ctr.endDate || ctr.dueDate;
      if (expDateStr) {
        const expMs = new Date(expDateStr).getTime();
        const diffDays = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || ctr.status === 'vencido') {
          vencidos++;
        } else if (diffDays <= 7) {
          em7Dias++;
        } else if (diffDays <= 15) {
          em15Dias++;
        } else if (diffDays <= 30) {
          em30Dias++;
        }
      }
    });

    return { vencidos, em7Dias, em15Dias, em30Dias, ativos };
  }, [contracts]);

  const filteredContracts = contracts.filter(c => {
    const matchSearch =
      c.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.dynamicValues?.nome_cliente || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Gerador & Gestão de Contratos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Modelos reutilizáveis com campos dinâmicos, prévia interativa, monitoramento de vencimentos e controle de filiais.
          </p>
        </div>

        {canIssue && (
          <button
            onClick={() => handleStartGeneration()}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir Novo Contrato</span>
          </button>
        )}
      </div>

      {/* Contract Expiration Alerts KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Contratos Ativos</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white">{expiryMetrics.ativos}</div>
          <div className="text-[10px] text-slate-500">Vigência regular</div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>A vencer em 30d</span>
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-400">{expiryMetrics.em30Dias}</div>
          <div className="text-[10px] text-slate-500">Próximos 30 dias</div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>A vencer em 15d</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400">{expiryMetrics.em15Dias}</div>
          <div className="text-[10px] text-slate-500">Atenção comercial</div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>A vencer em 7d</span>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-xl font-bold text-orange-400">{expiryMetrics.em7Dias}</div>
          <div className="text-[10px] text-slate-500">Urgência de renovação</div>
        </div>

        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Vencidos</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400">{expiryMetrics.vencidos}</div>
          <div className="text-[10px] text-slate-500">Requer regularização</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por número do contrato, título ou cliente..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="todos">Todos os Status</option>
          <option value="ativo">Ativo</option>
          <option value="aguardando_assinatura">Aguardando Assinatura</option>
          <option value="emitido">Emitido</option>
          <option value="assinado">Assinado</option>
          <option value="vencido">Vencido</option>
          <option value="suspenso">Suspenso</option>
          <option value="encerrado">Encerrado</option>
          <option value="rascunho">Rascunho</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Contracts Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Título / Assunto</th>
                <th className="py-3 px-4">Contratante</th>
                <th className="py-3 px-4">Emissão</th>
                <th className="py-3 px-4">Versão</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum contrato formal cadastrado.
                  </td>
                </tr>
              ) : (
                filteredContracts.map(ctr => {
                  const cust = customers.find(c => c.id === ctr.customerId);
                  return (
                    <tr key={ctr.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {ctr.documentNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {ctr.title}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{cust?.name || ctr.dynamicValues?.nome_cliente}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{cust?.code}</span>
                          {ctr.branchId && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/40 text-[9px]">
                              {branches.find(b => b.id === ctr.branchId)?.name || 'Filial'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {formatBrDate(ctr.issuedAt)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        v{ctr.version || 1}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            ctr.status === 'ativo' || ctr.status === 'assinado'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : ctr.status === 'vencido'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : ctr.status === 'suspenso'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : ctr.status === 'aguardando_assinatura'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : ctr.status === 'emitido'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {ctr.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setActiveViewingContract(ctr);
                              setPreviewModalOpen(true);
                            }}
                            title="Visualizar e Imprimir"
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => generateContractPdf(ctr, settings.companyName, settings.cnpj)}
                            title="Baixar em PDF Profissional"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
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

      {/* CONTRACT ISSUANCE GENERATOR MODAL */}
      <Modal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        title="Gerador de Contrato Comercial"
        subtitle="Preenchimento dinâmico de cláusulas, valores e dados do assinante"
        maxWidth="5xl"
      >
        <div className="space-y-6">
          {/* Top Form Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cliente Contratante <span className="text-rose-400">*</span>
              </label>
              <select
                value={targetCustomerId}
                onChange={e => handleClientOrPlanChange(e.target.value, targetPlanId, customValue)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Plano Escolhido
              </label>
              <select
                value={targetPlanId}
                onChange={e => {
                  const p = plans.find(plan => plan.id === e.target.value);
                  handleClientOrPlanChange(targetCustomerId, e.target.value, p?.price || customValue);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {formatBRL(p.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor Acertado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={customValue}
                onChange={e => handleClientOrPlanChange(targetCustomerId, targetPlanId, parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modelo de Contrato
              </label>
              <select
                value={selectedTemplateId}
                onChange={e => {
                  setSelectedTemplateId(e.target.value);
                  const cust = customers.find(c => c.id === targetCustomerId);
                  const plan = plans.find(p => p.id === targetPlanId);
                  if (cust) buildContractText(cust, plan, customValue, startDate, firstDueDate, endDate);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  const cust = customers.find(c => c.id === targetCustomerId);
                  const plan = plans.find(p => p.id === targetPlanId);
                  if (cust) buildContractText(cust, plan, customValue, e.target.value, firstDueDate, endDate);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Primeiro Vencimento
              </label>
              <input
                type="date"
                value={firstDueDate}
                onChange={e => {
                  setFirstDueDate(e.target.value);
                  const cust = customers.find(c => c.id === targetCustomerId);
                  const plan = plans.find(p => p.id === targetPlanId);
                  if (cust) buildContractText(cust, plan, customValue, startDate, e.target.value, endDate);
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Título do Documento
              </label>
              <input
                type="text"
                value={contractTitle}
                onChange={e => setContractTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Editor of Contract Clauses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Revisão e Edição de Cláusulas (Campos Dinâmicos Inseridos)
              </label>
              <span className="text-[11px] text-slate-400">
                Você pode personalizar qualquer termo antes da emissão formal.
              </span>
            </div>
            <textarea
              rows={14}
              value={editableBody}
              onChange={e => setEditableBody(e.target.value)}
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-cyan-500 shadow-inner"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveAndIssueContract('rascunho')}
                className="px-4 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl"
              >
                Salvar como Rascunho
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndIssueContract('emitido')}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40"
              >
                Emitir Contrato Oficial
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* CONTRACT PREVIEW & PRINT MODAL */}
      {previewModalOpen && activeViewingContract && (
        <Modal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          title={`Prévia do Contrato: ${activeViewingContract.documentNumber}`}
          subtitle="Formatação oficial A4 com assinaturas e margens profissionais"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pb-3 border-b border-slate-800">
              <button
                onClick={() => printContractDocument('printable-contract-area')}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                Imprimir em Papel A4
              </button>
              <button
                onClick={() => generateContractPdf(activeViewingContract, settings.companyName, settings.cnpj)}
                className="px-3 py-1.5 text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar PDF
              </button>
            </div>

            {/* Printable Document Box */}
            <div
              id="printable-contract-area"
              className="p-8 bg-white text-slate-900 rounded-xl shadow-2xl max-h-[60vh] overflow-y-auto leading-relaxed font-sans text-xs"
            >
              <div className="border-b-2 border-cyan-800 pb-3 mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-950 uppercase">{settings.companyName}</h2>
                  <p className="text-[10px] text-slate-600">CNPJ: {settings.cnpj} — {settings.address}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-cyan-800 block">{activeViewingContract.documentNumber}</span>
                  <span className="text-[10px] text-slate-500">Versão: v{activeViewingContract.version || 1}</span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-center mb-6 uppercase tracking-wide">
                {activeViewingContract.title}
              </h3>

              <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 mb-12">
                {activeViewingContract.content}
              </div>

              {/* Signature Lines */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-center border-t border-slate-300">
                <div>
                  <div className="border-t border-slate-800 pt-1 font-bold text-slate-900 text-xs">
                    {settings.companyName}
                  </div>
                  <div className="text-[10px] text-slate-500">CONTRATADA</div>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-1 font-bold text-slate-900 text-xs">
                    {activeViewingContract.dynamicValues?.nome_cliente || 'CONTRATANTE'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    CPF: {activeViewingContract.dynamicValues?.cpf_cliente}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
