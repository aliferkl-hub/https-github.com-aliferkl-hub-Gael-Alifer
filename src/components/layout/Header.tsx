import React, { useState } from 'react';
import { Menu, Search, Bell, RefreshCw, Shield, Sparkles, Building2, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';
import { PartnerCompany } from '../../types/index.ts';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  pendingRemindersCount: number;
  onNavigateToWhatsApp: () => void;
  onRefreshData: () => void;
  companies?: PartnerCompany[];
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  pendingRemindersCount,
  onNavigateToWhatsApp,
  onRefreshData,
  companies = [],
}) => {
  const { currentUser, isMasterOwner, activeCompanyId, setActiveCompanyId } = useAuth();
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [engineSuccessMsg, setEngineSuccessMsg] = useState<string | null>(null);

  const activeCompany = companies.find(c => c.id === activeCompanyId);

  const handleRunRecurrence = async () => {
    setIsRunningEngine(true);
    setEngineSuccessMsg(null);
    try {
      const res = await DatabaseService.runRecurrenceEngine(currentUser?.email || 'manual');
      onRefreshData();
      setEngineSuccessMsg(
        `Recorrência concluída: ${res.invoicesGenerated} faturas geradas, ${res.remindersFound} lembretes D-2, ${res.invoicesOverdueUpdated} vencidas atualizadas.`
      );
      setTimeout(() => setEngineSuccessMsg(null), 5000);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao executar motor de recorrência.');
    } finally {
      setIsRunningEngine(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#080d1a]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-white font-semibold">ONNIX PLAY</span>
          <span>/</span>
          <span className="text-cyan-400">Portal de Gestão</span>
        </div>

        {/* Company Context Switcher for Master Owner */}
        {isMasterOwner && companies.length > 0 && (
          <div className="hidden md:flex items-center gap-2 ml-3 pl-3 border-l border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-cyan-500/30 rounded-xl px-2.5 py-1 text-xs shadow-inner">
              {activeCompanyId === 'TODAS' ? (
                <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              )}
              <select
                value={activeCompanyId}
                onChange={e => setActiveCompanyId(e.target.value)}
                className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer pr-1"
                title="Selecione o escopo da empresa para filtrar visão geral e operações"
              >
                <option value="TODAS" className="bg-slate-900 text-white">
                  🌐 Rede Global (Todas as Empresas)
                </option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    🏢 {c.tradeName} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Current Company indicator for Non-Master users */}
        {!isMasterOwner && activeCompany && (
          <div className="hidden md:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-800 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-white">{activeCompany.tradeName}</span>
          </div>
        )}
      </div>

      {/* Center: Recurrence Engine Feedback Banner */}
      {engineSuccessMsg && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{engineSuccessMsg}</span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Recurrence Engine Trigger Button */}
        <button
          onClick={handleRunRecurrence}
          disabled={isRunningEngine}
          title="Executar motor de recorrência e vencimentos agora"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/60 hover:border-cyan-400 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunningEngine ? 'animate-spin text-cyan-400' : ''}`} />
          <span className="hidden sm:inline">Motor de Recorrência</span>
        </button>

        {/* WhatsApp D-2 Reminder Alert */}
        <button
          onClick={onNavigateToWhatsApp}
          title={`${pendingRemindersCount} lembretes com vencimento em 2 dias (D-2)`}
          className="relative p-2 text-slate-300 hover:text-white rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {pendingRemindersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-extrabold text-slate-950 animate-bounce">
              {pendingRemindersCount}
            </span>
          )}
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white leading-tight">
              {currentUser?.displayName || 'Master Owner'}
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">
              {currentUser?.email}
            </p>
          </div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              isMasterOwner
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-900/30'
                : 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
            }`}
          >
            {isMasterOwner ? <Shield className="w-4 h-4" /> : currentUser?.displayName?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};
