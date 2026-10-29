import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginView } from './components/auth/LoginView.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { CustomerList } from './components/customers/CustomerList.tsx';
import { MonthlySubscribersView } from './components/monthly/MonthlySubscribersView.tsx';
import { PlansView } from './components/plans/PlansView.tsx';
import { ContractsView } from './components/contracts/ContractsView.tsx';
import { InvoicesView } from './components/invoices/InvoicesView.tsx';
import { PaymentsView } from './components/payments/PaymentsView.tsx';
import { DueDatesCalendar } from './components/calendar/DueDatesCalendar.tsx';
import { WhatsAppView } from './components/whatsapp/WhatsAppView.tsx';
import { PartnersView } from './components/partners/PartnersView.tsx';
import { CommissionsView } from './components/commissions/CommissionsView.tsx';
import { EmployeesView } from './components/employees/EmployeesView.tsx';
import { CompaniesView } from './components/companies/CompaniesView.tsx';
import { CompanyInvitesView } from './components/invites/CompanyInvitesView.tsx';
import { BranchesView } from './components/branches/BranchesView.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { AuditView } from './components/audit/AuditView.tsx';
import { SigmaView } from './components/sigma/SigmaView.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import {
  Customer,
  Plan,
  Subscription,
  Contract,
  ContractTemplate,
  Invoice,
  Payment,
  Partner,
  Commission,
  EmployeeProfile,
  CompanySettings,
  MessageLog,
  AuditLog,
  PartnerCompany,
  Branch,
  CompanyInvite,
} from './types/index.ts';
import {
  DatabaseService,
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_CONTRACT_TEMPLATE,
  INITIAL_PLANS,
} from './lib/db.ts';
import { getDaysDiff, getTodaySaoPaulo } from './lib/date.ts';

const MainLayout: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // App domain state
  const [companies, setCompanies] = useState<PartnerCompany[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchCompanyId, setSelectedBranchCompanyId] = useState<string | undefined>(undefined);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([DEFAULT_CONTRACT_TEMPLATE]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);

  // Cross-view navigation state
  const [customerForContract, setCustomerForContract] = useState<Customer | null>(null);

  // Fetch all domain data with multi-tenant company and branch scoping
  const loadAllData = useCallback(async () => {
    try {
      const targetCompanyId = currentUser?.role === 'MASTER_OWNER' ? undefined : currentUser?.companyId;
      const targetBranchId =
        currentUser?.role === 'MASTER_OWNER' || currentUser?.role === 'EMPRESA_ADMIN'
          ? undefined
          : currentUser?.branchId;

      const [
        comps,
        invsList,
        brnchs,
        custs,
        plns,
        subs,
        ctrs,
        tmps,
        invs,
        pays,
        parts,
        comms,
        emps,
        msgs,
        audits,
        sttgs,
      ] = await Promise.all([
        DatabaseService.getCompanies(),
        DatabaseService.getCompanyInvites(),
        DatabaseService.getBranches(targetCompanyId),
        DatabaseService.getCustomers(targetCompanyId, targetBranchId),
        DatabaseService.getPlans(),
        DatabaseService.getSubscriptions(targetCompanyId),
        DatabaseService.getContracts(targetCompanyId, targetBranchId),
        DatabaseService.getContractTemplates(),
        DatabaseService.getInvoices(targetCompanyId, targetBranchId),
        DatabaseService.getPayments(targetCompanyId, targetBranchId),
        DatabaseService.getPartners(),
        DatabaseService.getCommissions(),
        DatabaseService.getEmployees(targetCompanyId, targetBranchId),
        DatabaseService.getMessageLogs(),
        DatabaseService.getAuditLogs(targetCompanyId),
        DatabaseService.getSettings(),
      ]);

      setCompanies(comps);
      setInvites(invsList);
      setBranches(brnchs);
      setCustomers(custs);
      setPlans(plns);
      setSubscriptions(subs);
      setContracts(ctrs);
      setTemplates(tmps);
      setInvoices(invs);
      setPayments(pays);
      setPartners(parts);
      setCommissions(comms);
      setEmployees(emps);
      setMessageLogs(msgs);
      setAuditLogs(audits);
      setSettings(sttgs);
    } catch (e) {
      console.warn('Error loading data:', e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadAllData();
      // Run recurrence engine automatically on login to update cycles and D-2 reminders
      DatabaseService.runRecurrenceEngine(currentUser.email)
        .then(() => loadAllData())
        .catch(console.warn);
    }
  }, [currentUser, loadAllData]);

  // Compute D-2 reminders count
  const pendingRemindersCount = useMemo(() => {
    const today = getTodaySaoPaulo();
    return invoices.filter(inv => {
      if (inv.status === 'paga' || inv.status === 'cancelada') return false;
      const diff = getDaysDiff(inv.dueDate, today);
      return diff === 2;
    }).length;
  }, [invoices]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-pulse mb-4">
          <div className="w-5 h-5 rounded-full bg-cyan-400" />
        </div>
        <p className="text-xs uppercase font-bold text-slate-400 tracking-widest">
          Carregando ONNIX PLAY Gestão...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          setCurrentTab(tab);
          setCustomerForContract(null);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        pendingRemindersCount={pendingRemindersCount}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0">
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          pendingRemindersCount={pendingRemindersCount}
          onNavigateToWhatsApp={() => setCurrentTab('whatsapp')}
          onRefreshData={loadAllData}
          companies={companies}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              customers={customers}
              invoices={invoices}
              payments={payments}
              contracts={contracts}
              partners={partners}
              commissions={commissions}
              employees={employees}
              plans={plans}
              companies={companies}
              branches={branches}
              onNavigate={tab => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'sigma' && (
            <ErrorBoundary fallbackTitle="Erro ao carregar o módulo Sigma / IPTV">
              <SigmaView companies={companies || []} />
            </ErrorBoundary>
          )}

          {currentTab === 'companies' && (
            <CompaniesView
              companies={companies}
              branches={branches}
              customers={customers}
              onRefresh={loadAllData}
              onNavigateToBranches={companyId => {
                setSelectedBranchCompanyId(companyId);
                setCurrentTab('branches');
              }}
            />
          )}

          {currentTab === 'invites' && (
            <CompanyInvitesView
              invites={invites}
              companies={companies}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'branches' && (
            <BranchesView
              branches={branches}
              companies={companies}
              customers={customers}
              contracts={contracts}
              onRefresh={loadAllData}
              preselectedCompanyId={selectedBranchCompanyId}
            />
          )}

          {currentTab === 'customers' && (
            <CustomerList
              customers={customers}
              partners={partners}
              employees={employees}
              plans={plans}
              contracts={contracts}
              invoices={invoices}
              subscriptions={subscriptions}
              companies={companies}
              branches={branches}
              onRefresh={loadAllData}
              onOpenContractGenerator={cust => {
                setCustomerForContract(cust);
                setCurrentTab('contracts');
              }}
            />
          )}

          {currentTab === 'monthly' && (
            <MonthlySubscribersView
              customers={customers}
              subscriptions={subscriptions}
              plans={plans}
              invoices={invoices}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'plans' && (
            <PlansView plans={plans} onRefresh={loadAllData} />
          )}

          {currentTab === 'contracts' && (
            <ContractsView
              contracts={contracts}
              customers={customers}
              plans={plans}
              templates={templates}
              settings={settings}
              companies={companies}
              branches={branches}
              selectedCustomerForContract={customerForContract}
              onClearCustomerSelection={() => setCustomerForContract(null)}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoicesView
              invoices={invoices}
              customers={customers}
              plans={plans}
              pixKey={settings.pixKey}
              onRefresh={loadAllData}
              onTriggerWhatsApp={(cust, inv) => {
                setCurrentTab('whatsapp');
              }}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentsView
              payments={payments}
              customers={customers}
              invoices={invoices}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'calendar' && (
            <DueDatesCalendar
              invoices={invoices}
              customers={customers}
              plans={plans}
              partners={partners}
              employees={employees}
              onOpenCustomer={cust => {
                setCurrentTab('customers');
              }}
              onTriggerWhatsApp={(cust, inv) => {
                setCurrentTab('whatsapp');
              }}
            />
          )}

          {currentTab === 'whatsapp' && (
            <WhatsAppView
              customers={customers}
              invoices={invoices}
              plans={plans}
              messageLogs={messageLogs}
              pixKey={settings.pixKey}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'partners' && (
            <PartnersView
              partners={partners}
              customers={customers}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'commissions' && (
            <CommissionsView
              commissions={commissions}
              partners={partners}
              customers={customers}
              invoices={invoices}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'employees' && (
            <EmployeesView
              employees={employees}
              companies={companies}
              branches={branches}
              onRefresh={loadAllData}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              customers={customers}
              invoices={invoices}
              payments={payments}
              contracts={contracts}
              partners={partners}
              commissions={commissions}
              plans={plans}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView settings={settings} onRefresh={loadAllData} />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={auditLogs} />
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
