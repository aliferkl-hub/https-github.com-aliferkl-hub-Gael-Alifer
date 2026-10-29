import React, { useState } from 'react';
import { Payment, Customer, Invoice } from '../../types/index.ts';
import { formatBRL, formatBrDate } from '../../lib/date.ts';
import { CheckCircle2, Search, Filter, Download, Receipt, ShieldCheck } from 'lucide-react';
import { exportToCsv } from '../../lib/export.ts';
import { Modal } from '../common/Modal.tsx';

interface PaymentsViewProps {
  payments: Payment[];
  customers: Customer[];
  invoices: Invoice[];
  onRefresh: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ payments, customers, invoices }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const filteredPayments = payments.filter(pay => {
    const cust = customers.find(c => c.id === pay.customerId);
    const matchSearch =
      pay.transactionReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cust?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      pay.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const totalReceived = filteredPayments.reduce((acc, p) => acc + p.amount, 0);

  const handleExportCsv = () => {
    const rows = filteredPayments.map(p => {
      const cust = customers.find(c => c.id === p.customerId);
      return {
        ID_Pagamento: p.id,
        Fatura: p.invoiceId,
        Cliente: cust?.name || 'Cliente',
        Valor: formatBRL(p.amount),
        DataPagamento: formatBrDate(p.paymentDate),
        Metodo: p.paymentMethod,
        Transacao: p.transactionReference,
        Operador: p.registeredBy,
        Observacoes: p.notes || '',
      };
    });
    exportToCsv('relatorio_pagamentos_confirmados', rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Registro de Pagamentos Confirmados
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Histórico auditável de receitas liquidadas, referências de transação e operadores responsáveis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Liquidado</span>
            <span className="text-sm font-black text-emerald-400">{formatBRL(totalReceived)}</span>
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

      {/* Filter and Search */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por referência bancária, cliente ou método de pagamento..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Referência Transação</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Data Pagamento</th>
                <th className="py-3 px-4">Valor Recebido</th>
                <th className="py-3 px-4">Forma</th>
                <th className="py-3 px-4">Operador Responsável</th>
                <th className="py-3 px-4 text-right">Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum pagamento registrado no período.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(pay => {
                  const cust = customers.find(c => c.id === pay.customerId);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        {pay.transactionReference}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{cust?.name || 'Cliente'}</div>
                        <div className="text-[10px] text-slate-500">{cust?.code}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {formatBrDate(pay.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {formatBRL(pay.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                          {pay.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {pay.registeredBy}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedPayment(pay)}
                          className="px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 rounded-lg flex items-center gap-1 ml-auto"
                        >
                          <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Recibo</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {selectedPayment && (
        <Modal
          isOpen={Boolean(selectedPayment)}
          onClose={() => setSelectedPayment(null)}
          title="Recibo Eletrônico de Pagamento"
          subtitle="Comprovante de quitação emitido pela ONNIX PLAY"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-6 bg-white text-slate-900 rounded-xl shadow-lg text-xs font-sans leading-relaxed">
              <div className="border-b-2 border-emerald-600 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-slate-900">ONNIX PLAY</h3>
                  <p className="text-[10px] text-slate-500">Comprovante de Quitação</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">ID da Transação:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedPayment.transactionReference}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-900">
                    {customers.find(c => c.id === selectedPayment.customerId)?.name || 'Cliente'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Data de Liquidação:</span>
                  <span>{formatBrDate(selectedPayment.paymentDate)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Forma de Pagamento:</span>
                  <span>{selectedPayment.paymentMethod}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Operador Autorizador:</span>
                  <span>{selectedPayment.registeredBy}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-700 font-bold text-sm">Valor Pago:</span>
                  <span className="text-emerald-700 font-black text-base">{formatBRL(selectedPayment.amount)}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-500 text-center">
                Este recibo confirma a quitação do valor acordado junto à ONNIX PLAY.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
