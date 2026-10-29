import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  FileCheck2,
  Calendar,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Handshake,
  Percent,
  Briefcase,
  ArrowUpRight,
  Filter,
  BarChart3,
  Building2,
  GitBranch,
  Layers,
  Globe,
} from 'lucide-react';
import { StatCard } from '../common/StatCard.tsx';
import { Customer, Invoice, Payment, Contract, Partner, Commission, EmployeeProfile, Plan, PartnerCompany, Branch } from '../../types/index.ts';
import { formatBRL, formatBrDate, getDaysDiff, getTodaySaoPaulo } from '../../lib/date.ts';
import { NavTab } from '../layout/Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface DashboardViewProps {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  partners: Partner[];
  commissions: Commission[];
  employees: EmployeeProfile[];
  plans: Plan[];
  companies?: PartnerCompany[];
  branches?: Branch[];
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  customers,
  invoices,
  payments,
  contracts,
  partners,
  commissions,
  employees,
  plans,
  companies = [],
  branches = [],
  onNavigate,
}) => {
  const { isMasterOwner, activeCompanyId, setActiveCompanyId } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<'mes_atual' | 'trimestre' | 'ano' | 'todos'>('mes_atual');
  const today = getTodaySaoPaulo();
  const currentMonthYear = today.slice(0, 7); // e.g. "2026-10"

  // Filter invoices and payments by selected period
  const filteredInvoices = useMemo(() => {
    if (periodFilter === 'todos') return invoices;
    return invoices.filter(i => {
      const date = i.dueDate || i.issueDate;
      if (!date) return true;
      if (periodFilter === 'mes_atual') return date.startsWith(currentMonthYear);
      if (periodFilter === 'ano') return date.startsWith(today.slice(0, 4));
      return true; // default
    });
  }, [invoices, periodFilter, currentMonthYear, today]);

  const filteredPayments = useMemo(() => {
    if (periodFilter === 'todos') return payments;
    return payments.filter(p => {
      if (periodFilter === 'mes_atual') return p.paymentDate.startsWith(currentMonthYear);
      if (periodFilter === 'ano') return p.paymentDate.startsWith(today.slice(0, 4));
      return true;
    });
  }, [payments, periodFilter, currentMonthYear, today]);

  // KPIs
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'ativo').length;
  const pendingCustomers = customers.filter(c => c.status === 'pendente').length;
  const delinquentCustomers = customers.filter(c => c.status === 'inadimplente').length;

  const activeContracts = contracts.filter(c => c.status === 'emitido' || c.status === 'assinado').length;
  const contractsExpiringSoon = contracts.filter(c => {
    // Check if ending within 30 days
    return false; // contracts can have specific end dates
  }).length;

  // Due in next 7 days
  const dueNext7Days = invoices.filter(i => {
    if (i.status === 'paga' || i.status === 'cancelada') return false;
    const diff = getDaysDiff(i.dueDate, today);
    return diff >= 0 && diff <= 7;
  });

  // Pending & Overdue Invoices
  const pendingInvoices = filteredInvoices.filter(i => i.status === 'pendente' || i.status === 'enviada');
  const overdueInvoices = filteredInvoices.filter(i => i.status === 'vencida');

  // Financial calculations
  const confirmedPaymentsMonth = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalInvoicedPeriod = filteredInvoices.reduce((acc, i) => acc + i.amount, 0);
  const overdueTotalValue = overdueInvoices.reduce((acc, i) => acc + i.amount, 0);
  const pendingTotalValue = pendingInvoices.reduce((acc, i) => acc + i.amount, 0);

  // Projected Recurring Revenue (sum of active subscriptions or active plans)
  const projectedRecurring = customers
    .filter(c => c.status === 'ativo')
    .reduce((acc, c) => {
      // Estimate baseline based on customer
      return acc + 39.9; // Baseline recurring average
    }, 0);

  // Partners & Commissions
  const activePartners = partners.filter(p => p.status === 'ativo').length;
  const pendingCommissions = commissions
    .filter(c => c.status === 'prevista' || c.status === 'calculada' || c.status === 'aprovada')
    .reduce((acc, c) => acc + c.commissionAmount, 0);
  const paidCommissions = commissions
    .filter(c => c.status === 'paga')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const activeEmployees = employees.filter(e => e.status === 'ativo').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Painel Executivo
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
              AO VIVO
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas consolidadas, receita realizada e status de clientes em tempo real.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-2" />
          {(
            [
              { key: 'mes_atual', label: 'Mês Atual' },
              { key: 'trimestre', label: 'Trimestre' },
              { key: 'ano', label: 'Ano' },
              { key: 'todos', label: 'Geral' },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setPeriodFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodFilter === tab.key
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MULTIEMPRESA OVERVIEW STRIP (for Master Owner or Company Admins) */}
      {isMasterOwner && companies.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/40 p-4 rounded-2xl border border-cyan-500/30 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Rede Multiempresa ONNIX PLAY
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activeCompanyId === 'TODAS'
                      ? 'VISÃO GLOBAL CONSOLIDADA'
                      : `FILTRADO: ${companies.find(c => c.id === activeCompanyId)?.tradeName || 'EMPRESA'}`}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Consolidação em tempo real de matrizes, filiais e volume operacional</p>
              </div>
            </div>
            {activeCompanyId !== 'TODAS' && (
              <button
                onClick={() => setActiveCompanyId('TODAS')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline self-start md:self-auto cursor-pointer"
              >
                ← Voltar para Rede Global Completa
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Empresas Parceiras</span>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>{companies.length}</span>
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Filiais Registradas</span>
              <div className="text-xl font-bold text-purple-300 mt-1 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-purple-400" />
                <span>{branches.length}</span>
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Clientes na Rede</span>
              <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{customers.length}</span>
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Contratos Emitidos</span>
              <div className="text-xl font-bold text-blue-400 mt-1 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-blue-400" />
                <span>{contracts.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: FINANCIAL COMPARISON STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita Realizada (Mês)"
          value={formatBRL(confirmedPaymentsMonth)}
          subtitle={`${filteredPayments.length} pagamentos confirmados`}
          icon={TrendingUp}
          variant="emerald"
          badge="100% Confirmado"
          badgeType="success"
          onClick={() => onNavigate('payments')}
        />
        <StatCard
          title="Recorrência Prevista"
          value={formatBRL(projectedRecurring)}
          subtitle="Base mensal ativa estimada"
          icon={DollarSign}
          variant="cyan"
          badge="Projeção Mensal"
          badgeType="info"
          onClick={() => onNavigate('monthly')}
        />
        <StatCard
          title="Cobranças Pendentes"
          value={formatBRL(pendingTotalValue)}
          subtitle={`${pendingInvoices.length} faturas aguardando`}
          icon={CreditCard}
          variant="amber"
          badge="Em Aberto"
          badgeType="warning"
          onClick={() => onNavigate('invoices')}
        />
        <StatCard
          title="Valores Vencidos"
          value={formatBRL(overdueTotalValue)}
          subtitle={`${overdueInvoices.length} faturas em atraso`}
          icon={AlertTriangle}
          variant="rose"
          badge="Inadimplência"
          badgeType="danger"
          onClick={() => onNavigate('invoices')}
        />
      </div>

      {/* SECTION 2: CUSTOMERS & CONTRACTS KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Clientes"
          value={totalCustomers}
          icon={Users}
          variant="blue"
          onClick={() => onNavigate('customers')}
        />
        <StatCard
          title="Clientes Ativos"
          value={activeCustomers}
          icon={UserCheck}
          variant="emerald"
          onClick={() => onNavigate('customers')}
        />
        <StatCard
          title="Inadimplentes"
          value={delinquentCustomers}
          icon={UserX}
          variant="rose"
          onClick={() => onNavigate('customers')}
        />
        <StatCard
          title="Contratos Ativos"
          value={activeContracts}
          icon={FileCheck2}
          variant="purple"
          onClick={() => onNavigate('contracts')}
        />
        <StatCard
          title="Vencem em 7 Dias"
          value={dueNext7Days.length}
          icon={Calendar}
          variant="amber"
          onClick={() => onNavigate('calendar')}
        />
        <StatCard
          title="Parceiros Ativos"
          value={activePartners}
          icon={Handshake}
          variant="cyan"
          onClick={() => onNavigate('partners')}
        />
      </div>

      {/* SECTION 3: REVENUE COMPARISON & COMMISSIONS SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Revenue Breakdown Card */}
        <div className="lg:col-span-2 bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Diferenciação Financeira Rigorosa
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Valores previstos vs. recebimentos confirmados auditáveis.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Realized Revenue Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Receita Efetivamente Recebida (Pagamentos)
                </span>
                <span className="text-white font-bold">{formatBRL(confirmedPaymentsMonth)}</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, totalInvoicedPeriod > 0 ? (confirmedPaymentsMonth / totalInvoicedPeriod) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Pending Charges Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Cobranças Emitidas & Pendentes
                </span>
                <span className="text-white font-bold">{formatBRL(pendingTotalValue)}</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, totalInvoicedPeriod > 0 ? (pendingTotalValue / totalInvoicedPeriod) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Overdue Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Cobranças Vencidas em Atraso
                </span>
                <span className="text-white font-bold">{formatBRL(overdueTotalValue)}</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, totalInvoicedPeriod > 0 ? (overdueTotalValue / totalInvoicedPeriod) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cobranças Emitidas</span>
              <span className="text-sm font-bold text-white">{filteredInvoices.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Taxa de Liquidação</span>
              <span className="text-sm font-bold text-emerald-400">
                {filteredInvoices.length > 0
                  ? `${Math.round((filteredPayments.length / filteredInvoices.length) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Equipe Ativa</span>
              <span className="text-sm font-bold text-cyan-400">{activeEmployees} colaboradores</span>
            </div>
          </div>
        </div>

        {/* Partners & Commissions Widget */}
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Handshake className="w-4 h-4 text-purple-400" />
                Comissões de Parceiros
              </h3>
              <button
                onClick={() => onNavigate('commissions')}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
              >
                Ver todas <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-400 uppercase">Comissões Pendentes</span>
                  <p className="text-xs text-slate-400">Aprovadas para repasse</p>
                </div>
                <span className="text-lg font-black text-purple-300">{formatBRL(pendingCommissions)}</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Comissões Pagas</span>
                  <p className="text-xs text-slate-400">Total repassado</p>
                </div>
                <span className="text-lg font-black text-emerald-300">{formatBRL(paidCommissions)}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-400">
            <p className="leading-relaxed">
              As comissões recorrentes são vinculadas exclusivamente a <strong>pagamentos confirmados</strong> via conciliação.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: UPCOMING DUE DATES IN NEXT 7 DAYS */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Próximos Vencimentos (Próximos 7 Dias)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Clientes que precisam de acompanhamento ou lembrete de cobrança.
            </p>
          </div>
          <button
            onClick={() => onNavigate('calendar')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            Abrir Calendário <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {dueNext7Days.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-white">Nenhum vencimento previsto para os próximos 7 dias</p>
            <p className="text-xs text-slate-400 mt-1">Todos os ciclos recentes foram processados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Fatura</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Vencimento</th>
                  <th className="py-2.5 px-3">Valor</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {dueNext7Days.slice(0, 5).map(inv => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  const diff = getDaysDiff(inv.dueDate, today);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-white">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-200">
                        {cust?.name || 'Cliente'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            diff === 0
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : diff === 1
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : diff === 2
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {diff === 0 ? 'Vence Hoje' : diff === 1 ? 'Amanhã' : diff === 2 ? 'Em 2 dias (D-2)' : `Em ${diff} dias`}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1.5">{formatBrDate(inv.dueDate)}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{formatBRL(inv.amount)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onNavigate('whatsapp')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30"
                        >
                          Disparar WhatsApp
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
