import React, { useState, useMemo } from 'react';
import { Commission, Partner, Customer, Invoice, CommissionStatus } from '../../types/index.ts';
import { formatBRL, formatBrDate } from '../../lib/date.ts';
import { DollarSign, CheckCircle2, RotateCcw, Download, Filter, Search } from 'lucide-react';
import { exportToCsv } from '../../lib/export.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface CommissionsViewProps {
  commissions: Commission[];
  partners: Partner[];
  customers: Customer[];
  invoices: Invoice[];
  onRefresh: () => void;
}

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  commissions,
  partners,
  customers,
  invoices,
  onRefresh,
}) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [partnerFilter, setPartnerFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  const canManage = isMasterOwner || hasPermission('consultar_comissoes');

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const matchPartner = partnerFilter === 'todos' || c.partnerId === partnerFilter;
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
      return matchPartner && matchStatus;
    });
  }, [commissions, partnerFilter, statusFilter]);

  const totalCalculated = commissions
    .filter(c => c.status === 'calculada' || c.status === 'aprovada')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paga')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const handleUpdateStatus = async (id: string, status: CommissionStatus) => {
    await DatabaseService.updateCommissionStatus(id, status, currentUser?.email || 'sistema');
    onRefresh();
  };

  const handleExportCsv = () => {
    const rows = filteredCommissions.map(c => {
      const partner = partners.find(p => p.id === c.partnerId);
      const cust = customers.find(cust => cust.id === c.customerId);
      return {
        ID_Comissao: c.id,
        Parceiro: partner?.name || 'Parceiro',
        CodigoParceiro: partner?.code || '',
        ClienteIndicado: cust?.name || '',
        FaturaOrigem: c.invoiceId,
        ValorPagamentoElegivel: formatBRL(c.eligiblePaymentAmount),
        ValorComissao: formatBRL(c.commissionAmount),
        Status: c.status,
        DataCalculo: formatBrDate(c.calculationDate),
        DataPagamento: c.paidDate ? formatBrDate(c.paidDate) : '',
      };
    });
    exportToCsv('relatorio_comissoes_parceiros', rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Comissões Recorrentes de Afiliados
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cálculo automatizado sobre pagamentos confirmados e fluxo de aprovação e repasse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">A Pagar</span>
            <span className="text-xs font-black text-amber-400">{formatBRL(totalCalculated)}</span>
          </div>

          <div className="px-3 py-1.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Pago</span>
            <span className="text-xs font-black text-emerald-400">{formatBRL(totalPaid)}</span>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />
        <select
          value={partnerFilter}
          onChange={e => setPartnerFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="todos">Todos os Parceiros</option>
          {partners.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="todos">Todos os Status</option>
          <option value="calculada">Calculada</option>
          <option value="aprovada">Aprovada</option>
          <option value="paga">Paga</option>
          <option value="estornada">Estornada</option>
        </select>
      </div>

      {/* Commissions Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Parceiro</th>
                <th className="py-3 px-4">Cliente Indicado</th>
                <th className="py-3 px-4">Valor Base Pago</th>
                <th className="py-3 px-4">Comissão Devida</th>
                <th className="py-3 px-4">Cálculo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações de Repasse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhuma comissão registrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredCommissions.map(comm => {
                  const partner = partners.find(p => p.id === comm.partnerId);
                  const cust = customers.find(c => c.id === comm.customerId);

                  return (
                    <tr key={comm.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{partner?.name || 'Parceiro'}</div>
                        <div className="text-[10px] text-cyan-400 font-mono">{partner?.code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{cust?.name || 'Cliente'}</div>
                        <div className="text-[10px] text-slate-500">{cust?.code}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatBRL(comm.eligiblePaymentAmount)}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {formatBRL(comm.commissionAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {formatBrDate(comm.calculationDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            comm.status === 'paga'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : comm.status === 'aprovada'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : comm.status === 'estornada'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {comm.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {comm.status === 'calculada' && canManage && (
                            <button
                              onClick={() => handleUpdateStatus(comm.id, 'aprovada')}
                              className="px-2 py-1 text-[11px] font-semibold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 rounded-lg"
                            >
                              Aprovar
                            </button>
                          )}
                          {comm.status === 'aprovada' && canManage && (
                            <button
                              onClick={() => handleUpdateStatus(comm.id, 'paga')}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg shadow-sm"
                            >
                              Confirmar Pgto
                            </button>
                          )}
                          {comm.status !== 'estornada' && isMasterOwner && (
                            <button
                              onClick={() => handleUpdateStatus(comm.id, 'estornada')}
                              title="Estornar comissão"
                              className="p-1 text-slate-500 hover:text-rose-400 rounded"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
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
  );
};
