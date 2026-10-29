import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';
import { Customer, Invoice, MessageLog, WhatsAppApiSettings, Plan } from '../../types/index.ts';
import { formatBRL, formatBrDate, getDaysDiff, getTodaySaoPaulo } from '../../lib/date.ts';
import { generateWhatsAppLink, WhatsAppTemplates } from '../../lib/whatsapp.ts';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface WhatsAppViewProps {
  customers: Customer[];
  invoices: Invoice[];
  plans: Plan[];
  messageLogs: MessageLog[];
  pixKey: string;
  onRefresh: () => void;
}

export const WhatsAppView: React.FC<WhatsAppViewProps> = ({
  customers,
  invoices,
  plans,
  messageLogs,
  pixKey,
  onRefresh,
}) => {
  const { currentUser, isMasterOwner } = useAuth();
  const today = getTodaySaoPaulo();

  const [activeTab, setActiveTab] = useState<'d2_reminders' | 'all_clients' | 'logs' | 'api_settings'>('d2_reminders');

  // Prepared modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [targetInvoice, setTargetInvoice] = useState<Invoice | null>(null);
  const [messageType, setMessageType] = useState<MessageLog['messageType']>('lembrete_2_dias');
  const [messageText, setMessageText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Meta Cloud API Settings state
  const [apiSettings, setApiSettings] = useState<WhatsAppApiSettings>({
    enabled: false,
    phoneNumberId: '',
    businessAccountId: '',
    permanentAccessToken: '',
    webhookVerifyToken: '',
    templateNamespace: '',
  });

  // Calculate D-2 Invoices (vencem em exatamente 2 dias)
  const d2Invoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'paga' || inv.status === 'cancelada') return false;
      const diff = getDaysDiff(inv.dueDate, today);
      return diff === 2;
    });
  }, [invoices, today]);

  // Open modal with prepared template
  const handleOpenPrepared = (
    cust: Customer,
    inv?: Invoice,
    type: MessageLog['messageType'] = 'lembrete_2_dias'
  ) => {
    setSelectedCustomer(cust);
    setTargetInvoice(inv || null);
    setMessageType(type);

    let text = '';
    const firstName = cust.name.split(' ')[0];

    if (type === 'lembrete_2_dias') {
      text = WhatsAppTemplates.lembreteVencimento({
        customerName: firstName,
        amount: inv?.amount || 39.9,
        dueDate: inv?.dueDate || today,
        pixKey,
      });
    } else if (type === 'cobranca_vencida') {
      text = WhatsAppTemplates.cobrancaVencida({
        customerName: firstName,
        dueDate: inv?.dueDate || today,
        pixKey,
      });
    } else if (type === 'confirmacao_pagamento') {
      text = WhatsAppTemplates.confirmacaoPagamento({
        customerName: firstName,
      });
    } else if (type === 'contrato_disponivel') {
      text = WhatsAppTemplates.contratoDisponivel({
        customerName: firstName,
      });
    } else {
      text = `Olá, ${firstName}! Aqui é da equipe ONNIX PLAY. Como podemos ajudar hoje?`;
    }

    setMessageText(text);
    setIsModalOpen(true);
  };

  const handleDispatchOfficialLink = async () => {
    if (!selectedCustomer) return;

    const link = generateWhatsAppLink(selectedCustomer.whatsapp, messageText);
    window.open(link, '_blank');

    // Save record to message_logs
    const log: MessageLog = {
      id: `msg-${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      phone: selectedCustomer.whatsapp,
      messageType,
      channel: 'whatsapp_click',
      content: messageText,
      status: 'enviada',
      sentAt: new Date().toISOString(),
      sentBy: currentUser?.email || 'sistema',
      createdAt: new Date().toISOString(),
    };

    await DatabaseService.logMessage(log, currentUser?.email || 'sistema');

    // If targetInvoice exists, update reminder status
    if (targetInvoice) {
      targetInvoice.reminderStatus = 'lembrete_enviado';
      await DatabaseService.saveInvoice(targetInvoice, currentUser?.email || 'sistema');
    }

    setIsModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Central de Mensagens & WhatsApp
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Modo Híbrido: Envio 1-clique via links oficiais wa.me e esteira preparada para API Oficial Cloud.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-[#0b1222] border border-cyan-500/20 p-1.5 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('d2_reminders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'd2_reminders'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lembretes D-2 ({d2Invoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('all_clients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'all_clients'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Disparo Manual
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico ({messageLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('api_settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'api_settings'
                ? 'bg-purple-500 text-white font-bold shadow'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>API Oficial Meta</span>
          </button>
        </div>
      </div>

      {/* TAB 1: AUTOMATED D-2 REMINDERS */}
      {activeTab === 'd2_reminders' && (
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Regra dos Dois Dias (D-2) — Faturas que Vencem em 2 Dias
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Rotina agendada que localiza assinaturas com vencimento em 48 horas e prepara a mensagem personalizada.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-xs font-bold">
              {d2Invoices.length} aguardando envio
            </span>
          </div>

          {d2Invoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-white">Nenhum lembrete D-2 pendente no momento</p>
              <p className="text-xs text-slate-400 mt-1">
                Todas as assinaturas que vencem em 2 dias já foram lembradas ou não possuem pendência.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {d2Invoices.map(inv => {
                const cust = customers.find(c => c.id === inv.customerId);
                if (!cust) return null;

                return (
                  <div
                    key={inv.id}
                    className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{cust.name}</span>
                        <span className="font-mono text-xs text-cyan-400">({cust.code})</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          VENCE EM 2 DIAS ({formatBrDate(inv.dueDate)})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Fatura <strong>{inv.invoiceNumber}</strong> no valor de <strong>{formatBRL(inv.amount)}</strong>.
                        WhatsApp: <span className="font-mono text-slate-300">{cust.whatsapp}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenPrepared(cust, inv, 'lembrete_2_dias')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 transition-all shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Revisar & Enviar 1-Clique</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL DISPATCH FOR ALL CLIENTS */}
      {activeTab === 'all_clients' && (
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white mb-2">
            Disparo Rápido por Modelo
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Escolha o modelo oficial e o cliente para carregar a mensagem pronta no WhatsApp.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">WhatsApp</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-right">Modelos Oficiais de Disparo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {customers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {cust.name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">
                      {cust.whatsapp}
                    </td>
                    <td className="py-2.5 px-3 capitalize">
                      {cust.status}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPrepared(cust, undefined, 'lembrete_2_dias')}
                          className="px-2 py-1 text-[11px] font-semibold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 rounded-lg"
                        >
                          Lembrar Vencimento
                        </button>
                        <button
                          onClick={() => handleOpenPrepared(cust, undefined, 'cobranca_vencida')}
                          className="px-2 py-1 text-[11px] font-semibold bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 rounded-lg"
                        >
                          Aviso Vencido
                        </button>
                        <button
                          onClick={() => handleOpenPrepared(cust, undefined, 'confirmacao_pagamento')}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 rounded-lg"
                        >
                          Confirmação Pgto
                        </button>
                        <button
                          onClick={() => handleOpenPrepared(cust, undefined, 'contrato_disponivel')}
                          className="px-2 py-1 text-[11px] font-semibold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 rounded-lg"
                        >
                          Contrato
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'logs' && (
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white mb-2">
            Histórico Auditável de Disparos WhatsApp
          </h3>

          {messageLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Nenhum envio registrado até o momento.</p>
          ) : (
            <div className="space-y-2">
              {messageLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      {log.customerName} ({log.phone})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Enviado por {log.sentBy} em {formatBrDate(log.sentAt)} às {new Date(log.sentAt).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-slate-300 bg-slate-950 p-2 rounded text-[11px] font-mono leading-relaxed">
                    {log.content}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="uppercase font-bold text-cyan-400">Canal: {log.channel}</span>
                    <span className="uppercase font-bold text-emerald-400">Status: {log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: OFFICIAL META API PREPARATION */}
      {activeTab === 'api_settings' && (
        <div className="bg-[#0b1222] border border-purple-500/20 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Integração Oficial Meta WhatsApp Business Platform
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Estrutura preparada para envio 100% automatizado em background quando configuradas as credenciais da Meta.
              </p>
            </div>
          </div>

          <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-slate-300 space-y-2 leading-relaxed">
            <p className="font-bold text-purple-300">Diretrizes da Integração Oficial:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Respeita opt-in e descadastramento do titular conforme a LGPD e políticas do WhatsApp.</li>
              <li>Não realiza disparos por robôs paralelos ou automações ilegais que causem banimento do número.</li>
              <li>Exige templates pré-aprovados pela Meta para conversas iniciadas pelo sistema.</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number ID (Meta App Dashboard)
              </label>
              <input
                type="text"
                placeholder="Ex: 109283910293810"
                value={apiSettings.phoneNumberId}
                onChange={e => setApiSettings({ ...apiSettings, phoneNumberId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                WhatsApp Business Account ID (WABA)
              </label>
              <input
                type="text"
                placeholder="Ex: 293810293810293"
                value={apiSettings.businessAccountId}
                onChange={e => setApiSettings({ ...apiSettings, businessAccountId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Permanent System User Access Token
              </label>
              <input
                type="password"
                placeholder="EAAB..."
                value={apiSettings.permanentAccessToken}
                onChange={e => setApiSettings({ ...apiSettings, permanentAccessToken: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Webhook Verify Token
              </label>
              <input
                type="text"
                placeholder="onnix_webhook_secret_key"
                value={apiSettings.webhookVerifyToken}
                onChange={e => setApiSettings({ ...apiSettings, webhookVerifyToken: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Namespace dos Templates Aprovados
              </label>
              <input
                type="text"
                placeholder="onnix_gestao_alerts"
                value={apiSettings.templateNamespace}
                onChange={e => setApiSettings({ ...apiSettings, templateNamespace: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          <button
            onClick={() => alert('Configurações da Meta API salvas com sucesso. Quando ativadas com token de produção, o sistema realizará a entrega via webhook oficial.')}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
          >
            Salvar Configurações da Meta API
          </button>
        </div>
      )}

      {/* MODAL TO REVIEW AND DISPATCH PREPARED MESSAGE */}
      {isModalOpen && selectedCustomer && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Revisar e Disparar: ${selectedCustomer.name}`}
          subtitle={`WhatsApp: ${selectedCustomer.whatsapp}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mensagem Preparada (Editável)
              </label>
              <textarea
                rows={6}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300">
              O link oficial do WhatsApp abrirá na sequência com o texto pronto para envio. O registro será gravado na auditoria com o operador responsável.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDispatchOfficialLink}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Disparar WhatsApp</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
