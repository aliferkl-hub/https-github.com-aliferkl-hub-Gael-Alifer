/**
 * SIGMA / ATMOS Reseller API Integration Service
 * Official Documentation: https://atmos.panelbr.site/api/reseller-api/v1
 * OpenAPI: https://atmos.panelbr.site/api/reseller-api/v1/openapi.json
 * llms.txt: https://atmos.panelbr.site/api/reseller-api/v1/llms.txt
 *
 * Scopes utilized:
 * - servers.read
 * - packages.read
 * - customers.create
 * - customers.read (for safe reconciliation if needed)
 */

import {
  SigmaConfig,
  SigmaCompanySettings,
  SigmaTestRequest,
  SigmaServer,
  SigmaPackage,
} from '../types/index.ts';

export const SIGMA_BASE_URL = 'https://atmos.panelbr.site/api/reseller-api/v1';

export interface SigmaApiError {
  status: number;
  code?: string;
  message: string;
  errors?: Record<string, string[]>;
  retryAfter?: number;
}

export interface SigmaCustomerCreatePayload {
  server_id: string;
  package_id: string;
  name?: string;
  whatsapp?: string;
  email?: string;
  trial_hours?: number;
  connections?: number;
  note?: string;
  username?: string;
  password?: string;
}

export interface SigmaCustomerResponse {
  id: string;
  username: string;
  password?: string;
  name?: string;
  whatsapp?: string;
  email?: string;
  status: string;
  is_trial: 'YES' | 'NO';
  connections: number;
  server?: string;
  server_id?: string;
  package?: string;
  package_id?: string;
  expires_at?: string;
  expires_at_tz?: string;
  created_at?: string;
  m3u_url?: string;
  m3u_url_short?: string;
  playlist?: string;
}

export class SigmaService {
  private baseUrl: string;
  private customFetch?: typeof fetch;

  constructor(baseUrl: string = SIGMA_BASE_URL, customFetch?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.customFetch = customFetch;
  }

  private getFetch(): typeof fetch {
    return this.customFetch || globalThis.fetch;
  }

  /**
   * Safely retrieves the SIGMA_API_TOKEN from server environment
   * NEVER exposes this token to clients or logs
   */
  public getToken(): string | null {
    const token = process.env.SIGMA_API_TOKEN;
    if (!token || token.trim().length === 0) {
      return null;
    }
    return token.trim();
  }

  public isConfigured(): boolean {
    return Boolean(this.getToken());
  }

  /**
   * Safe request helper that enforces Bearer authentication, handles timeouts,
   * and sanitizes error responses according to the official OpenAPI contract.
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      query?: Record<string, string | number | undefined>;
      timeoutMs?: number;
    } = {}
  ): Promise<{ data: T; meta?: any }> {
    const token = this.getToken();
    if (!token) {
      const err: SigmaApiError = {
        status: 401,
        code: 'missing_token',
        message: 'Credencial ausente: O token SIGMA_API_TOKEN não está configurado no servidor.',
      };
      throw err;
    }

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (options.query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const controller = new AbortController();
    const timeout = options.timeoutMs || 15000;
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'ONNIX-PLAY-Gestao/1.0',
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchFn = this.getFetch();
    try {
      const response = await fetchFn(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle documented status codes
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `Erro HTTP ${response.status} da API Sigma` };
        }

        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

        const err: SigmaApiError = {
          status: response.status,
          code: errorData.error,
          message: errorData.message || `Erro da API Sigma (${response.status})`,
          errors: errorData.errors,
          retryAfter,
        };

        // Enrich with user-friendly explanations for official error codes
        if (response.status === 401) {
          err.message = errorData.message || 'Credencial inválida ou token expirado na API Sigma.';
        } else if (response.status === 403) {
          if (errorData.error === 'ip_not_allowed') {
            err.message = 'Acesso bloqueado por restrição de IP: O IP de origem do servidor não está na lista permitida do token Sigma.';
          } else if (errorData.error === 'insufficient_scope') {
            err.message = 'Escopo insuficiente: O token Sigma não possui o escopo necessário para esta operação.';
          } else if (errorData.error === 'permission_denied') {
            err.message = 'Permissão negada: A conta Sigma não possui a permissão requerida para esta ação.';
          }
        } else if (response.status === 402) {
          err.message = errorData.message || 'Assinatura da integração ou créditos insuficientes na conta Sigma.';
        } else if (response.status === 409) {
          err.message = errorData.message || 'Conflito de recurso: Usuário duplicado ou incompatibilidade.';
        } else if (response.status === 422) {
          err.message = errorData.message || 'Dados inválidos enviados para a API Sigma.';
        } else if (response.status === 429) {
          err.message = `Limite de requisições atingido. Tente novamente em ${retryAfter || 60} segundos.`;
        }

        throw err;
      }

      const json = await response.json();
      return json;
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
        const timeoutErr: SigmaApiError = {
          status: 408,
          code: 'timeout_resultado_desconhecido',
          message: 'Tempo limite esgotado na comunicação com o Sigma. O estado da criação é desconhecido.',
        };
        throw timeoutErr;
      }
      throw e;
    }
  }

  /**
   * Diagnostic check: Tests connectivity and token status using GET /servers?per_page=1
   * Scope: servers.read
   */
  public async diagnose(): Promise<{
    status: 'configurada' | 'nao_configurada' | 'erro' | 'indisponivel';
    message: string;
    details?: any;
    responseTimeMs?: number;
  }> {
    if (!this.isConfigured()) {
      return {
        status: 'nao_configurada',
        message: 'Token SIGMA_API_TOKEN não configurado no servidor.',
      };
    }

    const start = Date.now();
    try {
      const res = await this.request<SigmaServer[]>('/servers', {
        method: 'GET',
        query: { per_page: 1 },
        timeoutMs: 8000,
      });

      const responseTimeMs = Date.now() - start;
      return {
        status: 'configurada',
        message: 'Conexão com API Sigma estabelecida com sucesso.',
        responseTimeMs,
        details: {
          totalServers: res.meta?.total ?? res.data?.length ?? 0,
        },
      };
    } catch (err: any) {
      const responseTimeMs = Date.now() - start;
      return {
        status: err.status === 401 ? 'nao_configurada' : 'erro',
        message: err.message || 'Falha ao conectar com o serviço Sigma.',
        responseTimeMs,
        details: {
          status: err.status,
          code: err.code,
        },
      };
    }
  }

  /**
   * Catalog: Retrieves all servers with proper pagination
   * Scope: servers.read
   */
  public async getServers(): Promise<SigmaServer[]> {
    const servers: SigmaServer[] = [];
    let page = 1;
    const perPage = 50;
    let hasMore = true;

    while (hasMore) {
      const res = await this.request<SigmaServer[]>('/servers', {
        method: 'GET',
        query: { page, per_page: perPage },
      });

      if (Array.isArray(res.data)) {
        servers.push(...res.data);
      }

      if (res.meta && res.meta.last_page) {
        if (page >= res.meta.last_page) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }

      // Safety circuit breaker against runaway loops
      if (page > 10) break;
    }

    return servers;
  }

  /**
   * Catalog: Retrieves all packages with proper pagination
   * Scope: packages.read
   */
  public async getPackages(serverId?: string): Promise<SigmaPackage[]> {
    const packages: SigmaPackage[] = [];
    let page = 1;
    const perPage = 50;
    let hasMore = true;

    while (hasMore) {
      const res = await this.request<SigmaPackage[]>('/packages', {
        method: 'GET',
        query: { page, per_page: perPage },
      });

      if (Array.isArray(res.data)) {
        packages.push(...res.data);
      }

      if (res.meta && res.meta.last_page) {
        if (page >= res.meta.last_page) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }

      if (page > 10) break;
    }

    if (serverId) {
      return packages.filter((p) => String(p.server_id) === String(serverId));
    }
    return packages;
  }

  /**
   * Creates customer / trial in Sigma
   * Scope: customers.create
   */
  public async createCustomer(
    payload: SigmaCustomerCreatePayload
  ): Promise<SigmaCustomerResponse> {
    const res = await this.request<SigmaCustomerResponse>('/customers', {
      method: 'POST',
      body: payload,
      timeoutMs: 15000,
    });

    return res.data;
  }

  /**
   * Reconcile: Search customer by exact username to resolve timeout / unknown result
   * Scope: customers.read
   */
  public async findCustomerByUsername(
    username: string
  ): Promise<SigmaCustomerResponse | null> {
    try {
      const res = await this.request<SigmaCustomerResponse>(
        `/customers/by-username/${encodeURIComponent(username)}`,
        {
          method: 'GET',
          timeoutMs: 10000,
        }
      );
      return res.data || null;
    } catch (e: any) {
      if (e.status === 404) {
        return null;
      }
      throw e;
    }
  }
}

export const defaultSigmaService = new SigmaService();
