import React from 'react';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Users,
  CalendarDays,
  FileSpreadsheet,
  FileSignature,
  CreditCard,
  CheckCircle2,
  CalendarCheck,
  MessageSquare,
  Handshake,
  DollarSign,
  UserCheck,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Shield,
  Zap,
  Ticket,
  Tv,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { PermissionKey } from '../../types/index.ts';

export type NavTab =
  | 'dashboard'
  | 'sigma'
  | 'companies'
  | 'invites'
  | 'branches'
  | 'customers'
  | 'monthly'
  | 'plans'
  | 'contracts'
  | 'invoices'
  | 'payments'
  | 'calendar'
  | 'whatsapp'
  | 'partners'
  | 'commissions'
  | 'employees'
  | 'reports'
  | 'settings'
  | 'audit';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  pendingRemindersCount?: number;
}

interface NavItemConfig {
  key: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: PermissionKey;
  masterOnly?: boolean;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  pendingRemindersCount = 0,
}) => {
  const { currentUser, isMasterOwner, hasPermission, logout } = useAuth();

  const navItems: NavItemConfig[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'sigma', label: 'Testes Sigma / IPTV', icon: Tv },
    { key: 'companies', label: 'Empresas Parceiras', icon: Building2, requiredPermission: 'gerenciar_empresas', masterOnly: true },
    { key: 'invites', label: 'Convites de Empresas', icon: Ticket, requiredPermission: 'gerenciar_empresas', masterOnly: true },
    { key: 'branches', label: 'Filiais & Unidades', icon: GitBranch, requiredPermission: 'gerenciar_filiais' },
    { key: 'customers', label: 'Clientes', icon: Users, requiredPermission: 'consultar_clientes' },
    { key: 'monthly', label: 'Mensalistas', icon: CalendarDays, requiredPermission: 'consultar_clientes' },
    { key: 'plans', label: 'Planos', icon: FileSpreadsheet },
    { key: 'contracts', label: 'Contratos', icon: FileSignature, requiredPermission: 'consultar_contratos' },
    { key: 'invoices', label: 'Cobranças', icon: CreditCard, requiredPermission: 'consultar_cobrancas' },
    { key: 'payments', label: 'Pagamentos', icon: CheckCircle2, requiredPermission: 'consultar_cobrancas' },
    { key: 'calendar', label: 'Vencimentos', icon: CalendarCheck },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageSquare,
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined,
    },
    { key: 'partners', label: 'Parceiros', icon: Handshake, requiredPermission: 'administrar_parceiros' },
    { key: 'commissions', label: 'Comissões', icon: DollarSign, requiredPermission: 'consultar_comissoes' },
    { key: 'employees', label: 'Usuários & Equipe', icon: UserCheck, masterOnly: true },
    { key: 'reports', label: 'Relatórios', icon: BarChart3, requiredPermission: 'consultar_relatorios' },
    { key: 'settings', label: 'Configurações', icon: Settings },
    { key: 'audit', label: 'Auditoria', icon: ShieldCheck, masterOnly: true },
  ];

  const filteredItems = navItems.filter(item => {
    if (isMasterOwner) return true;
    if (item.masterOnly) return false;
    if (item.requiredPermission) return hasPermission(item.requiredPermission);
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-[#080d1a] border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-blue-950/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-wider text-white">ONNIX</span>
                <span className="text-lg font-black tracking-wider text-cyan-400">PLAY</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase block -mt-1">
                SISTEMA DE GESTÃO
              </span>
            </div>
          </div>
        </div>

        {/* User Status / Role Pill */}
        <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isMasterOwner
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {isMasterOwner ? <Shield className="w-3.5 h-3.5" /> : currentUser?.displayName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {currentUser?.displayName || 'Usuário'}
                </p>
                <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-mono uppercase">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isMasterOwner
                        ? 'bg-purple-400'
                        : currentUser?.role === 'EMPRESA_ADMIN'
                        ? 'bg-blue-400'
                        : currentUser?.role === 'GERENTE_FILIAL'
                        ? 'bg-purple-400'
                        : 'bg-cyan-400'
                    }`}
                  />
                  {isMasterOwner
                    ? 'MASTER OWNER'
                    : currentUser?.role === 'EMPRESA_ADMIN'
                    ? 'ADMIN EMPRESA'
                    : currentUser?.role === 'GERENTE_FILIAL'
                    ? 'GERENTE FILIAL'
                    : currentUser?.role || 'COLABORADOR'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          {filteredItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelectTab(item.key);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-950/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
};
