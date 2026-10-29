import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  DollarSign,
  Phone,
  XCircle,
} from 'lucide-react';
import { Invoice, Customer, Plan, PaymentMethod, Payment } from '../../types/index.ts';
import { formatBRL, formatBrDate, getDaysDiff, getTodaySaoPaulo, getReferencePeriod } from '../../lib/date.ts';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface InvoicesViewProps {
  invoices: Invoice[];
  customers: Customer[];
  plans: Plan[];
  pixKey: string;
  onRefresh: () => void;
  onTriggerWhatsApp: (customer: Customer, invoice: Invoice) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  customers,
  plans,
  pixKey,
  onRefresh,
  onTriggerWhatsApp,
}) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // New Invoice Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState(customers[0]?.id || '');
  const [amount, setAmount] = useState<number>(39.9);
  const [dueDate, setDueDate] = useState(getTodaySaoPaulo());
  const [description, setDescription] = useState('Mensalidade de Serviços ONNIX PLAY');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  // Record Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentMethodUsed, setPaymentMethodUsed] = useState<PaymentMethod>('PIX');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // PIX QR Code Modal
  const [pixModalInvoice, setPixModalInvoice] = useState<Invoice | null>(null);

  const canRegisterPayment = isMasterOwner || hasPermission('registrar_pagamentos');
  const canCreateInvoice = isMasterOwner || hasPermission('consultar_cobrancas');

  const filteredInvoices = invoices.filter(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cust?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === targetCustomerId);
    if (!cust) return;

    const invNum = `FAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNum,
      customerId: cust.id,
      amount,
      issueDate: getTodaySaoPaulo(),
      dueDate,
      referencePeriod: getReferencePeriod(dueDate),
      description,
      paymentMethod,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };

    await DatabaseService.saveInvoice(newInv, currentUser?.email || 'sistema');
    setIsCreateModalOpen(false);
    onRefresh();
  };

  const handleOpenPaymentModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    setPaidAmount(inv.amount);
    setTransactionRef(`PIX-${Date.now().toString().slice(-8)}`);
    setPaymentMethodUsed(inv.paymentMethod || 'PIX');
    setPaymentNotes('Baixa manual autorizada por operador financeiro');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    setIsSubmittingPayment(true);
    try {
      const payment: Payment = {
        id: `pay-${Date.now()}`,
        invoiceId: payingInvoice.id,
        customerId: payingInvoice.customerId,
        amount: paidAmount,
        paymentDate: getTodaySaoPaulo(),
        paymentMethod: paymentMethodUsed,
        transactionReference: transactionRef || `REF-${Date.now()}`,
        registeredBy: currentUser?.email || 'sistema',
        notes: paymentNotes,
        createdAt: new Date().toISOString(),
      };

      await DatabaseService.recordPayment(payment, currentUser?.email || 'sistema');
      setPayingInvoice(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Controle de Cobranças & Faturamento
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Emissão de faturas, baixa de pagamentos confirmados e conciliação financeira.
          </p>
        </div>

        {canCreateInvoice && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir Nova Cobrança</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por número da fatura, cliente ou descrição..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="todos">Todos os Status</option>
          <option value="pendente">Pendente</option>
          <option value="paga">Paga</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Fatura</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Referência</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Forma</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const cust = customers.find(c => c.id === inv.customerId);
                  const diff = getDaysDiff(inv.dueDate);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{cust?.name || 'Cliente'}</div>
                        <div className="text-[10px] text-slate-500">{cust?.whatsapp}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {inv.referencePeriod}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            inv.status === 'vencida'
                              ? 'text-rose-400'
                              : diff === 0
                              ? 'text-amber-400 font-bold'
                              : 'text-slate-200'
                          }`}
                        >
                          {formatBrDate(inv.dueDate)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {formatBRL(inv.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            inv.status === 'paga'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : inv.status === 'vencida'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PIX Helper */}
                          <button
                            onClick={() => setPixModalInvoice(inv)}
                            title="Ver Dados de Pagamento / PIX"
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {/* Trigger WhatsApp message */}
                          {cust && (
                            <button
                              onClick={() => onTriggerWhatsApp(cust, inv)}
                              title="Enviar Lembrete WhatsApp"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                          )}

                          {/* Record payment if not paid */}
                          {inv.status !== 'paga' && canRegisterPayment && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              title="Confirmar Pagamento e Dar Baixa"
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Baixa</span>
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

      {/* CREATE INVOICE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Emitir Nova Fatura / Cobrança"
        subtitle="Geração manual de cobrança avulsa ou proporcional"
        maxWidth="md"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Cliente <span className="text-rose-400">*</span>
            </label>
            <select
              value={targetCustomerId}
              onChange={e => setTargetCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor Devido (R$) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data de Vencimento <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Forma de Cobrança
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartão">Cartão</option>
              <option value="Transferência">Transferência</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descrição / Histórico
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-md"
            >
              Emitir Fatura
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      {payingInvoice && (
        <Modal
          isOpen={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          title={`Confirmar Baixa: ${payingInvoice.invoiceNumber}`}
          subtitle="Registro de pagamento com prevenção contra duplicidade"
          maxWidth="md"
        >
          <form onSubmit={handleConfirmPayment} className="space-y-4">
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Fatura:</span>
                <span className="font-mono font-bold text-white">{payingInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Original:</span>
                <span className="font-bold text-white">{formatBRL(payingInvoice.amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Valor Efetivamente Recebido (R$) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paidAmount}
                  onChange={e => setPaidAmount(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Meio de Pagamento
                </label>
                <select
                  value={paymentMethodUsed}
                  onChange={e => setPaymentMethodUsed(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Referência da Transação / Comprovante <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="Ex: E18239019283921829038102 ou autenticação bancária"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observações da Baixa
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md disabled:opacity-50"
              >
                {isSubmittingPayment ? 'Registrando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PIX DETAILS MODAL */}
      {pixModalInvoice && (
        <Modal
          isOpen={Boolean(pixModalInvoice)}
          onClose={() => setPixModalInvoice(null)}
          title={`Dados PIX: ${pixModalInvoice.invoiceNumber}`}
          subtitle="Chave para pagamento e instrução bancária"
          maxWidth="sm"
        >
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
              <QrCode className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor da Cobrança</span>
              <span className="text-2xl font-black text-white">{formatBRL(pixModalInvoice.amount)}</span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Chave PIX da Empresa</span>
              <span className="font-mono text-xs text-cyan-300 font-bold select-all block break-all">
                {pixKey}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Oriente o cliente a enviar o comprovante com a referência <strong>{pixModalInvoice.invoiceNumber}</strong>.
            </p>

            <button
              onClick={() => {
                navigator.clipboard.writeText(pixKey);
                alert('Chave PIX copiada para a área de transferência!');
              }}
              className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
            >
              Copiar Chave PIX
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
