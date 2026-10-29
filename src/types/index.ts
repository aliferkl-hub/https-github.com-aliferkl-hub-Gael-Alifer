/**
 * Types and Data Contracts for ONNIX PLAY Gestão Empresarial Multiempresa
 */

export type UserRole =
  | 'MASTER_OWNER'
  | 'EMPRESA_ADMIN'
  | 'GERENTE_FILIAL'
  | 'COMERCIAL'
  | 'FINANCEIRO'
  | 'CONSULTA'
  | 'EMPLOYEE';

export type UserStatus = 'ativo' | 'inativo' | 'suspenso' | 'pendente';

export type PermissionKey =
  | 'consultar_clientes'
  | 'cadastrar_clientes'
  | 'editar_clientes'
  | 'consultar_contratos'
  | 'emitir_contratos'
  | 'consultar_cobrancas'
  | 'registrar_pagamentos'
  | 'consultar_relatorios'
  | 'administrar_parceiros'
  | 'consultar_comissoes'
  | 'exportar_dados'
  | 'gerenciar_empresas'
  | 'gerenciar_filiais'
  | 'transferir_registros';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  companyId?: string; // null for Master Owner (global access)
  branchId?: string;  // null for Master Owner or Company Admin
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string; // e.g. "Administrador da Empresa", "Gerente de Filial", "Comercial"
  userRoleType: UserRole;
  companyId?: string;
  branchId?: string;
  status: UserStatus;
  permissions: PermissionKey[];
  createdAt: string;
  createdBy: string;
}

export interface UserCredentials {
  email: string;
  passwordHash?: string;
  salt?: string;
  role: UserRole;
  companyId?: string;
  branchId?: string;
  name: string;
  status: UserStatus;
  inviteCode?: string;
  inviteExpiresAt?: string;
  isPasswordSet: boolean;
  mustChangePasswordOnNextLogin?: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
}

export type InviteStatus = 'pendente' | 'utilizado' | 'expirado' | 'revogado';
export type InviteType = 'nova_empresa' | 'empresa_existente';
export type InviteApprovalStatus = 'nenhuma' | 'pendente_aprovacao' | 'aprovado' | 'rejeitado';

export interface CompanyInvite {
  id: string;
  code: string; // e.g. "ONNIX-PARCEIRO-2026", "ONX-INV-7A8B-9C1D"
  type: InviteType;
  status: InviteStatus;

  // Target company info (if for existing company)
  companyId?: string;
  companyName?: string;

  // Pre-configured defaults for new company
  suggestedPlan?: string;
  suggestedModules?: string[];
  suggestedBranchesLimit?: number;
  suggestedClientsLimit?: number;

  // Recipient / intended contact
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;

  // Usage and validity
  maxUses: number; // 1 (uso único)
  usedCount: number;
  expiresAt: string; // ISO string
  createdAt: string;
  createdBy: string;

  // Usage tracking
  usedAt?: string;
  usedByEmail?: string;
  registeredCompanyId?: string;
  registeredCompanyName?: string;

  // Approval workflow
  requiresApproval: boolean;
  approvalStatus?: InviteApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;

  // Revocation
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;

  // Internal notes
  notes?: string;
}

export type CompanyStatus = 'ativa' | 'pendente' | 'suspensa' | 'inativa';

export interface PartnerCompany {
  id: string;
  code: string; // e.g. EMP-001
  corporateName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  cnpj: string;
  contactName: string; // Responsável pela empresa
  contactRole: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  logoUrl?: string;
  status: CompanyStatus;
  planContracted: string; // e.g. "Empresarial Platinum", "Enterprise 50"
  branchesLimit: number;
  clientsLimit: number;
  modulesAllowed: string[]; // ['clientes', 'contratos', 'filiais', 'cobrancas', 'relatorios']
  adminEmail: string;
  adminName: string;
  hasCredentialsConfigured?: boolean;
  lastInviteCode?: string;
  lastInviteGeneratedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type BranchStatus = 'ativa' | 'suspensa' | 'inativa';

export interface Branch {
  id: string;
  code: string; // e.g. FIL-001
  companyId: string; // Empresa matriz vinculada
  name: string; // Nome da unidade (e.g. "Filial Campinas")
  cnpj?: string;
  managerName: string; // Responsável pela filial
  managerEmail: string;
  phone: string;
  email: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  status: BranchStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CustomerStatus = 'ativo' | 'inativo' | 'pendente' | 'inadimplente';

export interface Customer {
  id: string;
  code: string; // e.g., ONX-001
  name: string;
  cpf: string;
  whatsapp: string; // E.164 or formatted with country code
  email?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string;
  registrationDate: string;
  source: string; // "Indicação", "Instagram", "Google", "WhatsApp", etc.
  companyId: string; // Empresa responsável (Multiempresa)
  branchId?: string; // Filial responsável
  employeeResponsibleId?: string;
  partnerId?: string;
  notes?: string;
  status: CustomerStatus;
  dataConsent: boolean; // LGPD consent
  createdAt: string;
  updatedAt?: string;
}

export type BillingCycle = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // in BRL float or centavos, we handle in standard currency format
  billingCycle: BillingCycle;
  durationMonths: number;
  renewalRules: string;
  terms: string;
  additionalFees: number;
  allowedDiscounts: number;
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export type SubscriptionStatus = 'ativa' | 'cancelada' | 'suspensa' | 'finalizada';

export interface Subscription {
  id: string;
  customerId: string;
  companyId?: string;
  branchId?: string;
  planId: string;
  startDate: string; // YYYY-MM-DD
  firstDueDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  contractValue: number;
  discountApplied: number;
  billingCycle: BillingCycle;
  endDate?: string;
  autoRenew: boolean;
  customRules?: string;
  responsibleEmployeeId?: string;
  status: SubscriptionStatus;
  createdAt: string;
}

export type ContractStatus =
  | 'rascunho'
  | 'aguardando_assinatura'
  | 'emitido'
  | 'assinado'
  | 'ativo'
  | 'suspenso'
  | 'encerrado'
  | 'vencido'
  | 'cancelado';

export interface ContractAttachment {
  name: string;
  url: string;
  uploadedAt: string;
}

export interface Contract {
  id: string;
  documentNumber: string; // e.g. ONX-CTR-2026-001
  customerId: string;
  companyId: string; // Empresa responsável
  branchId?: string;  // Filial responsável
  subscriptionId?: string;
  templateId?: string;
  title: string;
  content: string; // complete contract text with replaced variables
  terms: string;
  dynamicValues: Record<string, string>;
  status: ContractStatus;
  issuedAt: string;
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  contractValue?: number;
  signedAt?: string;
  signedBy?: string;
  version: number;
  attachments?: ContractAttachment[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  templateContent: string;
  defaultClauses: string;
  isDefault: boolean;
  createdAt: string;
}

export type InvoiceStatus =
  | 'agendada'
  | 'pendente'
  | 'enviada'
  | 'vencida'
  | 'parcialmente_paga'
  | 'paga'
  | 'cancelada'
  | 'em_contestacao';

export type PaymentMethod = 'PIX' | 'Boleto' | 'Cartão' | 'Transferência' | 'Dinheiro';

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. FAT-2026-0001
  customerId: string;
  companyId?: string;
  branchId?: string;
  subscriptionId?: string;
  planId?: string;
  amount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  referencePeriod: string; // e.g. "Outubro/2026"
  description: string;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  paidDate?: string;
  paidAmount?: number;
  transactionReference?: string;
  notes?: string;
  reminderStatus?: 'nenhum' | 'pendente_d2' | 'lembrete_enviado' | 'aviso_vencido_enviado';
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  companyId?: string;
  branchId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  registeredBy: string; // user email
  notes?: string;
  createdAt: string;
}

export type PartnerStatus = 'ativo' | 'inativo';
export type CommissionRuleType = 'percentual' | 'fixo' | 'misto';

export interface Partner {
  id: string;
  code: string; // e.g. PARC-001
  name: string;
  docNumber: string; // CPF or CNPJ
  whatsapp: string;
  email: string;
  address?: string;
  joinDate: string;
  commissionRuleType: CommissionRuleType;
  defaultCommissionRate: number; // percentage (e.g. 10 for 10%)
  defaultFixedAmount: number; // fixed amount in BRL
  status: PartnerStatus;
  contactInfo?: string;
  notes?: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  partnerId: string;
  customerId: string;
  referralDate: string;
  planId?: string;
  status: 'ativa' | 'cancelada';
  createdAt: string;
}

export type CommissionStatus = 'prevista' | 'calculada' | 'aprovada' | 'paga' | 'estornada';

export interface Commission {
  id: string;
  partnerId: string;
  referralId?: string;
  invoiceId: string;
  customerId: string;
  eligiblePaymentAmount: number;
  commissionAmount: number;
  status: CommissionStatus;
  calculationDate: string;
  paidDate?: string;
  reversalDate?: string;
  notes?: string;
  createdAt: string;
}

export interface ReminderJob {
  id: string;
  customerId: string;
  invoiceId: string;
  scheduledFor: string; // YYYY-MM-DD
  status: 'pendente' | 'enviado' | 'cancelado' | 'falha';
  messageType: 'lembrete_2_dias' | 'vencido' | 'confirmacao_pagamento' | 'contrato';
  messageContent: string;
  executedAt?: string;
  createdAt: string;
}

export interface MessageLog {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  messageType: 'lembrete_2_dias' | 'cobranca_vencida' | 'confirmacao_pagamento' | 'contrato_disponivel' | 'livre';
  channel: 'whatsapp_click' | 'whatsapp_api';
  content: string;
  status: 'preparada' | 'enviada' | 'entregue' | 'lida' | 'falha';
  sentAt: string;
  sentBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail: string;
  companyId?: string;
  branchId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface CompanySettings {
  companyName: string;
  tradeName: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  pixKey: string;
  pixKeyType: 'CNPJ' | 'Email' | 'Telefone' | 'Aleatoria';
  defaultPaymentTerms: string;
  reminderDaysBefore: number; // default 2
}

export interface WhatsAppApiSettings {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  permanentAccessToken: string;
  webhookVerifyToken: string;
  templateNamespace: string;
}

export interface MasterOwnerCredentials {
  email: string;
  passwordHash: string;
  salt: string;
  isConfigured: boolean;
  configuredAt?: string;
  twoFactorEnabled?: boolean;
  securityAnswerHash?: string;
}

// ==========================================
// SIGMA / ATMOS RESELLER API INTEGRATION
// ==========================================

export type SigmaIntegrationStatus = 'nao_configurada' | 'configurada' | 'erro' | 'indisponivel';

export interface SigmaServer {
  id: string;
  name: string;
  type?: string;
  status: string;
  timezone?: string | null;
  connection_type?: string | null;
  has_default_customer_password?: boolean;
  will_count_membership?: 'YES' | 'NO' | null;
  is_isplock?: 'YES' | 'NO' | null;
  cost_per_customer?: any;
  max_customers?: number | null;
  max_connections?: number | null;
  api_version?: string | null;
}

export interface SigmaPackage {
  id: string;
  server_id: string;
  server?: string | null;
  name: string;
  status: string;
  is_trial?: 'YES' | 'NO' | null;
  is_adult?: boolean;
  plan_price?: number;
  credits?: number;
  duration?: number;
  duration_in?: string;
  connections?: number;
}

export interface SigmaConfig {
  id?: string;
  status: SigmaIntegrationStatus;
  hasToken: boolean;
  baseUrl: string;
  requiredScopes: string[];
  lastCheckedAt?: string;
  lastError?: string;
  defaultServerId?: string;
  defaultServerName?: string;
  defaultPackageId?: string;
  defaultPackageName?: string;
  allowedTrialHours: number[];
  defaultTrialHours: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SigmaCompanySettings {
  companyId: string;
  companyName: string;
  autoApproval: boolean; // true = Modo A (Geração Automática); false = Modo B (Exige Aprovação)
  maxDailyTests: number;
  maxMonthlyTests: number;
  allowedServerIds?: string[];
  allowedPackageIds?: string[];
  allowedTrialHours?: number[];
  enabled: boolean;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type SigmaApprovalStatus = 'auto_aprovado' | 'pendente_aprovacao' | 'aprovado' | 'rejeitado';
export type SigmaExternalStatus = 'pendente' | 'processando' | 'criado' | 'erro' | 'resultado_desconhecido';

export interface SigmaTestRequest {
  id: string;
  idempotencyKey: string;
  companyId: string;
  companyName: string;
  requestedByUserId: string;
  requestedByUserEmail: string;
  requestedByUserName: string;
  clientName: string;
  clientWhatsApp: string;
  clientEmail?: string;
  clientNotes?: string;
  serverId: string;
  serverName: string;
  packageId: string;
  packageName: string;
  trialHours: number;
  approvalStatus: SigmaApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  integrationStatus: SigmaExternalStatus;
  externalCustomerId?: string;
  externalUsername?: string;
  externalPassword?: string;
  externalExpiresAt?: string;
  externalExpiresAtTz?: string;
  externalM3uUrl?: string;
  externalM3uShortUrl?: string;
  externalPlaylist?: string;
  errorMessage?: string;
  lastAttemptAt?: string;
  retryCount?: number;
  requestedAt: string;
  createdAt?: string;
  expiresAt?: string;
  reconciled?: boolean;
  auditHistory: {
    timestamp: string;
    action: string;
    user: string;
    details?: string;
  }[];
}

