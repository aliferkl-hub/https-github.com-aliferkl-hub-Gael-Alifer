import React, { useState, useMemo } from 'react';
import { Invoice, Customer, Plan, Partner, EmployeeProfile } from '../../types/index.ts';
import { formatBRL, formatBrDate, getDaysDiff, getTodaySaoPaulo } from '../../lib/date.ts';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Phone,
  Filter,
} from 'lucide-react';

interface DueDatesCalendarProps {
  invoices: Invoice[];
  customers: Customer[];
  plans: Plan[];
  partners: Partner[];
  employees: EmployeeProfile[];
  onOpenCustomer: (customer: Customer) => void;
  onTriggerWhatsApp: (customer: Customer, invoice: Invoice) => void;
}

export const DueDatesCalendar: React.FC<DueDatesCalendarProps> = ({
  invoices,
  customers,
  plans,
  partners,
  employees,
  onOpenCustomer,
  onTriggerWhatsApp,
}) => {
  const today = getTodaySaoPaulo();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState<
    'todos' | 'hoje' | 'amanha' | 'd2' | '7dias' | 'vencidas'
  >('todos');

  // Month & year computation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Group invoices by day in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekDay = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Filtered invoices list based on quick filters
  const filteredList = useMemo(() => {
    return invoices.filter(inv => {
      const diff = getDaysDiff(inv.dueDate, today);
      if (selectedFilter === 'hoje') return diff === 0;
      if (selectedFilter === 'amanha') return diff === 1;
      if (selectedFilter === 'd2') return diff === 2;
      if (selectedFilter === '7dias') return diff >= 0 && diff <= 7;
      if (selectedFilter === 'vencidas') return inv.status === 'vencida';
      return true;
    });
  }, [invoices, selectedFilter, today]);

  // Calendar Day cell computation
  const calendarCells = useMemo(() => {
    const cells: { day: number; dateStr: string; items: Invoice[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dayInvoices = invoices.filter(inv => inv.dueDate === dateStr);
      cells.push({ day: d, dateStr, items: dayInvoices });
    }
    return cells;
  }, [invoices, year, month, daysInMonth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Calendário de Vencimentos & Lembretes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Visão temporal com alertas para Hoje, Amanhã, D-2 e faturas vencidas em atraso.
          </p>
        </div>

        {/* Quick status filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0b1222] border border-cyan-500/20 p-1.5 rounded-xl">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'hoje', label: 'Hoje' },
            { key: 'amanha', label: 'Amanhã' },
            { key: 'd2', label: 'D-2 (Lembretes)' },
            { key: '7dias', label: 'Próximos 7 Dias' },
            { key: 'vencidas', label: 'Vencidas' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedFilter === f.key
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month Navigator */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white capitalize">
            {monthNames[month]} {year}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-cyan-400 border border-slate-800"
          >
            Mês Atual
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Calendar Days */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold text-slate-400 uppercase">
          <div className="py-1">Dom</div>
          <div className="py-1">Seg</div>
          <div className="py-1">Ter</div>
          <div className="py-1">Qua</div>
          <div className="py-1">Qui</div>
          <div className="py-1">Sex</div>
          <div className="py-1">Sáb</div>
        </div>

        {/* Days cells */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty spacer cells for beginning of month */}
          {Array.from({ length: firstDayWeekDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[85px] rounded-xl bg-slate-950/30 border border-transparent" />
          ))}

          {/* Calendar day cells */}
          {calendarCells.map(cell => {
            const isToday = cell.dateStr === today;
            const diffFromToday = getDaysDiff(cell.dateStr, today);
            const isD2 = diffFromToday === 2;

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[85px] p-2 rounded-xl border flex flex-col justify-between transition-colors ${
                  isToday
                    ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/30'
                    : isD2
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isToday
                        ? 'text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded-full'
                        : isD2
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {cell.items.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded-full">
                      {cell.items.length} fat.
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-1 overflow-y-auto max-h-[50px] custom-scrollbar">
                  {cell.items.map(item => {
                    const cust = customers.find(c => c.id === item.customerId);
                    return (
                      <div
                        key={item.id}
                        onClick={() => cust && onOpenCustomer(cust)}
                        title={`${cust?.name || 'Cliente'} - ${formatBRL(item.amount)} (${item.status})`}
                        className={`text-[9px] p-1 rounded font-semibold truncate cursor-pointer transition-colors ${
                          item.status === 'paga'
                            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-900/40'
                            : item.status === 'vencida'
                            ? 'bg-rose-950/50 text-rose-300 border border-rose-500/20 hover:bg-rose-900/40'
                            : 'bg-amber-950/50 text-amber-300 border border-amber-500/20 hover:bg-amber-900/40'
                        }`}
                      >
                        {cust?.name.split(' ')[0]}: {formatBRL(item.amount)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtered Invoices List under Calendar */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
          <span>Detalhamento dos Vencimentos Selecionados ({filteredList.length})</span>
          <span className="text-xs font-normal text-slate-400 capitalize">Filtro: {selectedFilter}</span>
        </h3>

        {filteredList.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum vencimento correspondente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Fatura</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Vencimento</th>
                  <th className="py-2.5 px-3">Valor</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ação Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredList.map(inv => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  const diff = getDaysDiff(inv.dueDate, today);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {cust?.name || 'Cliente'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            diff < 0
                              ? 'text-rose-400'
                              : diff === 0
                              ? 'text-amber-400 font-bold'
                              : diff === 2
                              ? 'text-cyan-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {formatBrDate(inv.dueDate)}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5">
                          {diff === 0 ? '(Hoje)' : diff === 1 ? '(Amanhã)' : diff === 2 ? '(D-2)' : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {formatBRL(inv.amount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inv.status === 'paga'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : inv.status === 'vencida'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {cust && (
                            <button
                              onClick={() => onTriggerWhatsApp(cust, inv)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </div>
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
