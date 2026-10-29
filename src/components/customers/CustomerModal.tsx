import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Customer, CustomerStatus, Partner, EmployeeProfile, PartnerCompany, Branch } from '../../types/index.ts';
import { isValidCpf, cleanCpf, formatCpf } from '../../lib/cpf.ts';
import { AlertCircle, CheckCircle2, ShieldAlert, Building2, GitBranch } from 'lucide-react';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  customerToEdit?: Customer | null;
  existingCustomers: Customer[];
  partners: Partner[];
  employees: EmployeeProfile[];
  companies?: PartnerCompany[];
  branches?: Branch[];
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customerToEdit,
  existingCustomers,
  partners,
  employees,
  companies = [],
  branches = [],
}) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    cpf: '',
    whatsapp: '',
    email: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
    reference: '',
    source: 'Indicação',
    notes: '',
    status: 'ativo',
    dataConsent: true,
  });

  const [cpfError, setCpfError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  useEffect(() => {
    if (customerToEdit) {
      setFormData(customerToEdit);
    } else {
      const nextCode = `ONX-${String(existingCustomers.length + 1).padStart(3, '0')}`;
      const defaultCompanyId = companies[0]?.id || 'company-matriz-01';
      const defaultBranches = branches.filter(b => b.companyId === defaultCompanyId);
      setFormData({
        code: nextCode,
        name: '',
        cpf: '',
        whatsapp: '+55 ',
        email: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: 'São Paulo',
        state: 'SP',
        reference: '',
        registrationDate: new Date().toISOString().slice(0, 10),
        source: 'Indicação',
        companyId: defaultCompanyId,
        branchId: defaultBranches[0]?.id || 'branch-matriz-01',
        notes: '',
        status: 'ativo',
        dataConsent: true,
      });
    }
    setCpfError(null);
    setDuplicateWarning(null);
  }, [customerToEdit, isOpen, existingCustomers.length, companies, branches]);

  // Check for duplicate CPF or phone
  const handleCpfChange = (val: string) => {
    const formatted = formatCpf(val);
    setFormData(prev => ({ ...prev, cpf: formatted }));

    const cleaned = cleanCpf(val);
    if (cleaned.length === 11) {
      if (!isValidCpf(cleaned)) {
        setCpfError('CPF com dígitos verificadores inválidos.');
      } else {
        setCpfError(null);
        // Check for duplicates
        const duplicate = existingCustomers.find(
          c => cleanCpf(c.cpf) === cleaned && c.id !== customerToEdit?.id
        );
        if (duplicate) {
          setDuplicateWarning(`Atenção: Já existe um cadastro com este CPF (${duplicate.name} - ${duplicate.code}).`);
        } else {
          setDuplicateWarning(null);
        }
      }
    } else {
      setCpfError(null);
      setDuplicateWarning(null);
    }
  };

  // Auto-fill address via ViaCEP public webservice
  const handleCepBlur = async () => {
    const rawCep = (formData.cep || '').replace(/\D/g, '');
    if (rawCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (err) {
        console.warn('ViaCEP lookup failed:', err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.cpf || !formData.whatsapp) {
      alert('Por favor, preencha os campos obrigatórios (Nome, CPF e WhatsApp).');
      return;
    }

    const cleanedCpf = cleanCpf(formData.cpf);
    if (!isValidCpf(cleanedCpf)) {
      setCpfError('O CPF informado possui dígitos verificadores inválidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer: Customer = {
        id: customerToEdit ? customerToEdit.id : `cust-${Date.now()}`,
        code: formData.code || `ONX-${Math.floor(100 + Math.random() * 900)}`,
        name: formData.name.trim(),
        cpf: cleanedCpf,
        whatsapp: formData.whatsapp.trim(),
        email: formData.email?.trim() || '',
        cep: formData.cep || '',
        street: formData.street || '',
        number: formData.number || '',
        complement: formData.complement || '',
        neighborhood: formData.neighborhood || '',
        city: formData.city || '',
        state: formData.state || 'SP',
        reference: formData.reference || '',
        registrationDate: formData.registrationDate || new Date().toISOString().slice(0, 10),
        source: formData.source || 'Indicação',
        companyId: formData.companyId || 'company-matriz-01',
        branchId: formData.branchId || undefined,
        partnerId: formData.partnerId || '',
        employeeResponsibleId: formData.employeeResponsibleId || '',
        notes: formData.notes || '',
        status: (formData.status as CustomerStatus) || 'ativo',
        dataConsent: Boolean(formData.dataConsent),
        createdAt: formData.createdAt || new Date().toISOString(),
      };

      await onSave(customer);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customerToEdit ? `Editar Cliente: ${customerToEdit.name}` : 'Novo Cadastro de Cliente'}
      subtitle="Dados cadastrais completos, endereço residencial, CPF e WhatsApp"
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Warning messages */}
        {duplicateWarning && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* SECTION 1: DADOS PESSOAIS */}
        <div>
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
            1. Identificação do Cliente
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Código Interno Único
              </label>
              <input
                type="text"
                readOnly
                value={formData.code || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-cyan-300 font-mono font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome Completo <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João da Silva Santos"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                CPF (com validação) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={14}
                value={formData.cpf || ''}
                onChange={e => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-xs text-white font-mono focus:outline-none ${
                  cpfError ? 'border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {cpfError && <p className="text-[10px] text-rose-400 mt-1">{cpfError}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                WhatsApp com DDI/DDD <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.whatsapp || ''}
                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="+55 (11) 99999-9999"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                E-mail (opcional)
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ENDEREÇO RESIDENCIAL */}
        <div>
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
            2. Endereço da Residência / Instalação
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                CEP (Autoboot ViaCEP)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={9}
                  value={formData.cep || ''}
                  onChange={e => setFormData({ ...formData, cep: e.target.value })}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                {isLoadingCep && (
                  <span className="absolute right-3 top-2 text-[10px] text-cyan-400 animate-pulse">
                    Buscando...
                  </span>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rua / Avenida
              </label>
              <input
                type="text"
                value={formData.street || ''}
                onChange={e => setFormData({ ...formData, street: e.target.value })}
                placeholder="Ex: Av. Paulista"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número
              </label>
              <input
                type="text"
                value={formData.number || ''}
                onChange={e => setFormData({ ...formData, number: e.target.value })}
                placeholder="1000"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={formData.complement || ''}
                onChange={e => setFormData({ ...formData, complement: e.target.value })}
                placeholder="Apto 42, Bloco B"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={formData.neighborhood || ''}
                onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Centro"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder="São Paulo"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                maxLength={2}
                value={formData.state || 'SP'}
                onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                placeholder="SP"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ponto de Referência (opcional)
              </label>
              <input
                type="text"
                value={formData.reference || ''}
                onChange={e => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Ex: Próximo à estação do metrô, em frente à padaria"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: COMERCIAL & ATRIBUIÇÃO */}
        <div>
          <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> 3. Vinculação Empresarial & Comercial
          </h4>

          {/* Empresa & Filial Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                Empresa Responsável *
              </label>
              <select
                value={formData.companyId || (companies[0]?.id || '')}
                onChange={e => {
                  const compId = e.target.value;
                  const validBranches = branches.filter(b => b.companyId === compId);
                  setFormData({
                    ...formData,
                    companyId: compId,
                    branchId: validBranches[0]?.id || '',
                  });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                Filial / Unidade de Atendimento
              </label>
              <select
                value={formData.branchId || ''}
                onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Matriz Principal / Sem Filial Específica</option>
                {branches
                  .filter(b => !formData.companyId || b.companyId === formData.companyId)
                  .map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city}/{b.state})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação Cadastral
              </label>
              <select
                value={formData.status || 'ativo'}
                onChange={e => setFormData({ ...formData, status: e.target.value as CustomerStatus })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ativo">Ativo</option>
                <option value="pendente">Pendente</option>
                <option value="inadimplente">Inadimplente</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Origem do Cliente
              </label>
              <select
                value={formData.source || 'Indicação'}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Indicação">Indicação</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Google">Google</option>
                <option value="Parceiro Comercial">Parceiro Comercial</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Parceiro Indicador
              </label>
              <select
                value={formData.partnerId || ''}
                onChange={e => setFormData({ ...formData, partnerId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Nenhum / Direto</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Funcionário Responsável
              </label>
              <select
                value={formData.employeeResponsibleId || ''}
                onChange={e => setFormData({ ...formData, employeeResponsibleId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Atendimento Geral</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observações Comerciais
              </label>
              <textarea
                rows={2}
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Preferências de horário para suporte, telas adicionais, detalhes do contrato..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-4 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.dataConsent)}
                  onChange={e => setFormData({ ...formData, dataConsent: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>
                  Consentimento formal do titular registrado para tratamento e cobrança conforme a LGPD (Lei nº 13.709/2018).
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl border border-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-md shadow-cyan-950/40 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : customerToEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
