import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Customer, Contract, Invoice, Subscription, Plan } from '../../types/index.ts';
import { formatCpf, maskCpf } from '../../lib/cpf.ts';
import { formatBRL, formatBrDate } from '../../lib/date.ts';
import { generateWhatsAppLink, WhatsAppTemplates } from '../../lib/whatsapp.ts';
import {
  MessageSquare,
  FileSignature,
  CreditCard,
  Eye,
  EyeOff,
  MapPin,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  contracts: Contract[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  plans: Plan[];
  onOpenContractGenerator: (customer: Customer) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  isOpen,
  onClose,
  customer,
  contracts,
  invoices,
  subscriptions,
  plans,
  onOpenContractGenerator,
}) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [revealCpf, setRevealCpf] = useState(false);
  const [customMsgModal, setCustomMsgModal] = useState(false);
  const [preparedText, setPreparedText] = useState('');
  const [msgTitle, setMsgTitle] = useState('');

  if (!customer) return null;

  const canRevealCpf = isMasterOwner || hasPermission('consultar_clientes');
  const customerContracts = contracts.filter(c => c.customerId === customer.id);
  const customerInvoices = invoices.filter(i => i.customerId === customer.id);
  const customerSubs = subscriptions.filter(s => s.customerId === customer.id && s.status === 'ativa');

  // Trigger WhatsApp actions
  const openPreparedMessage = (title: string, text: string) => {
    setMsgTitle(title);
    setPreparedText(text);
    setCustomMsgModal(true);
  };

  const handleSendWhatsApp = async () => {
    const link = generateWhatsAppLink(customer.whatsapp, preparedText);
    window.open(link, '_blank');

    // Register log
    await DatabaseService.logMessage(
      {
        id: `msg-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.whatsapp,
        messageType: 'livre',
        channel: 'whatsapp_click',
        content: preparedText,
        status: 'enviada',
        sentAt: new Date().toISOString(),
        sentBy: currentUser?.email || 'sistema',
        createdAt: new Date().toISOString(),
      },
      currentUser?.email || 'sistema'
    );

    setCustomMsgModal(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer.name} (${customer.code})`}
      subtitle="Ficha Cadastral Completa, Contratos e Histórico Financeiro"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Top Status & WhatsApp 1-Click Action Bar */}
        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                customer.status === 'ativo'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : customer.status === 'inadimplente'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {customer.status}
            </span>
            <span className="text-xs text-slate-400">
              Cadastrado em: <strong>{formatBrDate(customer.registrationDate)}</strong>
            </span>
          </div>

          {/* Quick WhatsApp Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const sub = customerSubs[0];
                const plan = plans.find(p => p.id === sub?.planId);
                const text = WhatsAppTemplates.lembreteVencimento({
                  customerName: customer.name.split(' ')[0],
                  amount: sub?.contractValue || 39.9,
                  dueDate: sub?.nextDueDate || 'em breve',
                });
                openPreparedMessage('Lembrete de Vencimento', text);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              Lembrar Vencimento
            </button>

            <button
              onClick={() => {
                const text = WhatsAppTemplates.cobrancaVencida({
                  customerName: customer.name.split(' ')[0],
                });
                openPreparedMessage('Cobrança Vencida', text);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-rose-400" />
              Cobrança Vencida
            </button>

            <button
              onClick={() => {
                const text = WhatsAppTemplates.contratoDisponivel({
                  customerName: customer.name.split(' ')[0],
                });
                openPreparedMessage('Contrato Disponível', text);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition-colors"
            >
              <FileSignature className="w-3.5 h-3.5 text-purple-400" />
              Enviar Contrato
            </button>
          </div>
        </div>

        {/* SECTION 1: PERSONAL & CONTACT DATA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Dados Pessoais & Documentos
            </h4>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Nome:</span>
                <span className="font-semibold text-white">{customer.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60 items-center">
                <span className="text-slate-400">CPF:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">
                    {revealCpf && canRevealCpf ? formatCpf(customer.cpf) : maskCpf(customer.cpf)}
                  </span>
                  {canRevealCpf && (
                    <button
                      onClick={() => setRevealCpf(!revealCpf)}
                      title={revealCpf ? 'Ocultar CPF' : 'Revelar CPF (Autorizado)'}
                      className="text-slate-400 hover:text-cyan-400"
                    >
                      {revealCpf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">WhatsApp:</span>
                <span className="font-mono font-bold text-emerald-400">{customer.whatsapp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">E-mail:</span>
                <span>{customer.email || 'Não informado'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Origem:</span>
                <span>{customer.source}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: ENDEREÇO DA RESIDÊNCIA */}
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereço Residencial
            </h4>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Logradouro:</span>
                <span className="font-semibold text-white">
                  {customer.street}, Nº {customer.number}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Complemento:</span>
                <span>{customer.complement || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Bairro / Cidade:</span>
                <span>
                  {customer.neighborhood} — {customer.city}/{customer.state}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">CEP:</span>
                <span className="font-mono">{customer.cep}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Referência:</span>
                <span className="text-slate-400 italic">{customer.reference || 'Nenhuma'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: CONTRATOS DO CLIENTE */}
        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <FileSignature className="w-4 h-4" /> Contratos Emitidos
            </h4>
            <button
              onClick={() => onOpenContractGenerator(customer)}
              className="px-2.5 py-1 text-xs font-bold bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 rounded-lg flex items-center gap-1"
            >
              Emitir Novo Contrato
            </button>
          </div>

          {customerContracts.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">Nenhum contrato formal emitido ainda.</p>
          ) : (
            <div className="space-y-2">
              {customerContracts.map(ctr => (
                <div
                  key={ctr.id}
                  className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{ctr.title}</span>
                    <span className="text-slate-400 text-[11px]">
                      Doc: {ctr.documentNumber} | Emissão: {formatBrDate(ctr.issuedAt)} | Versão: v{ctr.version}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      ctr.status === 'assinado'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {ctr.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 4: HISTÓRICO FINANCEIRO (COBRANÇAS) */}
        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Faturas e Cobranças
          </h4>

          {customerInvoices.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">Nenhuma fatura registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Fatura</th>
                    <th className="py-2 px-3">Vencimento</th>
                    <th className="py-2 px-3">Valor</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Pago em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {customerInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="py-2 px-3 font-semibold text-white">{inv.invoiceNumber}</td>
                      <td className="py-2 px-3">{formatBrDate(inv.dueDate)}</td>
                      <td className="py-2 px-3 font-bold text-white">{formatBRL(inv.amount)}</td>
                      <td className="py-2 px-3">
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
                      <td className="py-2 px-3 text-slate-400">
                        {inv.paidDate ? formatBrDate(inv.paidDate) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SUB-MODAL: REVIEW AND SEND PREPARED WHATSAPP MESSAGE */}
      {customMsgModal && (
        <Modal
          isOpen={customMsgModal}
          onClose={() => setCustomMsgModal(false)}
          title={`Revisar Mensagem: ${msgTitle}`}
          subtitle={`Destinatário: ${customer.name} (${customer.whatsapp})`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Texto Preparado para Envio via Link Oficial
              </label>
              <textarea
                rows={5}
                value={preparedText}
                onChange={e => setPreparedText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300">
              O WhatsApp abrirá em uma nova aba com a mensagem pronta. A ação será gravada no histórico de auditoria.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCustomMsgModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-900 rounded-xl"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
              >
                <Send className="w-3.5 h-3.5" />
                Iniciar Conversa Oficial
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
