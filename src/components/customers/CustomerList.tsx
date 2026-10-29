import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Phone,
  FileSignature,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Customer, CustomerStatus, Partner, EmployeeProfile, Plan, Contract, Invoice, Subscription, PartnerCompany, Branch } from '../../types/index.ts';
import { maskCpf, formatCpf } from '../../lib/cpf.ts';
import { formatBrDate } from '../../lib/date.ts';
import { exportToCsv } from '../../lib/export.ts';
import { CustomerModal } from './CustomerModal.tsx';
import { CustomerDetailModal } from './CustomerDetailModal.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface CustomerListProps {
  customers: Customer[];
  partners: Partner[];
  employees: EmployeeProfile[];
  plans: Plan[];
  contracts: Contract[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  companies?: PartnerCompany[];
  branches?: Branch[];
  onRefresh: () => void;
  onOpenContractGenerator: (customer: Customer) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  customers,
  partners,
  employees,
  plans,
  contracts,
  invoices,
  subscriptions,
  companies = [],
  branches = [],
  onRefresh,
  onOpenContractGenerator,
}) => {
  const { currentUser, isMasterOwner, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [partnerFilter, setPartnerFilter] = useState<string>('todos');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const canCreate = isMasterOwner || hasPermission('cadastrar_clientes');
  const canEdit = isMasterOwner || hasPermission('editar_clientes');
  const canExport = isMasterOwner || hasPermission('exportar_dados');

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf.includes(searchTerm.replace(/\D/g, '')) ||
        c.whatsapp.includes(searchTerm);

      const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
      const matchPartner = partnerFilter === 'todos' || c.partnerId === partnerFilter;

      return matchSearch && matchStatus && matchPartner;
    });
  }, [customers, searchTerm, statusFilter, partnerFilter]);

  const handleSaveCustomer = async (customer: Customer) => {
    await DatabaseService.saveCustomer(customer, currentUser?.email || 'sistema');
    onRefresh();
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    await DatabaseService.deleteCustomer(deletingCustomer.id, currentUser?.email || 'sistema');
    setDeletingCustomer(null);
    onRefresh();
  };

  const handleExportCsv = () => {
    const rows = filteredCustomers.map(c => ({
      Codigo: c.code,
      Nome: c.name,
      CPF: maskCpf(c.cpf),
      WhatsApp: c.whatsapp,
      Email: c.email || '',
      Cidade: c.city,
      Estado: c.state,
      Status: c.status,
      DataCadastro: formatBrDate(c.registrationDate),
      Origem: c.source,
      ConsentimentoLGPD: c.dataConsent ? 'Sim' : 'Nao',
    }));
    exportToCsv('relatorio_clientes_onnix', rows);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Base de Clientes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastre, pesquise e gerencie os assinantes e residências da ONNIX PLAY.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar CSV</span>
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => {
                setEditingCustomer(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome, CPF, código ou WhatsApp..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativo</option>
            <option value="pendente">Pendente</option>
            <option value="inadimplente">Inadimplente</option>
            <option value="inativo">Inativo</option>
          </select>

          <select
            value={partnerFilter}
            onChange={e => setPartnerFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todos os Parceiros</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e1628] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente / Endereço</th>
                <th className="py-3 px-4">CPF (Protegido)</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Cidade/UF</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Cadastro</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {customer.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-2 flex-wrap">
                        <span>{customer.name}</span>
                        {customer.branchId && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-950/70 text-purple-300 border border-purple-800/40 rounded font-normal">
                            {branches.find(b => b.id === customer.branchId)?.name || 'Filial'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {customer.street}, {customer.number} - {customer.neighborhood}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {maskCpf(customer.cpf)}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-medium">
                      {customer.whatsapp}
                    </td>
                    <td className="py-3 px-4">
                      {customer.city}/{customer.state}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          customer.status === 'ativo'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : customer.status === 'inadimplente'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatBrDate(customer.registrationDate)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingCustomer(customer)}
                          title="Visualizar ficha e WhatsApp"
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onOpenContractGenerator(customer)}
                          title="Emitir Contrato"
                          className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <FileSignature className="w-4 h-4" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingCustomer(customer);
                              setIsModalOpen(true);
                            }}
                            title="Editar cadastro"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {isMasterOwner && (
                          <button
                            onClick={() => setDeletingCustomer(customer)}
                            title="Excluir cadastro"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
        customerToEdit={editingCustomer}
        existingCustomers={customers}
        partners={partners}
        employees={employees}
        companies={companies}
        branches={branches}
      />

      {/* Customer Detail Profile */}
      <CustomerDetailModal
        isOpen={Boolean(viewingCustomer)}
        onClose={() => setViewingCustomer(null)}
        customer={viewingCustomer}
        contracts={contracts}
        invoices={invoices}
        subscriptions={subscriptions}
        plans={plans}
        onOpenContractGenerator={cust => {
          setViewingCustomer(null);
          onOpenContractGenerator(cust);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingCustomer)}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={handleDeleteCustomer}
        title="Remover Cadastro de Cliente"
        message={`Tem certeza que deseja excluir ${deletingCustomer?.name}? Registros fiscais e contratos associados devem ser arquivados conforme política de conformidade.`}
        confirmLabel="Sim, Excluir"
        isDestructive
      />
    </div>
  );
};
