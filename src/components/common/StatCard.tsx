import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'blue' | 'purple' | 'emerald' | 'amber' | 'rose';
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'cyan',
  badge,
  badgeType = 'info',
  onClick,
}) => {
  const variantStyles = {
    cyan: 'border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-900/40 text-cyan-400 group-hover:border-cyan-400/40',
    blue: 'border-blue-500/20 bg-gradient-to-br from-blue-950/20 to-slate-900/40 text-blue-400 group-hover:border-blue-400/40',
    purple: 'border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-slate-900/40 text-purple-400 group-hover:border-purple-400/40',
    emerald: 'border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-slate-900/40 text-emerald-400 group-hover:border-emerald-400/40',
    amber: 'border-amber-500/20 bg-gradient-to-br from-amber-950/20 to-slate-900/40 text-amber-400 group-hover:border-amber-400/40',
    rose: 'border-rose-500/20 bg-gradient-to-br from-rose-950/20 to-slate-900/40 text-rose-400 group-hover:border-rose-400/40',
  }[variant];

  const iconBgStyles = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  }[variant];

  const badgeStyles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  }[badgeType];

  return (
    <div
      onClick={onClick}
      className={`group relative p-5 rounded-2xl border transition-all duration-300 ${variantStyles} ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
            {title}
          </span>
          <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgStyles}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
            {badge}
          </span>
        </div>
      )}
    </div>
  );
};
