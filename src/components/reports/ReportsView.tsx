import React, { useState } from 'react';
import { Customer, Invoice, Payment, Contract, Partner, Commission, Plan } from '../../types/index.ts';
import { formatBRL, formatBrDate } from '../../lib/date.ts';
import { maskCpf } from '../../lib/cpf.ts';
import { exportToCsv } from '../../lib/export.ts';
import { BarChart3, Download, Printer, Filter, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface ReportsViewProps {
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
  partners: Partner[];
  commissions: Commission[];
  plans: Plan[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  customers,
  invoices,
  payments,
  contracts,
  partners,
  commissions,
  plans,
}) => {
  const { hasPermission, isMasterOwner } = useAuth();
  const [selectedReport, setSelectedReport] = useState<
    'clientes' | 'cobrancas' | 'inadimplencia' | 'parceiros' | 'contratos'
  >('cobrancas');

  const canExport = isMasterOwner || hasPermission('exportar_dados');

  // Handle Export based on selected report
  const handleExport = () => {
    if (selectedReport === 'clientes') {
      const rows = customers.map(c => ({
        Codigo: c.code,
        Nome: c.name,
        CPF: maskCpf(c.cpf),
        WhatsApp: c.whatsapp,
        Status: c.status,
        Cidade: c.city,
        UF: c.state,
        DataCadastro: formatBrDate(c.registrationDate),
      }));
      exportToCsv('relatorio_clientes_onnix', rows);
    } else if (selectedReport === 'cobrancas') {
      const rows = invoices.map(i => {
        const cust = customers.find(c => c.id === i.customerId);
        return {
          Fatura: i.invoiceNumber,
          Cliente: cust?.name || '',
          Valor: formatBRL(i.amount),
          Vencimento: formatBrDate(i.dueDate),
          Status: i.status,
          DataPagamento: i.paidDate ? formatBrDate(i.paidDate) : '',
          Forma: i.paymentMethod,
        };
      });
      exportToCsv('relatorio_cobrancas_onnix', rows);
    } else if (selectedReport === 'inadimplencia') {
      const overdue = invoices.filter(i => i.status === 'vencida');
      const rows = overdue.map(i => {
        const cust = customers.find(c => c.id === i.customerId);
        return {
          Fatura: i.invoiceNumber,
          Cliente: cust?.name || '',
          WhatsApp: cust?.whatsapp || '',
          ValorDevido: formatBRL(i.amount),
          VencidoDesde: formatBrDate(i.dueDate),
        };
      });
      exportToCsv('relatorio_inadimplencia_onnix', rows);
    } else if (selectedReport === 'parceiros') {
      const rows = commissions.map(c => {
        const partner = partners.find(p => p.id === c.partnerId);
        return {
          ID_Comissao: c.id,
          Parceiro: partner?.name || '',
          ValorPagoCliente: formatBRL(c.eligiblePaymentAmount),
          Comissao: formatBRL(c.commissionAmount),
          Status: c.status,
          DataCalculo: formatBrDate(c.calculationDate),
        };
      });
      exportToCsv('relatorio_comissoes_parceiros', rows);
    } else {
      const rows = contracts.map(c => {
        const cust = customers.find(cust => cust.id === c.customerId);
        return {
          NumeroContrato: c.documentNumber,
          Titulo: c.title,
          Contratante: cust?.name || c.dynamicValues?.nome_cliente || '',
          Status: c.status,
          Emissao: formatBrDate(c.issuedAt),
          Versao: c.version,
        };
      });
      exportToCsv('relatorio_contratos_onnix', rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Central de Relatórios Executivos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Demonstrativos financeiros, controle de inadimplência e extratos de repasse para exportação.
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Imprimir Relatório</span>
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Dados em CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Select Report Type */}
      <div className="flex flex-wrap items-center gap-2 bg-[#0b1222] border border-cyan-500/20 p-2 rounded-2xl">
        {[
          { key: 'cobrancas', label: 'Cobranças & Faturamento' },
          { key: 'clientes', label: 'Base de Clientes & Mensalistas' },
          { key: 'inadimplencia', label: 'Inadimplência & Cobranças Vencidas' },
          { key: 'parceiros', label: 'Comissões & Parceiros' },
          { key: 'contratos', label: 'Contratos Emitidos' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedReport(tab.key as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              selectedReport === tab.key
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content depending on selected report */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 shadow-xl">
        {selectedReport === 'cobrancas' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Relatório Consolidado de Cobranças</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Fatura</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Vencimento</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Pago Em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3">{customers.find(c => c.id === inv.customerId)?.name || 'Cliente'}</td>
                      <td className="py-2.5 px-3">{formatBrDate(inv.dueDate)}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{formatBRL(inv.amount)}</td>
                      <td className="py-2.5 px-3 capitalize">{inv.status}</td>
                      <td className="py-2.5 px-3 text-slate-400">{inv.paidDate ? formatBrDate(inv.paidDate) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'inadimplencia' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Relatório de Clientes e Cobranças Inadimplentes
            </h3>
            {invoices.filter(i => i.status === 'vencida').length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Nenhuma fatura em atraso.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Fatura</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">WhatsApp</th>
                      <th className="py-2.5 px-3">Vencimento</th>
                      <th className="py-2.5 px-3">Valor em Aberto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {invoices
                      .filter(i => i.status === 'vencida')
                      .map(inv => {
                        const cust = customers.find(c => c.id === inv.customerId);
                        return (
                          <tr key={inv.id}>
                            <td className="py-2.5 px-3 font-mono text-rose-400 font-bold">{inv.invoiceNumber}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{cust?.name || 'Cliente'}</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400">{cust?.whatsapp}</td>
                            <td className="py-2.5 px-3 text-rose-400 font-bold">{formatBrDate(inv.dueDate)}</td>
                            <td className="py-2.5 px-3 font-black text-white">{formatBRL(inv.amount)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedReport === 'clientes' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Relatório de Assinantes Cadastrados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3">WhatsApp</th>
                    <th className="py-2.5 px-3">Cidade/UF</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{c.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{c.whatsapp}</td>
                      <td className="py-2.5 px-3">{c.city}/{c.state}</td>
                      <td className="py-2.5 px-3 capitalize">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'parceiros' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Extrato de Comissões por Afiliado</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Parceiro</th>
                    <th className="py-2.5 px-3">Valor Base</th>
                    <th className="py-2.5 px-3">Comissão Calculada</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {commissions.map(comm => (
                    <tr key={comm.id}>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {partners.find(p => p.id === comm.partnerId)?.name || 'Parceiro'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{formatBRL(comm.eligiblePaymentAmount)}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">{formatBRL(comm.commissionAmount)}</td>
                      <td className="py-2.5 px-3 capitalize">{comm.status}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatBrDate(comm.calculationDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedReport === 'contratos' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Relatório de Instrumentos Contratuais Emitidos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Número</th>
                    <th className="py-2.5 px-3">Assunto</th>
                    <th className="py-2.5 px-3">Emissão</th>
                    <th className="py-2.5 px-3">Versão</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {contracts.map(c => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">{c.documentNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-white">{c.title}</td>
                      <td className="py-2.5 px-3">{formatBrDate(c.issuedAt)}</td>
                      <td className="py-2.5 px-3 font-mono">v{c.version || 1}</td>
                      <td className="py-2.5 px-3 capitalize">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
