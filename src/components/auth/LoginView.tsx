import React, { useState, useEffect } from 'react';
import {
  Shield,
  Building2,
  GitBranch,
  KeyRound,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Zap,
  Ticket,
  Check,
  Clock,
  Phone,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DEFAULT_MASTER_EMAIL, ALT_MASTER_EMAIL, MASTER_EMAILS, isMasterOwnerEmail } from '../../lib/db.ts';
import { CompanyInvite } from '../../types/index.ts';

export const LoginView: React.FC = () => {
  const {
    loginWithGoogle,
    loginMasterWithPassword,
    loginCompanyWithPassword,
    loginBranchUserWithPassword,
    activateAccountWithInvite,
    validateInvite,
    registerCompanyWithInvite,
    resetPasswordWithToken,
    setupMasterOwnerPassword,
    masterCredentialsConfigured,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'company' | 'branch' | 'master' | 'invite' | 'recovery' | 'first_setup'>('company');
  const [masterEmail, setMasterEmail] = useState<string>(DEFAULT_MASTER_EMAIL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);

  // Invite validation and onboarding state
  const [validatedInvite, setValidatedInvite] = useState<CompanyInvite | null>(null);
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);
  const [inviteApprovalNotice, setInviteApprovalNotice] = useState<string | null>(null);

  // New Company Registration fields
  const [newCompCorporateName, setNewCompCorporateName] = useState('');
  const [newCompTradeName, setNewCompTradeName] = useState('');
  const [newCompCnpj, setNewCompCnpj] = useState('');
  const [newCompPhone, setNewCompPhone] = useState('');
  const [newCompCity, setNewCompCity] = useState('');
  const [newCompState, setNewCompState] = useState('SP');
  const [newCompAdminName, setNewCompAdminName] = useState('');

  // Check URL param ?convite=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('convite');
      if (codeFromUrl) {
        const clean = codeFromUrl.trim().toUpperCase();
        setActiveTab('invite');
        setInviteCode(clean);
        triggerValidateCode(clean);
      }
    }
  }, []);

  const triggerValidateCode = async (codeToTest?: string) => {
    const code = (codeToTest || inviteCode).trim().toUpperCase();
    if (!code) {
      setError('Por favor, informe o código do convite.');
      return;
    }
    setError(null);
    setIsValidatingInvite(true);
    const res = await validateInvite(code);
    setIsValidatingInvite(false);

    if (!res.valid || !res.invite) {
      setError(res.error || 'Código de convite inválido ou expirado.');
      setValidatedInvite(null);
    } else {
      setValidatedInvite(res.invite);
      if (res.invite.recipientEmail) {
        setEmail(res.invite.recipientEmail);
      }
      if (res.invite.recipientName) {
        setNewCompAdminName(res.invite.recipientName);
      }
      if (res.invite.recipientPhone) {
        setNewCompPhone(res.invite.recipientPhone);
      }
    }
  };

  // Handle Master Owner first-time setup
  const handleSetupMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha deve possuir pelo menos 8 caracteres para proteção da conta Master.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    const res = await setupMasterOwnerPassword(password, securityAnswer, masterEmail);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro ao configurar conta Master Owner.');
    } else {
      setSuccessMsg('Master Owner configurado com sucesso com hash criptográfico!');
    }
  };

  // Handle Master Owner login with password
  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await loginMasterWithPassword(password, code2fa, masterEmail);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na autenticação do Master Owner.');
    }
  };

  // Handle Partner Company login
  const handleCompanyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    const res = await loginCompanyWithPassword(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na autenticação da empresa parceira.');
    }
  };

  // Handle Branch / Colaborador login
  const handleBranchLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    const res = await loginBranchUserWithPassword(email.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na autenticação do colaborador.');
    }
  };

  // Handle Invite / First-Time Activation
  const handleActivateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !inviteCode.trim() || !password) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const res = await activateAccountWithInvite(email.trim(), inviteCode.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro ao ativar conta.');
    } else {
      setSuccessMsg('Conta ativada com sucesso! Acessando o sistema...');
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const resetEmail = email.trim().toLowerCase();
    const isMaster = isMasterOwnerEmail(resetEmail);

    if (!resetEmail || !inviteCode.trim() || !password) {
      setError('Todos os campos são obrigatórios.');
      return;
    }
    if (isMaster && password.length < 8) {
      setError('A nova senha do Master Owner deve possuir pelo menos 8 caracteres.');
      return;
    }
    if (password.length < 6) {
      setError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const res = await resetPasswordWithToken(resetEmail, inviteCode.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Erro na redefinição de senha.');
    } else {
      if (isMaster) {
        setSuccessMsg(`Senha do Master Owner (${resetEmail}) redefinida com sucesso! Você já pode entrar com sua nova senha.`);
        setMasterEmail(resetEmail);
        setTimeout(() => {
          setActiveTab('master');
          setPassword('');
          setConfirmPassword('');
          setInviteCode('');
          setSuccessMsg('Senha atualizada com sucesso no banco de dados. Digite sua nova senha para entrar.');
        }, 1500);
      } else {
        setSuccessMsg('Senha corporativa redefinida com sucesso! Você já pode entrar com sua nova senha.');
        setTimeout(() => {
          setActiveTab('company');
          setPassword('');
          setConfirmPassword('');
          setInviteCode('');
          setSuccessMsg(null);
        }, 2000);
      }
    }
  };

  // Handle Google Auth
  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a14] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-0.5 shadow-xl shadow-cyan-500/20 mb-4">
            <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center">
              <Zap className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider flex items-center justify-center gap-2">
            ONNIX <span className="text-cyan-400">PLAY</span>
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mt-1">
            SISTEMA DE GESTÃO EMPRESARIAL MULTIEMPRESA
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-[#0b1222] border border-cyan-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/50 backdrop-blur-md">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap p-1 bg-slate-900/90 rounded-xl mb-6 border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('company');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 min-w-[110px] py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'company'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Empresa</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('branch');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 min-w-[110px] py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'branch'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span>Filial / Equipe</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('master');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 min-w-[100px] py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'master'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Master Owner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('invite');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'invite'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-emerald-400/80 hover:text-emerald-300'
              }`}
              title="Ativação de primeiro acesso com código de convite"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>1º Acesso</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* TAB 1: EMPRESA PARCEIRA LOGIN */}
          {activeTab === 'company' && (
            <form onSubmit={handleCompanyLogin} className="space-y-4">
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                    Portal da Empresa Parceira
                  </span>
                  <span className="text-xs text-slate-300">
                    Acesso exclusivo do administrador da empresa contratante
                  </span>
                </div>
                <Building2 className="w-5 h-5 text-cyan-400 opacity-80" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Administrador da Empresa
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@suaempresa.com.br"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha da Empresa
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha pessoal cadastrada"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Validando Acesso...' : 'Acessar Painel da Empresa'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('invite');
                    setError(null);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Primeiro acesso? Crie sua senha
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('recovery');
                    setError(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: FILIAL & EQUIPE LOGIN */}
          {activeTab === 'branch' && (
            <form onSubmit={handleBranchLogin} className="space-y-4">
              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                    Acesso de Unidade & Filial
                  </span>
                  <span className="text-xs text-slate-300">
                    Gerentes de filiais e operadores comerciais autorizados
                  </span>
                </div>
                <GitBranch className="w-5 h-5 text-purple-400 opacity-80" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Colaborador / Unidade
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha do Colaborador
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha pessoal"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Acessando...' : 'Acessar Área Operacional'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('invite');
                    setError(null);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
                >
                  Primeiro acesso de colaborador? Ative aqui
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MASTER OWNER LOGIN */}
          {activeTab === 'master' && (
            <form onSubmit={handleMasterLogin} className="space-y-4">
              <div className="p-3 bg-amber-950/25 border border-amber-500/30 rounded-xl">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  Conta Administrativa Principal (Master Owner)
                </span>
                <span className="text-xs font-semibold text-white">{masterEmail}</span>
              </div>

              {!masterCredentialsConfigured && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="leading-relaxed">
                      Ainda não há senha mestra configurada para este ambiente. Realize o primeiro acesso para definir sua credencial forte.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('first_setup');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Configurar Senha Master (1º Acesso)
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Master Owner
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={masterEmail}
                    onChange={e => setMasterEmail(e.target.value.trim())}
                    placeholder="email@master.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {MASTER_EMAILS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMasterEmail(m)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        masterEmail.toLowerCase() === m.toLowerCase()
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Senha Exclusiva do Master Owner
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Senha mestra de segurança"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* 2FA optional input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Código 2FA (se ativado)</span>
                  <span className="text-[10px] text-slate-500">Ex: 123456</span>
                </label>
                <input
                  type="text"
                  value={code2fa}
                  onChange={e => setCode2fa(e.target.value)}
                  placeholder="Código de 6 dígitos"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Validando Master...' : 'Entrar como Master Owner'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('recovery');
                      setEmail(masterEmail);
                      setInviteCode('MASTER-RESET');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center justify-center gap-1 cursor-pointer font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Redefinir Senha do Master Owner
                  </button>

                  <span className="text-slate-600 hidden sm:inline">•</span>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('first_setup');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-slate-400 hover:text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Configurar / 1º Acesso</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRecoveryInfo(!showRecoveryInfo)}
                  className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  Informações de segurança das contas Master
                </button>

                {showRecoveryInfo && (
                  <div className="mt-2 text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800 leading-relaxed text-left space-y-2">
                    <p>
                      Acesso restrito e criptografado aos administradores Master autorizados: <strong className="text-slate-200">{MASTER_EMAILS.join(', ')}</strong>.
                    </p>
                    <p className="text-[10px] text-slate-400">
                      O sistema armazena a credencial em Firestore com PBKDF2/SHA-256 (100.000 iterações + salt individual de 128 bits). Para recuperar o acesso em produção, utilize o código de segurança autorizado.
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* TAB 4: PRIMEIRO ACESSO COM CÓDIGO DE CONVITE */}
          {activeTab === 'invite' && (
            <form onSubmit={handleActivateInvite} className="space-y-4">
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Ativação de Primeiro Acesso
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Insira o código de convite fornecido pelo Master Owner para cadastrar sua senha pessoal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail Corporativo Cadastrado *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@empresa.com.br"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código de Convite / Ativação *
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Ex: CONV-EMP002-2026 ou TECH-2026"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Defina sua Nova Senha (mínimo 6 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha segura"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirme a Nova Senha *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Ativando Conta...' : 'Ativar Minha Conta e Entrar'}
                <Sparkles className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('company');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: RECUPERAÇÃO DE SENHA */}
          {activeTab === 'recovery' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                  Redefinição de Senha
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Informe seu e-mail e o código de autorização (para Master Owner: use o código de segurança <strong className="text-blue-300 font-mono">MASTER-RESET</strong>).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail Cadastrado *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@empresa.com.br"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código de Redefinição / Autorização *
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Código fornecido pelo Master"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nova Senha *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirme a Nova Senha *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Redefinindo...' : 'Gravar Nova Senha'}
                <KeyRound className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('company');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          )}

          {/* TAB 6: PRIMEIRA CONFIGURAÇÃO DO MASTER OWNER (SE NÃO CONFIGURADO) */}
          {activeTab === 'first_setup' && (
            <form onSubmit={handleSetupMaster} className="space-y-4">
              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Configuração Inicial de Segurança
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Defina a senha mestra para <strong className="text-white">{masterEmail}</strong>. A senha será armazenada usando hash criptográfico PBKDF2/SHA-256 com salt.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-mail do Master Owner
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={masterEmail}
                    onChange={e => setMasterEmail(e.target.value.trim())}
                    placeholder="email@master.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {MASTER_EMAILS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMasterEmail(m)}
                      className={`text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        masterEmail.toLowerCase() === m.toLowerCase()
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nova Senha Forte (mínimo 8 caracteres)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ex: Onnix@Master2026#"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirme a Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Gravando Credenciais...' : 'Gravar Senha e Inicializar Master'}
                <KeyRound className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('master');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Voltar para o Login Master Owner
                </button>
              </div>
            </form>
          )}

          {/* Divider & Google Login option */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="relative flex py-2 items-center mb-3">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Ou Autenticar com Google
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800/90 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Conta Google</span>
            </button>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-center text-slate-500">
          ONNIX PLAY &copy; 2026. Todos os acessos são criptografados e auditados.
        </p>
      </div>
    </div>
  );
};
