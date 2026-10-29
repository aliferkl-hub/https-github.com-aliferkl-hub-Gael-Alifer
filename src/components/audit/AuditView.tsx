import React, { useState } from 'react';
import { AuditLog } from '../../types/index.ts';
import { formatBrDate } from '../../lib/date.ts';
import { ShieldCheck, Search, Filter, Lock, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface AuditViewProps {
  logs: AuditLog[];
}

export const AuditView: React.FC<AuditViewProps> = ({ logs }) => {
  const { isMasterOwner } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('todos');

  if (!isMasterOwner) {
    return (
      <div className="p-8 text-center bg-[#0b1222] border border-rose-500/30 rounded-2xl">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="text-base font-bold text-white">Acesso Exclusivo do Master Owner</h3>
        <p className="text-xs text-slate-400 mt-1">
          A trilha de auditoria é protegida e de consulta restrita ao Master Owner para garantir a conformidade LGPD.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    const matchSearch =
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchAction = actionFilter === 'todos' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Trilha de Auditoria Imutável (LGPD & Compliance)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Registro cronológico inalterável de todas as ações administrativas, alterações cadastrais e acessos.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-950/30 border border-purple-500/30 rounded-xl text-purple-300 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          <span>Registros Criptograficamente Protegidos</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por operador, ação, entidade ou detalhes..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="todos">Todas as Ações</option>
          <option value="CLIENTE_CRIADO">Cliente Criado</option>
          <option value="CLIENTE_ATUALIZADO">Cliente Atualizado</option>
          <option value="PAGAMENTO_CONFIRMADO">Pagamento Confirmado</option>
          <option value="CONTRATO_EMITIDO">Contrato Emitido</option>
          <option value="LOGIN_SENHA_MASTER">Login Master Owner</option>
          <option value="MENSAGEM_DISPARADA">Mensagem Disparada</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Data e Hora</th>
                <th className="py-3 px-4">Usuário / Operador</th>
                <th className="py-3 px-4">Ação Realizada</th>
                <th className="py-3 px-4">Entidade</th>
                <th className="py-3 px-4">Detalhamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {formatBrDate(log.timestamp)} às {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {log.userEmail}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-slate-800 text-cyan-300 border border-cyan-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-400">
                      {log.entityType} ({log.entityId})
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
