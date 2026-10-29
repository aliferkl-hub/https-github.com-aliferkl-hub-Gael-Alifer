import React, { useState } from 'react';
import { Plan, BillingCycle } from '../../types/index.ts';
import { formatBRL } from '../../lib/date.ts';
import { Plus, Edit3, Check, Zap, Shield, Sparkles, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DatabaseService } from '../../lib/db.ts';

interface PlansViewProps {
  plans: Plan[];
  onRefresh: () => void;
}

export const PlansView: React.FC<PlansViewProps> = ({ plans, onRefresh }) => {
  const { isMasterOwner, currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [formData, setFormData] = useState<Partial<Plan>>({
    name: '',
    description: '',
    price: 49.9,
    billingCycle: 'mensal',
    durationMonths: 12,
    renewalRules: 'Renovação automática conforme periodicidade',
    terms: 'Suporte técnico padrão, acesso ininterrupto.',
    additionalFees: 0,
    allowedDiscounts: 0,
    status: 'ativo',
  });

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      id: `plan-${Date.now()}`,
      name: '',
      description: '',
      price: 49.9,
      billingCycle: 'mensal',
      durationMonths: 12,
      renewalRules: 'Renovação automática conforme periodicidade',
      terms: 'Suporte técnico padrão, acesso ininterrupto.',
      additionalFees: 0,
      allowedDiscounts: 0,
      status: 'ativo',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData(plan);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price === undefined) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    const planToSave: Plan = {
      id: editingPlan ? editingPlan.id : `plan-${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description || '',
      price: Number(formData.price),
      billingCycle: (formData.billingCycle as BillingCycle) || 'mensal',
      durationMonths: Number(formData.durationMonths || 12),
      renewalRules: formData.renewalRules || '',
      terms: formData.terms || '',
      additionalFees: Number(formData.additionalFees || 0),
      allowedDiscounts: Number(formData.allowedDiscounts || 0),
      status: formData.status || 'ativo',
      createdAt: editingPlan ? editingPlan.createdAt : new Date().toISOString(),
    };

    await DatabaseService.savePlan(planToSave, currentUser?.email || 'sistema');
    setIsModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Catálogo de Planos & Assinaturas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Defina preços, periodicidades contratuais e condições comerciais exclusivas da ONNIX PLAY.
          </p>
        </div>

        {isMasterOwner && (
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Plano</span>
          </button>
        )}
      </div>

      {/* Grid of Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div
            key={plan.id}
            className="bg-[#0b1222] border border-cyan-500/20 hover:border-cyan-400/40 rounded-2xl p-6 shadow-xl transition-all duration-300 flex flex-col justify-between relative group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {plan.billingCycle}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    plan.status === 'ativo'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-slate-500 bg-slate-800'
                  }`}
                >
                  {plan.status.toUpperCase()}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                {plan.name}
              </h3>
              <p className="text-xs text-slate-400 mb-4 min-h-[32px] leading-relaxed">
                {plan.description}
              </p>

              <div className="mb-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Valor Contratado
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-white">{formatBRL(plan.price)}</span>
                  <span className="text-xs text-slate-400 font-medium">/{plan.billingCycle}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300 mb-6">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Duração: {plan.durationMonths} meses</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{plan.renewalRules}</span>
                </div>
                {plan.allowedDiscounts > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Desconto autorizado até {formatBRL(plan.allowedDiscounts)}</span>
                  </div>
                )}
              </div>
            </div>

            {isMasterOwner && (
              <button
                onClick={() => handleOpenEdit(plan)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Editar Condições do Plano</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Plan Edit / Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? `Editar Plano: ${editingPlan.name}` : 'Criar Novo Plano Comercial'}
        subtitle="Regras de vigência, preço e condições contratuais"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome do Plano <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: ONNIX Ultra 4K"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descrição Comercial
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Benefícios inclusos, quantidade de telas simultâneas..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Valor do Plano (R$) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price !== undefined ? formData.price : 49.9}
                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Periodicidade do Ciclo
              </label>
              <select
                value={formData.billingCycle || 'mensal'}
                onChange={e => setFormData({ ...formData, billingCycle: e.target.value as BillingCycle })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Duração do Contrato (Meses)
              </label>
              <input
                type="number"
                value={formData.durationMonths || 12}
                onChange={e => setFormData({ ...formData, durationMonths: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Situação
              </label>
              <select
                value={formData.status || 'ativo'}
                onChange={e => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Regras de Renovação
            </label>
            <input
              type="text"
              value={formData.renewalRules || ''}
              onChange={e => setFormData({ ...formData, renewalRules: e.target.value })}
              placeholder="Ex: Renovação automática a cada 30 dias"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl shadow-md"
            >
              Salvar Plano
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
