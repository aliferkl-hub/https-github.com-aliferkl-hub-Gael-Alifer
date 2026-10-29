/**
 * WhatsApp Helper & Official Link Builder
 * Uses official WhatsApp universal links without misleading automation claims
 */

import { formatBRL, formatBrDate } from './date.ts';

export function sanitizePhoneForWhatsApp(phone?: string | null): string {
  // Strip non-digits safely
  let cleaned = (phone || '').replace(/\D/g, '');
  // Default to Brazil country code 55 if not present
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

export function generateWhatsAppLink(phone: string, text: string): string {
  const cleanNumber = sanitizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanNumber}?text=${encodedText}`;
}

export interface MessageTemplateParams {
  customerName: string;
  planName?: string;
  amount?: number;
  dueDate?: string;
  paymentMethod?: string;
  pixKey?: string;
}

export const WhatsAppTemplates = {
  lembreteVencimento: (params: MessageTemplateParams): string => {
    const formattedAmount = params.amount !== undefined ? formatBRL(params.amount) : 'R$ 0,00';
    const formattedDate = params.dueDate ? formatBrDate(params.dueDate) : 'em breve';
    let msg = `Olá, ${params.customerName}! Tudo bem? Aqui é da ONNIX PLAY. Passando para lembrar que seu plano, no valor de ${formattedAmount}, tem vencimento em ${formattedDate}. Se precisar de ajuda, estamos à disposição. Obrigado pela parceria!`;
    if (params.pixKey) {
      msg += `\n\nChave PIX para pagamento: ${params.pixKey}`;
    }
    return msg;
  },

  cobrancaVencida: (params: MessageTemplateParams): string => {
    const formattedDate = params.dueDate ? formatBrDate(params.dueDate) : 'recente';
    let msg = `Olá, ${params.customerName}! Identificamos que o vencimento do seu plano ONNIX PLAY estava previsto para ${formattedDate}. Caso já tenha realizado o pagamento, por favor, desconsidere esta mensagem. Se precisar de ajuda, fale conosco.`;
    if (params.pixKey) {
      msg += `\n\nChave PIX para regularização: ${params.pixKey}`;
    }
    return msg;
  },

  confirmacaoPagamento: (params: MessageTemplateParams): string => {
    return `Olá, ${params.customerName}! Registramos a confirmação do pagamento referente ao seu plano ONNIX PLAY. Obrigado pela confiança!`;
  },

  contratoDisponivel: (params: MessageTemplateParams): string => {
    return `Olá, ${params.customerName}! Seu contrato ONNIX PLAY está disponível. Entre em contato conosco caso tenha alguma dúvida sobre as condições contratadas.`;
  },
};
