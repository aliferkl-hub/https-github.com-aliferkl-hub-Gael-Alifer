/**
 * Frontend Sigma API Client
 * Safely calls backend proxy routes /api/sigma/*
 * Never calls Sigma directly from browser
 */

import {
  SigmaConfig,
  SigmaCompanySettings,
  SigmaTestRequest,
  SigmaServer,
  SigmaPackage,
  UserProfile,
} from '../types/index.ts';
import { generateWhatsAppLink, sanitizePhoneForWhatsApp } from './whatsapp.ts';

export class SigmaClient {
  private static getHeaders(user: UserProfile | null): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (user) {
      headers['X-User-Email'] = user.email;
      headers['X-User-Role'] = user.role;
      if (user.companyId) {
        headers['X-User-Company-Id'] = user.companyId;
      }
    }

    return headers;
  }

  public static async getStatus(): Promise<{
    status: 'configurada' | 'nao_configurada' | 'erro' | 'indisponivel';
    hasToken: boolean;
    requiredScopes: string[];
    lastCheckedAt?: string;
    lastError?: string;
  }> {
    const res = await fetch('/api/sigma/status');
    return res.json();
  }

  public static async diagnose(user: UserProfile | null): Promise<{
    status: 'configurada' | 'nao_configurada' | 'erro' | 'indisponivel';
    message: string;
    details?: any;
    responseTimeMs?: number;
  }> {
    const res = await fetch('/api/sigma/diagnose', {
      headers: this.getHeaders(user),
    });
    return res.json();
  }

  public static async getServers(user: UserProfile | null): Promise<SigmaServer[]> {
    const res = await fetch('/api/sigma/servers', {
      headers: this.getHeaders(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao buscar servidores.');
    }
    const json = await res.json();
    return json.data || [];
  }

  public static async getPackages(user: UserProfile | null, serverId?: string): Promise<SigmaPackage[]> {
    const qs = serverId ? `?server_id=${encodeURIComponent(serverId)}` : '';
    const res = await fetch(`/api/sigma/packages${qs}`, {
      headers: this.getHeaders(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao buscar pacotes.');
    }
    const json = await res.json();
    return json.data || [];
  }

  public static async getConfig(user: UserProfile | null): Promise<SigmaConfig> {
    const res = await fetch('/api/sigma/config', {
      headers: this.getHeaders(user),
    });
    return res.json();
  }

  public static async saveConfig(user: UserProfile | null, config: Partial<SigmaConfig>): Promise<SigmaConfig> {
    const res = await fetch('/api/sigma/config', {
      method: 'POST',
      headers: this.getHeaders(user),
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao salvar configurações.');
    }
    return res.json();
  }

  public static async getCompanySettings(user: UserProfile | null): Promise<SigmaCompanySettings[]> {
    const res = await fetch('/api/sigma/company-settings', {
      headers: this.getHeaders(user),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  }

  public static async saveCompanySettings(
    user: UserProfile | null,
    settings: SigmaCompanySettings
  ): Promise<void> {
    const res = await fetch('/api/sigma/company-settings', {
      method: 'POST',
      headers: this.getHeaders(user),
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao salvar regras da empresa.');
    }
  }

  public static async getTestRequests(
    user: UserProfile | null,
    companyIdFilter?: string
  ): Promise<SigmaTestRequest[]> {
    const qs = companyIdFilter ? `?company_id=${encodeURIComponent(companyIdFilter)}` : '';
    const res = await fetch(`/api/sigma/tests${qs}`, {
      headers: this.getHeaders(user),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  }

  public static async createTestRequest(
    user: UserProfile | null,
    payload: {
      clientName: string;
      clientWhatsApp: string;
      clientEmail?: string;
      clientNotes?: string;
      serverId: string;
      serverName: string;
      packageId: string;
      packageName: string;
      trialHours: number;
      companyId?: string;
    }
  ): Promise<{ data: SigmaTestRequest; message: string }> {
    // Generate secure idempotency key
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const res = await fetch('/api/sigma/tests', {
      method: 'POST',
      headers: this.getHeaders(user),
      body: JSON.stringify({
        ...payload,
        idempotencyKey,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok && res.status !== 202) {
      const err = new Error(json.message || 'Falha ao processar teste.');
      (err as any).status = res.status;
      (err as any).data = json.data;
      throw err;
    }

    return json;
  }

  public static async approveTestRequest(
    user: UserProfile | null,
    testId: string
  ): Promise<{ data: SigmaTestRequest; message: string }> {
    const res = await fetch(`/api/sigma/tests/${testId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(user),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Falha ao aprovar teste.');
    }
    return json;
  }

  public static async rejectTestRequest(
    user: UserProfile | null,
    testId: string,
    reason: string
  ): Promise<{ data: SigmaTestRequest; message: string }> {
    const res = await fetch(`/api/sigma/tests/${testId}/reject`, {
      method: 'POST',
      headers: this.getHeaders(user),
      body: JSON.stringify({ reason }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Falha ao recusar teste.');
    }
    return json;
  }

  public static async reconcileTestRequest(
    user: UserProfile | null,
    testId: string
  ): Promise<{ data: SigmaTestRequest; message: string }> {
    const res = await fetch(`/api/sigma/tests/${testId}/reconcile`, {
      method: 'POST',
      headers: this.getHeaders(user),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || 'Falha ao reconciliar teste.');
    }
    return json;
  }

  /**
   * Builds formatted WhatsApp delivery message for customer credentials
   */
  public static generateWhatsAppShareLink(test: SigmaTestRequest): string {
    const cleanPhone = sanitizePhoneForWhatsApp(test?.clientWhatsApp);
    const clientName = test?.clientName || 'Cliente';

    let text = `🚀 Olá, *${clientName}*! Seu teste *ONNIX PLAY* está pronto!\n\n`;
    text += `📺 *Dados de Acesso:*\n`;
    if (test?.externalUsername) text += `👤 *Usuário:* ${test.externalUsername}\n`;
    if (test?.externalPassword) text += `🔑 *Senha:* ${test.externalPassword}\n`;
    if (test?.externalExpiresAt) {
      try {
        const expDate = new Date(test.externalExpiresAt);
        text += `⏰ *Validade:* ${expDate.toLocaleString('pt-BR')}\n`;
      } catch {
        // ignore date parse error
      }
    }
    if (test?.externalM3uUrl || test?.externalM3uShortUrl) {
      text += `🔗 *Lista M3U:* ${test.externalM3uShortUrl || test.externalM3uUrl}\n`;
    }
    if (test?.externalPlaylist) {
      text += `📋 *Playlist:* ${test.externalPlaylist}\n`;
    }

    text += `\nQualquer dúvida, conte conosco. Bom entretenimento! 🍿`;

    return generateWhatsAppLink(cleanPhone, text);
  }
}
