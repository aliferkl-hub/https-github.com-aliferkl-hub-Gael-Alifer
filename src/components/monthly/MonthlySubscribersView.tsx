import React, { useState } from 'react';
import { Customer, Subscription, Plan, Invoice } from '../../types/index.ts';
import { formatBRL, formatBrDate, getDaysDiff, getTodaySaoPaulo } from '../../lib/date.ts';
import { CalendarDays, Filter, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DatabaseService } from '../../lib/db.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface MonthlySubscribersViewProps {
  customers: Customer[];
  subscriptions: Subscription[];
  plans: Plan[];
  invoices: Invoice[];
  onRefresh: () => void;
}

export const MonthlySubscribersView: React.FC<MonthlySubscribersViewProps> = ({
  customers,
  subscriptions,
  plans,
  invoices,
  onRefresh,
}) => {
  const { currentUser } = useAuth();
  const [cycleFilter, setCycleFilter] = useState<string>('todos');
  const today = getTodaySaoPaulo();

  const filteredSubs = subscriptions.filter(s => {
    if (cycleFilter !== 'todos' && s.billingCycle !== cycleFilter) return false;
    return true;
  });

  const totalMonthlyValue = filteredSubs
    .filter(s => s.status === 'ativa')
    .reduce((acc, s) => acc + s.contractValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Gestão de Mensalistas & Recorrência
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhamento contínuo dos ciclos contratuais, periodicidades e renovações automáticas.
          </p>
        </div>

        <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Receita Contratada Ativa
            </span>
            <span className="text-sm font-extrabold text-white">{formatBRL(totalMonthlyValue)}</span>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-3">
        <Filter className="w-4 h-4 text-slate-400 ml-2" />
        <span className="text-xs font-semibold text-slate-400 mr-2">Periodicidade:</span>
        {(['todos', 'mensal', 'trimestral', 'semestral', 'anual'] as const).map(cycle => (
          <button
            key={cycle}
            onClick={() => setCycleFilter(cycle)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
              cycleFilter === cycle
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {cycle}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Assinante</th>
                <th className="py-3 px-4">Plano Contratado</th>
                <th className="py-3 px-4">Valor Recorrente</th>
                <th className="py-3 px-4">Periodicidade</th>
                <th className="py-3 px-4">Início Contrato</th>
                <th className="py-3 px-4">Próximo Vencimento</th>
                <th className="py-3 px-4">Renovação</th>
                <th className="py-3 px-4">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhuma assinatura ativa encontrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredSubs.map(sub => {
                  const cust = customers.find(c => c.id === sub.customerId);
                  const plan = plans.find(p => p.id === sub.planId);
                  const diff = getDaysDiff(sub.nextDueDate, today);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{cust?.name || 'Assinante'}</div>
                        <div className="text-[11px] text-slate-500">{cust?.whatsapp || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-cyan-300">
                        {plan?.name || 'Plano Personalizado'}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {formatBRL(sub.contractValue)}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                          {sub.billingCycle}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {formatBrDate(sub.startDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            diff < 0
                              ? 'text-rose-400'
                              : diff <= 3
                              ? 'text-amber-400'
                              : 'text-slate-200'
                          }`}
                        >
                          {formatBrDate(sub.nextDueDate)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {diff < 0 ? `${Math.abs(diff)} dias em atraso` : `em ${diff} dias`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          {sub.autoRenew ? 'Automática' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            sub.status === 'ativa'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {sub.status}
                        </span>
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
  );
};
