/**
 * ONNIX PLAY Full-Stack Server Entry Point
 * Implements Express backend proxy with Vite middlewares
 * Runs on Port 3000 (0.0.0.0)
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { defaultSigmaService, SigmaService, SigmaApiError } from './src/server/sigma-service.ts';
import { DatabaseService, DEFAULT_SIGMA_CONFIG, DEFAULT_MASTER_EMAIL, ALT_MASTER_EMAIL, MASTER_EMAILS } from './src/lib/db.ts';
import { SigmaTestRequest, SigmaCompanySettings, UserRole } from './src/types/index.ts';

import fs from 'fs';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// In-memory mutex for idempotency protection against concurrent requests
const activeProcessingKeys = new Set<string>();

/**
 * Multi-tenant Auth Middleware
 * Validates session credentials from database and ensures strict company boundary isolation
 */
interface AuthenticatedUser {
  email: string;
  role: UserRole;
  companyId?: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const email = (req.headers['x-user-email'] as string || '').toLowerCase().trim();
  const requestedRole = (req.headers['x-user-role'] as string || '').trim() as UserRole;

  if (!email) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Sessão não identificada. Por favor, autentique-se no sistema.',
    });
  }

  // 1. Check if Master Owner
  const isMaster =
    MASTER_EMAILS.some((m) => m.toLowerCase() === email) ||
    email === DEFAULT_MASTER_EMAIL.toLowerCase() ||
    email === ALT_MASTER_EMAIL.toLowerCase();

  if (isMaster) {
    req.user = {
      email,
      role: 'MASTER_OWNER',
      name: 'Master Owner',
    };
    return next();
  }

  // 2. Lookup Partner Company Admin or Employee in database
  try {
    const companies = await DatabaseService.getCompanies();
    const matchedCompany = companies.find(
      (c) =>
        c.adminEmail.toLowerCase() === email ||
        c.email.toLowerCase() === email
    );

    if (matchedCompany) {
      if (matchedCompany.status !== 'ativa') {
        return res.status(403).json({
          error: 'company_inactive',
          message: 'Empresa parceira com status inativo ou suspenso.',
        });
      }

      req.user = {
        email,
        role: 'EMPRESA_ADMIN',
        companyId: matchedCompany.id,
        name: matchedCompany.tradeName,
      };
      return next();
    }

    // 3. Lookup Employee
    const employees = await DatabaseService.getEmployees();
    const matchedEmployee = employees.find(
      (e) => e.email.toLowerCase() === email && e.status === 'ativo'
    );

    if (matchedEmployee && matchedEmployee.companyId) {
      req.user = {
        email,
        role: matchedEmployee.userRoleType || 'EMPLOYEE',
        companyId: matchedEmployee.companyId,
        name: matchedEmployee.name,
      };
      return next();
    }

    return res.status(403).json({
      error: 'forbidden',
      message: 'Usuário não autorizado para realizar operações multiempresa.',
    });
  } catch (err: any) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Falha ao validar credenciais no banco de dados.',
    });
  }
}

// Master-only guard
function requireMasterOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'MASTER_OWNER') {
    return res.status(403).json({
      error: 'permission_denied',
      message: 'Acesso restrito ao painel Master Owner.',
    });
  }
  next();
}

// ==========================================
// SIGMA RESELLER API ENDPOINTS
// ==========================================

// 1. Status & Diagnostics
app.get('/api/sigma/status', async (req: Request, res: Response) => {
  const hasToken = defaultSigmaService.isConfigured();
  const config = await DatabaseService.getSigmaConfig();

  res.json({
    status: hasToken ? 'configurada' : 'nao_configurada',
    hasToken,
    baseUrl: defaultSigmaService['baseUrl'],
    requiredScopes: ['servers.read', 'packages.read', 'customers.create'],
    lastCheckedAt: config.lastCheckedAt,
    lastError: config.lastError,
  });
});

app.get('/api/sigma/diagnose', authMiddleware, requireMasterOwner, async (req: Request, res: Response) => {
  try {
    const diagnostic = await defaultSigmaService.diagnose();

    // Update config status in DB
    await DatabaseService.saveSigmaConfig(
      {
        status: diagnostic.status,
        lastCheckedAt: new Date().toISOString(),
        lastError: diagnostic.status === 'erro' ? diagnostic.message : undefined,
      },
      req.user!.email
    );

    res.json(diagnostic);
  } catch (err: any) {
    res.status(500).json({
      status: 'erro',
      message: err.message || 'Falha inesperada no diagnóstico da integração.',
    });
  }
});

// 2. Catalogs (Servers & Packages)
app.get('/api/sigma/servers', authMiddleware, async (req: Request, res: Response) => {
  if (!defaultSigmaService.isConfigured()) {
    return res.status(503).json({
      error: 'missing_token',
      message: 'Integração Sigma com configuração pendente. Token ausente.',
    });
  }

  try {
    const servers = await defaultSigmaService.getServers();
    res.json({ data: servers });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.code || 'server_error',
      message: err.message || 'Erro ao carregar catálogo de servidores da API Sigma.',
    });
  }
});

app.get('/api/sigma/packages', authMiddleware, async (req: Request, res: Response) => {
  if (!defaultSigmaService.isConfigured()) {
    return res.status(503).json({
      error: 'missing_token',
      message: 'Integração Sigma com configuração pendente. Token ausente.',
    });
  }

  const serverId = req.query.server_id as string | undefined;

  try {
    const packages = await defaultSigmaService.getPackages(serverId);
    res.json({ data: packages });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.code || 'package_error',
      message: err.message || 'Erro ao carregar catálogo de pacotes da API Sigma.',
    });
  }
});

// 3. Configuration Management
app.get('/api/sigma/config', authMiddleware, async (req: Request, res: Response) => {
  const config = await DatabaseService.getSigmaConfig();
  config.hasToken = defaultSigmaService.isConfigured();
  config.status = config.hasToken ? 'configurada' : 'nao_configurada';
  res.json(config);
});

app.post('/api/sigma/config', authMiddleware, requireMasterOwner, async (req: Request, res: Response) => {
  try {
    const updated = await DatabaseService.saveSigmaConfig(req.body, req.user!.email);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({
      error: 'save_error',
      message: 'Falha ao salvar configurações do Sigma.',
    });
  }
});

// 4. Company Settings & Quota Rules
app.get('/api/sigma/company-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role === 'MASTER_OWNER') {
      const all = await DatabaseService.getSigmaCompanySettings();
      return res.json({ data: all });
    }

    // Company gets only its own settings
    const companySettings = await DatabaseService.getSingleSigmaCompanySetting(user.companyId!);
    res.json({ data: companySettings ? [companySettings] : [] });
  } catch (err: any) {
    res.status(500).json({
      error: 'query_error',
      message: 'Falha ao consultar regras da empresa.',
    });
  }
});

app.post('/api/sigma/company-settings', authMiddleware, requireMasterOwner, async (req: Request, res: Response) => {
  try {
    const {
      companyId,
      companyName,
      autoApproval,
      maxDailyTests,
      maxMonthlyTests,
      allowedServerIds,
      allowedPackageIds,
      allowedTrialHours,
      enabled,
      notes,
    } = req.body;

    if (!companyId || !companyName) {
      return res.status(422).json({
        error: 'validation_error',
        message: 'companyId e companyName são obrigatórios.',
      });
    }

    const settings: SigmaCompanySettings = {
      companyId,
      companyName,
      autoApproval: Boolean(autoApproval),
      maxDailyTests: Number(maxDailyTests) || 10,
      maxMonthlyTests: Number(maxMonthlyTests) || 100,
      allowedServerIds: allowedServerIds || [],
      allowedPackageIds: allowedPackageIds || [],
      allowedTrialHours: allowedTrialHours || [1, 2, 4, 6],
      enabled: enabled !== false,
      notes: notes || '',
    };

    await DatabaseService.saveSigmaCompanySettings(settings, req.user!.email);
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(500).json({
      error: 'save_error',
      message: 'Falha ao salvar regras da empresa.',
    });
  }
});

// 5. Test Requests (Listing & Creation)
app.get('/api/sigma/tests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let requests: SigmaTestRequest[];

    if (user.role === 'MASTER_OWNER') {
      const filterCompanyId = req.query.company_id as string | undefined;
      requests = await DatabaseService.getSigmaTestRequests(filterCompanyId);
    } else {
      // Strict multi-tenant isolation: enforce companyId from session
      requests = await DatabaseService.getSigmaTestRequests(user.companyId!);
    }

    res.json({ data: requests });
  } catch (err: any) {
    res.status(500).json({
      error: 'query_error',
      message: 'Falha ao buscar solicitações de teste.',
    });
  }
});

app.post('/api/sigma/tests', authMiddleware, async (req: Request, res: Response) => {
  const user = req.user!;
  const targetCompanyId = user.role === 'MASTER_OWNER' ? (req.body.companyId || 'company-matriz-01') : user.companyId!;

  const {
    idempotencyKey,
    clientName,
    clientWhatsApp,
    clientEmail,
    clientNotes,
    serverId,
    serverName,
    packageId,
    packageName,
    trialHours,
  } = req.body;

  // Validation
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return res.status(422).json({
      error: 'validation_error',
      message: 'Chave de idempotência (idempotencyKey) é obrigatória.',
    });
  }

  if (!clientName || clientName.trim().length < 2) {
    return res.status(422).json({
      error: 'validation_error',
      message: 'Nome do cliente é obrigatório (mínimo 2 caracteres).',
    });
  }

  if (!clientWhatsApp || clientWhatsApp.replace(/\D/g, '').length < 8) {
    return res.status(422).json({
      error: 'validation_error',
      message: 'WhatsApp válido é obrigatório para entrega do teste.',
    });
  }

  if (!serverId || !packageId) {
    return res.status(422).json({
      error: 'validation_error',
      message: 'Servidor e Pacote são obrigatórios.',
    });
  }

  // Idempotency check: prevent duplicate clicks / double requests
  if (activeProcessingKeys.has(idempotencyKey)) {
    return res.status(409).json({
      error: 'in_progress',
      message: 'Esta solicitação já está em processamento. Aguarde.',
    });
  }

  const existing = await DatabaseService.findSigmaTestRequestByIdempotencyKey(idempotencyKey);
  if (existing) {
    return res.status(200).json({
      data: existing,
      message: 'Solicitação já processada anteriormente (idempotência garantida).',
    });
  }

  activeProcessingKeys.add(idempotencyKey);

  try {
    // 1. Fetch company profile & settings
    const companies = await DatabaseService.getCompanies();
    const company = companies.find((c) => c.id === targetCompanyId);
    if (!company) {
      activeProcessingKeys.delete(idempotencyKey);
      return res.status(404).json({
        error: 'company_not_found',
        message: 'Empresa vinculada não encontrada.',
      });
    }

    const companySettings = await DatabaseService.getSingleSigmaCompanySetting(targetCompanyId);
    const isAutoApproval = user.role === 'MASTER_OWNER' ? true : (companySettings?.autoApproval ?? false);
    const maxDaily = companySettings?.maxDailyTests ?? 10;
    const maxMonthly = companySettings?.maxMonthlyTests ?? 100;
    const isEnabled = companySettings?.enabled !== false;

    if (!isEnabled && user.role !== 'MASTER_OWNER') {
      activeProcessingKeys.delete(idempotencyKey);
      return res.status(403).json({
        error: 'company_disabled',
        message: 'A geração de testes está temporariamente suspensa para esta empresa.',
      });
    }

    // 2. Validate Quotas
    const existingRequests = await DatabaseService.getSigmaTestRequests(targetCompanyId);
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    const testsToday = existingRequests.filter(
      (r) => r.requestedAt.startsWith(todayStr) && r.approvalStatus !== 'rejeitado'
    ).length;

    const testsThisMonth = existingRequests.filter(
      (r) => r.requestedAt.startsWith(monthStr) && r.approvalStatus !== 'rejeitado'
    ).length;

    if (user.role !== 'MASTER_OWNER') {
      if (testsToday >= maxDaily) {
        activeProcessingKeys.delete(idempotencyKey);
        return res.status(403).json({
          error: 'daily_limit_exceeded',
          message: `Limite diário de testes atingido (${testsToday}/${maxDaily}). Solicite liberação ao Master Owner.`,
        });
      }

      if (testsThisMonth >= maxMonthly) {
        activeProcessingKeys.delete(idempotencyKey);
        return res.status(403).json({
          error: 'monthly_limit_exceeded',
          message: `Limite mensal de testes atingido (${testsThisMonth}/${maxMonthly}). Solicite liberação ao Master Owner.`,
        });
      }
    }

    const requestId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();

    const testRecord: SigmaTestRequest = {
      id: requestId,
      idempotencyKey,
      companyId: targetCompanyId,
      companyName: company.tradeName,
      requestedByUserId: user.email,
      requestedByUserEmail: user.email,
      requestedByUserName: user.name || user.email,
      clientName: clientName.trim(),
      clientWhatsApp: clientWhatsApp.trim(),
      clientEmail: clientEmail?.trim() || undefined,
      clientNotes: clientNotes?.trim() || undefined,
      serverId,
      serverName: serverName || 'Servidor Sigma',
      packageId,
      packageName: packageName || 'Pacote Teste',
      trialHours: Number(trialHours) || 2,
      approvalStatus: isAutoApproval ? 'auto_aprovado' : 'pendente_aprovacao',
      approvedBy: isAutoApproval ? (user.role === 'MASTER_OWNER' ? user.email : 'SISTEMA_AUTO') : undefined,
      approvedAt: isAutoApproval ? nowIso : undefined,
      integrationStatus: isAutoApproval ? 'processando' : 'pendente',
      requestedAt: nowIso,
      auditHistory: [
        {
          timestamp: nowIso,
          action: isAutoApproval ? 'CRIACAO_AUTOMATICA_INICIADA' : 'SOLICITACAO_ENVIADA_APROVACAO',
          user: user.email,
          details: `Solicitação para ${clientName} (${clientWhatsApp}). Modo: ${isAutoApproval ? 'Automático' : 'Aprovação Manual'}`,
        },
      ],
    };

    // Save initial record in database
    await DatabaseService.saveSigmaTestRequest(testRecord, user.email);

    // MODE B: Requires manual Master Owner approval
    if (!isAutoApproval) {
      activeProcessingKeys.delete(idempotencyKey);
      return res.status(202).json({
        data: testRecord,
        message: 'Solicitação de teste enviada com sucesso! Aguardando aprovação do Master Owner.',
      });
    }

    // MODE A: Execute creation in Sigma immediately
    if (!defaultSigmaService.isConfigured()) {
      testRecord.integrationStatus = 'erro';
      testRecord.errorMessage = 'Integração Sigma com configuração pendente: SIGMA_API_TOKEN não configurado no servidor.';
      await DatabaseService.saveSigmaTestRequest(testRecord, user.email);
      activeProcessingKeys.delete(idempotencyKey);

      return res.status(503).json({
        error: 'missing_token',
        message: 'A integração com o servidor Sigma está pendente de configuração pelo Master Owner.',
        data: testRecord,
      });
    }

    try {
      const sigmaPayload = {
        server_id: serverId,
        package_id: packageId,
        name: clientName.trim(),
        whatsapp: clientWhatsApp.trim(),
        email: clientEmail?.trim() || undefined,
        trial_hours: Number(trialHours) || 2,
        connections: 1,
        note: `Onnix Play - ${company.tradeName}`,
      };

      const customer = await defaultSigmaService.createCustomer(sigmaPayload);

      // Successfully created on Sigma
      testRecord.integrationStatus = 'criado';
      testRecord.externalCustomerId = customer.id;
      testRecord.externalUsername = customer.username;
      testRecord.externalPassword = customer.password;
      testRecord.externalExpiresAt = customer.expires_at;
      testRecord.externalExpiresAtTz = customer.expires_at_tz;
      testRecord.externalM3uUrl = customer.m3u_url;
      testRecord.externalM3uShortUrl = customer.m3u_url_short;
      testRecord.externalPlaylist = customer.playlist;
      testRecord.createdAt = customer.created_at || new Date().toISOString();
      testRecord.expiresAt = customer.expires_at;
      testRecord.auditHistory.push({
        timestamp: new Date().toISOString(),
        action: 'TESTE_CRIADO_COM_SUCESSO',
        user: 'SISTEMA_SIGMA',
        details: `Criado no Sigma: ID=${customer.id}, Usuário=${customer.username}`,
      });

      await DatabaseService.saveSigmaTestRequest(testRecord, user.email);
      activeProcessingKeys.delete(idempotencyKey);

      return res.status(201).json({
        data: testRecord,
        message: 'Teste gerado com sucesso no Sigma!',
      });
    } catch (apiErr: any) {
      activeProcessingKeys.delete(idempotencyKey);

      if (apiErr.status === 408 || apiErr.code === 'timeout_resultado_desconhecido') {
        // Unknown result: network timeout occurred after dispatch
        testRecord.integrationStatus = 'resultado_desconhecido';
        testRecord.errorMessage = apiErr.message;
        testRecord.auditHistory.push({
          timestamp: new Date().toISOString(),
          action: 'TIMEOUT_RESULTADO_DESCONHECIDO',
          user: 'SISTEMA',
          details: 'Timeout de rede. Reconciliação necessária para evitar duplicação.',
        });
        await DatabaseService.saveSigmaTestRequest(testRecord, user.email);

        return res.status(408).json({
          error: 'timeout_resultado_desconhecido',
          message: 'Tempo limite esgotado com a API Sigma. O teste foi registrado como "Resultado Desconhecido" para evitar duplicidades.',
          data: testRecord,
        });
      }

      // Handled API error
      testRecord.integrationStatus = 'erro';
      testRecord.errorMessage = apiErr.message || 'Erro ao processar criação no Sigma.';
      testRecord.auditHistory.push({
        timestamp: new Date().toISOString(),
        action: 'FALHA_CRIACAO_SIGMA',
        user: 'SISTEMA',
        details: `Erro ${apiErr.status || 500}: ${apiErr.message}`,
      });
      await DatabaseService.saveSigmaTestRequest(testRecord, user.email);

      const status = apiErr.status || 500;
      return res.status(status).json({
        error: apiErr.code || 'sigma_error',
        message: apiErr.message || 'Falha ao criar teste no Sigma.',
        errors: apiErr.errors,
        data: testRecord,
      });
    }
  } catch (err: any) {
    activeProcessingKeys.delete(idempotencyKey);
    console.error('Error handling test creation:', err);
    return res.status(500).json({
      error: 'internal_error',
      message: err.message || 'Erro interno ao processar solicitação de teste.',
    });
  }
});

// 6. Approve Pending Test (Master Owner Only)
app.post('/api/sigma/tests/:id/approve', authMiddleware, requireMasterOwner, async (req: Request, res: Response) => {
  const testId = req.params.id;
  const test = await DatabaseService.getSigmaTestRequestById(testId);

  if (!test) {
    return res.status(404).json({ error: 'not_found', message: 'Solicitação não encontrada.' });
  }

  if (test.approvalStatus === 'aprovado' || test.integrationStatus === 'criado') {
    return res.status(400).json({ error: 'invalid_state', message: 'Esta solicitação já foi aprovada/criada.' });
  }

  if (!defaultSigmaService.isConfigured()) {
    return res.status(503).json({
      error: 'missing_token',
      message: 'Token SIGMA_API_TOKEN não está configurado no servidor.',
    });
  }

  test.approvalStatus = 'aprovado';
  test.approvedBy = req.user!.email;
  test.approvedAt = new Date().toISOString();
  test.integrationStatus = 'processando';
  test.auditHistory.push({
    timestamp: new Date().toISOString(),
    action: 'SOLICITACAO_APROVADA_POR_MASTER',
    user: req.user!.email,
    details: 'Aprovado pelo Master Owner. Enviando para criação no Sigma...',
  });

  await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

  try {
    const customer = await defaultSigmaService.createCustomer({
      server_id: test.serverId,
      package_id: test.packageId,
      name: test.clientName,
      whatsapp: test.clientWhatsApp,
      email: test.clientEmail,
      trial_hours: test.trialHours,
      connections: 1,
      note: `Onnix Play - ${test.companyName} (Aprovado por Master)`,
    });

    test.integrationStatus = 'criado';
    test.externalCustomerId = customer.id;
    test.externalUsername = customer.username;
    test.externalPassword = customer.password;
    test.externalExpiresAt = customer.expires_at;
    test.externalExpiresAtTz = customer.expires_at_tz;
    test.externalM3uUrl = customer.m3u_url;
    test.externalM3uShortUrl = customer.m3u_url_short;
    test.externalPlaylist = customer.playlist;
    test.createdAt = customer.created_at || new Date().toISOString();
    test.expiresAt = customer.expires_at;
    test.auditHistory.push({
      timestamp: new Date().toISOString(),
      action: 'TESTE_CRIADO_COM_SUCESSO',
      user: 'SISTEMA_SIGMA',
      details: `Criado no Sigma: ID=${customer.id}, Usuário=${customer.username}`,
    });

    await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

    res.json({
      success: true,
      data: test,
      message: 'Teste aprovado e gerado com sucesso no Sigma!',
    });
  } catch (apiErr: any) {
    if (apiErr.status === 408 || apiErr.code === 'timeout_resultado_desconhecido') {
      test.integrationStatus = 'resultado_desconhecido';
      test.errorMessage = apiErr.message;
      await DatabaseService.saveSigmaTestRequest(test, req.user!.email);
      return res.status(408).json({
        error: 'timeout_resultado_desconhecido',
        message: 'Timeout ao contatar Sigma após aprovação. Reconciliação necessária.',
        data: test,
      });
    }

    test.integrationStatus = 'erro';
    test.errorMessage = apiErr.message || 'Falha ao criar cliente no Sigma.';
    test.auditHistory.push({
      timestamp: new Date().toISOString(),
      action: 'FALHA_APROVACAO_SIGMA',
      user: 'SISTEMA',
      details: `Erro ${apiErr.status || 500}: ${apiErr.message}`,
    });
    await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

    res.status(apiErr.status || 500).json({
      error: apiErr.code || 'sigma_error',
      message: apiErr.message || 'Falha na comunicação com o Sigma.',
      data: test,
    });
  }
});

// 7. Reject Pending Test (Master Owner Only)
app.post('/api/sigma/tests/:id/reject', authMiddleware, requireMasterOwner, async (req: Request, res: Response) => {
  const testId = req.params.id;
  const reason = (req.body.reason || 'Recusado pelo Master Owner').trim();
  const test = await DatabaseService.getSigmaTestRequestById(testId);

  if (!test) {
    return res.status(404).json({ error: 'not_found', message: 'Solicitação não encontrada.' });
  }

  if (test.integrationStatus === 'criado') {
    return res.status(400).json({ error: 'already_created', message: 'Não é possível recusar um teste já criado.' });
  }

  test.approvalStatus = 'rejeitado';
  test.rejectionReason = reason;
  test.integrationStatus = 'erro';
  test.errorMessage = `Recusado: ${reason}`;
  test.auditHistory.push({
    timestamp: new Date().toISOString(),
    action: 'SOLICITACAO_RECUSADA_POR_MASTER',
    user: req.user!.email,
    details: `Motivo: ${reason}`,
  });

  await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

  res.json({
    success: true,
    data: test,
    message: 'Solicitação de teste recusada com sucesso.',
  });
});

// 8. Reconcile Unknown Result
app.post('/api/sigma/tests/:id/reconcile', authMiddleware, async (req: Request, res: Response) => {
  const testId = req.params.id;
  const test = await DatabaseService.getSigmaTestRequestById(testId);

  if (!test) {
    return res.status(404).json({ error: 'not_found', message: 'Solicitação não encontrada.' });
  }

  // Multi-tenant check
  if (req.user!.role !== 'MASTER_OWNER' && test.companyId !== req.user!.companyId) {
    return res.status(403).json({ error: 'forbidden', message: 'Acesso negado a este teste.' });
  }

  if (test.integrationStatus !== 'resultado_desconhecido') {
    return res.json({
      data: test,
      message: `Esta solicitação está com estado '${test.integrationStatus}' e não requer reconciliação.`,
    });
  }

  if (!defaultSigmaService.isConfigured()) {
    return res.status(503).json({
      error: 'missing_token',
      message: 'Token SIGMA_API_TOKEN não está configurado.',
    });
  }

  try {
    // If username was stored or known, search by username
    let foundCustomer = null;
    if (test.externalUsername) {
      foundCustomer = await defaultSigmaService.findCustomerByUsername(test.externalUsername);
    }

    if (foundCustomer) {
      test.integrationStatus = 'criado';
      test.externalCustomerId = foundCustomer.id;
      test.externalExpiresAt = foundCustomer.expires_at;
      test.externalM3uUrl = foundCustomer.m3u_url;
      test.reconciled = true;
      test.auditHistory.push({
        timestamp: new Date().toISOString(),
        action: 'RECONCILIACAO_SUCESSO',
        user: req.user!.email,
        details: `Cliente confirmado no Sigma: ID=${foundCustomer.id}`,
      });
      await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

      return res.json({
        success: true,
        data: test,
        message: 'Reconciliação concluída: O cliente foi localizado e confirmado no Sigma.',
      });
    }

    // Customer was not created on Sigma
    test.integrationStatus = 'erro';
    test.reconciled = true;
    test.errorMessage = 'Reconciliado: A criação não foi efetivada no Sigma. Você pode tentar gerar novamente.';
    test.auditHistory.push({
      timestamp: new Date().toISOString(),
      action: 'RECONCILIACAO_NAO_ENCONTRADO',
      user: req.user!.email,
      details: 'Cliente não foi encontrado no Sigma. Estado liberado para nova tentativa.',
    });
    await DatabaseService.saveSigmaTestRequest(test, req.user!.email);

    res.json({
      success: true,
      data: test,
      message: 'Reconciliação concluída: O cliente não foi gerado no Sigma. Uma nova tentativa pode ser realizada.',
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'reconcile_failed',
      message: err.message || 'Falha ao reconciliar solicitação com o Sigma.',
    });
  }
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================

async function startServer() {
  const isCloudRun = Boolean(process.env.K_SERVICE);
  const isProduction = process.env.NODE_ENV === 'production' || isCloudRun;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      console.warn(`[ONNIX PLAY] Warning: dist/ directory not found at ${distPath}`);
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[ONNIX PLAY] Server running at http://${HOST}:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

// Start server unless imported by unit test runner
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

export { app };
