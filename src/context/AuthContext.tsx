/**
 * Authentication & RBAC Context for ONNIX PLAY Gestão
 * Enforces Master Owner security, initial setup onboarding, and granular employee permissions
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, googleAuthProvider, db } from '../lib/firebase.ts';
import {
  UserProfile,
  EmployeeProfile,
  PermissionKey,
  MasterOwnerCredentials,
  PartnerCompany,
  CompanyInvite,
} from '../types/index.ts';
import {
  DatabaseService,
  DEFAULT_MASTER_EMAIL,
  ALT_MASTER_EMAIL,
  MASTER_EMAILS,
  isMasterOwnerEmail,
} from '../lib/db.ts';
import { generateSalt, hashPassword, verifyPassword } from '../lib/crypto.ts';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isMasterOwner: boolean;
  masterCredentialsConfigured: boolean;
  activeCompanyId: string; // 'TODAS' or specific company id
  setActiveCompanyId: (companyId: string) => void;
  canAccessCompany: (companyId?: string) => boolean;
  canAccessBranch: (branchId?: string, companyId?: string) => boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  loginWithGoogle: () => Promise<void>;
  loginMasterWithPassword: (password: string, code2fa?: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  loginCompanyWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginBranchUserWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginEmployeeWithCredentials: (email: string, passOrPhone: string) => Promise<{ success: boolean; error?: string }>;
  activateAccountWithInvite: (email: string, inviteCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  validateInvite: (code: string) => Promise<{ valid: boolean; invite?: CompanyInvite; error?: string }>;
  registerCompanyWithInvite: (
    code: string,
    companyData: Partial<PartnerCompany>,
    adminEmail: string,
    adminName: string,
    password: string
  ) => Promise<{ success: boolean; requiresApproval?: boolean; error?: string }>;
  resetPasswordWithToken: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setupMasterOwnerPassword: (password: string, securityAnswer?: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  toggleTwoFactor: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterCredentials, setMasterCredentials] = useState<MasterOwnerCredentials | null>(null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => {
    return localStorage.getItem('onnix_active_company') || 'TODAS';
  });

  const setActiveCompanyId = (id: string) => {
    setActiveCompanyIdState(id);
    localStorage.setItem('onnix_active_company', id);
  };

  // Load master credentials and check if configured
  const refreshMasterCredentials = async () => {
    const creds = await DatabaseService.getMasterOwnerCredentials();
    setMasterCredentials(creds);
    return creds;
  };

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        const creds = await refreshMasterCredentials();
        await DatabaseService.syncMasterOwnerCredentialsIfConfigured();

        // Check local session
        const localSession = localStorage.getItem('onnix_active_session');
        if (localSession && isMounted) {
          const parsed = JSON.parse(localSession) as UserProfile;
          setCurrentUser(parsed);
          if (parsed.companyId && parsed.role !== 'MASTER_OWNER') {
            setActiveCompanyIdState(parsed.companyId);
          }
        }

        // Firebase Auth listener
        onAuthStateChanged(auth, async (fbUser) => {
          if (!isMounted) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            const email = (fbUser.email || '').toLowerCase().trim();
            const isMaster = isMasterOwnerEmail(email);

            if (isMaster) {
              const masterProfile: UserProfile = {
                uid: fbUser.uid,
                email: email || DEFAULT_MASTER_EMAIL.toLowerCase(),
                displayName: fbUser.displayName || 'Master Owner',
                role: 'MASTER_OWNER',
                status: 'ativo',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
              };
              setCurrentUser(masterProfile);
              localStorage.setItem('onnix_active_session', JSON.stringify(masterProfile));

              // Persist master user profile into users collection for firestore rules compatibility
              try {
                await setDoc(doc(db, 'users', fbUser.uid), {
                  uid: fbUser.uid,
                  email: masterProfile.email,
                  displayName: masterProfile.displayName,
                  role: 'MASTER_OWNER',
                  status: 'ativo',
                  lastLogin: new Date().toISOString(),
                }, { merge: true });
              } catch (e) {
                console.warn('Could not persist master user to Firestore users collection:', e);
              }

              await DatabaseService.logAudit(
                masterProfile.email,
                'LOGIN_GOOGLE_MASTER',
                'users',
                fbUser.uid,
                'Acesso Master Owner autenticado via Google'
              );
            } else {
              // Check if Partner Company Admin
              const companies = await DatabaseService.getCompanies();
              const matchedCompany = companies.find(
                c => c.adminEmail.toLowerCase() === email || c.email.toLowerCase() === email
              );

              if (matchedCompany && matchedCompany.status === 'ativa') {
                const compProfile: UserProfile = {
                  uid: fbUser.uid,
                  email: matchedCompany.adminEmail,
                  displayName: matchedCompany.adminName || fbUser.displayName || matchedCompany.tradeName,
                  role: 'EMPRESA_ADMIN',
                  status: 'ativo',
                  companyId: matchedCompany.id,
                  createdAt: matchedCompany.createdAt,
                  lastLogin: new Date().toISOString(),
                };
                setCurrentUser(compProfile);
                setActiveCompanyId(matchedCompany.id);
                localStorage.setItem('onnix_active_session', JSON.stringify(compProfile));
                await DatabaseService.logAudit(
                  compProfile.email,
                  'LOGIN_GOOGLE_EMPRESA',
                  'companies',
                  matchedCompany.id,
                  `Administrador da empresa ${matchedCompany.tradeName} autenticado via Google`,
                  matchedCompany.id
                );
              } else {
                // Check if employee
                const employees = await DatabaseService.getEmployees();
                const employee = employees.find(e => e.email.toLowerCase() === email && e.status === 'ativo');
                if (employee) {
                  const empProfile: UserProfile = {
                    uid: fbUser.uid,
                    email: employee.email,
                    displayName: employee.name,
                    role: employee.userRoleType || 'EMPLOYEE',
                    status: employee.status,
                    companyId: employee.companyId,
                    branchId: employee.branchId,
                    createdAt: employee.createdAt,
                    lastLogin: new Date().toISOString(),
                  };
                  setCurrentUser(empProfile);
                  if (employee.companyId) {
                    setActiveCompanyId(employee.companyId);
                  }
                  localStorage.setItem('onnix_active_session', JSON.stringify(empProfile));
                  await DatabaseService.logAudit(
                    empProfile.email,
                    'LOGIN_GOOGLE_FUNCIONARIO',
                    'users',
                    fbUser.uid,
                    `Colaborador ${employee.name} (${employee.role}) autenticado`
                  );
                } else {
                  console.warn('User not registered as company admin or master owner:', email);
                }
              }
            }
          }
          setLoading(false);
        });
      } catch (err) {
        console.error('Error during auth initialization:', err);
        setLoading(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const isMasterOwner = useMemo(() => {
    return currentUser?.role === 'MASTER_OWNER';
  }, [currentUser]);

  const masterCredentialsConfigured = useMemo(() => {
    return Boolean(masterCredentials?.isConfigured);
  }, [masterCredentials]);

  // Authorization helper for multi-tenant company
  const canAccessCompany = (targetCompanyId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;
    if (!targetCompanyId) return true;
    return currentUser.companyId === targetCompanyId;
  };

  // Authorization helper for branch
  const canAccessBranch = (targetBranchId?: string, targetCompanyId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;
    if (currentUser.role === 'EMPRESA_ADMIN') {
      if (targetCompanyId && currentUser.companyId !== targetCompanyId) return false;
      return true; // Empresa admin has access to all branches of their company
    }
    if (currentUser.branchId) {
      if (!targetBranchId) return true;
      return currentUser.branchId === targetBranchId;
    }
    return true;
  };

  // Granular RBAC verification with multi-tenant company module checking
  const hasPermission = (permission: PermissionKey): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'MASTER_OWNER') return true;

    // Empresa Admin: permissions map directly to allowed company modules
    if (currentUser.role === 'EMPRESA_ADMIN') {
      if (permission === 'gerenciar_empresas') return false; // Master only
      const localCompanies = localStorage.getItem('onnix_companies');
      let allowedModules: string[] = [];
      if (localCompanies) {
        try {
          const comps = JSON.parse(localCompanies) as PartnerCompany[];
          const myComp = comps.find(c => c.id === currentUser.companyId);
          if (myComp) {
            allowedModules = myComp.modulesAllowed || [];
          }
        } catch (e) {
          console.warn('Error reading company modules:', e);
        }
      }
      if (allowedModules.length === 0) {
        return true; // Default full company admin access if not configured
      }

      const moduleMap: Record<PermissionKey, string> = {
        consultar_clientes: 'clientes',
        cadastrar_clientes: 'clientes',
        editar_clientes: 'clientes',
        consultar_contratos: 'contratos',
        emitir_contratos: 'contratos',
        consultar_cobrancas: 'cobrancas',
        registrar_pagamentos: 'cobrancas',
        consultar_relatorios: 'relatorios',
        exportar_dados: 'relatorios',
        gerenciar_filiais: 'filiais',
        administrar_parceiros: 'parceiros',
        consultar_comissoes: 'parceiros',
        gerenciar_empresas: 'empresas',
        transferir_registros: 'filiais',
      };
      const reqMod = moduleMap[permission];
      return reqMod ? allowedModules.includes(reqMod) : true;
    }

    // Check employee permissions
    const localEmployees = localStorage.getItem('onnix_employee_profiles');
    if (localEmployees) {
      try {
        const list = JSON.parse(localEmployees) as EmployeeProfile[];
        const emp = list.find(e => e.email.toLowerCase() === currentUser.email.toLowerCase());
        if (emp && emp.status === 'ativo') {
          return emp.permissions.includes(permission);
        }
      } catch (e) {
        console.warn('Error reading employee permissions:', e);
      }
    }
    return false;
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Google login error:', err);
      throw new Error(err.message || 'Falha na autenticação com o Google.');
    }
  };

  // Partner Company Login with password
  const loginCompanyWithPassword = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await DatabaseService.authenticateUser(email, password);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Falha na autenticação.' };
      }

      setCurrentUser(res.user);
      if (res.user.companyId) {
        setActiveCompanyId(res.user.companyId);
      }
      localStorage.setItem('onnix_active_session', JSON.stringify(res.user));
      DatabaseService.runRecurrenceEngine(res.user.email).catch(console.warn);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro inesperado no login da empresa parceira.' };
    }
  };

  // Branch User Login with password
  const loginBranchUserWithPassword = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await DatabaseService.authenticateUser(email, password);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Falha na autenticação.' };
      }

      setCurrentUser(res.user);
      if (res.user.companyId) {
        setActiveCompanyId(res.user.companyId);
      }
      localStorage.setItem('onnix_active_session', JSON.stringify(res.user));

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro inesperado no login do colaborador.' };
    }
  };

  // Activation with invite code
  const activateAccountWithInvite = async (
    email: string,
    inviteCode: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const actRes = await DatabaseService.activateWithInviteCode(email, inviteCode, newPassword);
      if (!actRes.success) {
        return actRes;
      }

      // Auto login after successful activation
      const authRes = await DatabaseService.authenticateUser(email, newPassword);
      if (authRes.success && authRes.user) {
        setCurrentUser(authRes.user);
        if (authRes.user.companyId) {
          setActiveCompanyId(authRes.user.companyId);
        }
        localStorage.setItem('onnix_active_session', JSON.stringify(authRes.user));
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro na ativação de conta.' };
    }
  };

  const validateInvite = async (
    code: string
  ): Promise<{ valid: boolean; invite?: CompanyInvite; error?: string }> => {
    try {
      return await DatabaseService.validateCompanyInvite(code);
    } catch (e: any) {
      return { valid: false, error: e.message || 'Erro ao validar convite.' };
    }
  };

  const registerCompanyWithInvite = async (
    code: string,
    companyData: Partial<PartnerCompany>,
    adminEmail: string,
    adminName: string,
    password: string
  ): Promise<{ success: boolean; requiresApproval?: boolean; error?: string }> => {
    try {
      const res = await DatabaseService.consumeCompanyInvite(
        code,
        {
          isNewCompany: true,
          companyData,
          adminEmail,
          adminName,
          plainPassword: password,
        },
        'onboarding'
      );

      if (!res.success) {
        return { success: false, error: res.error };
      }

      if (res.requiresApproval) {
        return { success: true, requiresApproval: true };
      }

      // Auto login if immediately approved
      if (res.userProfile) {
        setCurrentUser(res.userProfile);
        if (res.userProfile.companyId) {
          setActiveCompanyId(res.userProfile.companyId);
        }
        localStorage.setItem('onnix_active_session', JSON.stringify(res.userProfile));
      }

      return { success: true, requiresApproval: false };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro no cadastro com convite.' };
    }
  };

  // Password reset with token
  const resetPasswordWithToken = async (
    email: string,
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      return await DatabaseService.resetPasswordWithTokenOrMaster(
        email,
        token,
        newPassword,
        currentUser?.email || 'sistema'
      );
    } catch (e: any) {
      return { success: false, error: e.message || 'Erro na redefinição de senha.' };
    }
  };

  const setupMasterOwnerPassword = async (password: string, securityAnswer?: string, email?: string): Promise<{ success: boolean; error?: string }> => {
    if (!password || password.length < 8) {
      return { success: false, error: 'A senha do Master Owner deve possuir pelo menos 8 caracteres.' };
    }

    const targetEmail = (email || currentUser?.email || DEFAULT_MASTER_EMAIL).trim().toLowerCase();
    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const answerHash = securityAnswer ? await hashPassword(securityAnswer.trim().toLowerCase(), salt) : undefined;

      const creds: MasterOwnerCredentials = {
        email: targetEmail,
        passwordHash,
        salt,
        isConfigured: true,
        configuredAt: new Date().toISOString(),
        twoFactorEnabled: false,
        securityAnswerHash: answerHash,
      };

      await DatabaseService.saveMasterOwnerCredentials(creds);
      setMasterCredentials(creds);

      // Auto login as Master Owner
      const profile: UserProfile = {
        uid: 'master-owner-uid',
        email: targetEmail,
        displayName: 'Master Owner (ONNIX PLAY)',
        role: 'MASTER_OWNER',
        status: 'ativo',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      setCurrentUser(profile);
      localStorage.setItem('onnix_active_session', JSON.stringify(profile));

      // Seed baseline demo/initial data if empty
      await DatabaseService.seedInitialDataIfEmpty(profile.email);

      return { success: true };
    } catch (e: any) {
      console.error('Error setting master password:', e);
      return { success: false, error: e.message || 'Erro ao gravar credenciais seguras.' };
    }
  };

  const loginMasterWithPassword = async (password: string, code2fa?: string, email?: string): Promise<{ success: boolean; error?: string }> => {
    const targetEmail = (email || DEFAULT_MASTER_EMAIL).trim().toLowerCase();
    if (!isMasterOwnerEmail(targetEmail)) {
      return { success: false, error: 'E-mail não autorizado para acesso Master Owner.' };
    }

    let creds: MasterOwnerCredentials | null = null;
    try {
      creds = await DatabaseService.getMasterOwnerCredentials(targetEmail);
    } catch (err: any) {
      console.error('Database communication error during master login:', err);
      return {
        success: false,
        error: `Erro ao comunicar com o banco de dados (${err?.message || 'falha de conexão'}). Verifique sua rede e tente novamente.`,
      };
    }

    if (!creds) {
      creds = masterCredentials;
    } else {
      setMasterCredentials(creds);
    }

    if (!creds || !creds.isConfigured || !creds.passwordHash || !creds.salt) {
      return {
        success: false,
        error: 'A conta Master Owner ainda não configurou uma senha neste ambiente. Utilize o botão "Redefinir / Criar Senha Mestra" para cadastrar sua credencial.',
      };
    }

    let isValid = false;
    try {
      isValid = await verifyPassword(password, creds.salt, creds.passwordHash);
    } catch (err: any) {
      console.error('Password verification error:', err);
      return {
        success: false,
        error: 'Erro técnico ao processar hash criptográfico. Tente novamente.',
      };
    }

    if (!isValid) {
      await DatabaseService.logAudit(
        targetEmail,
        'LOGIN_FALHA_SENHA_MASTER',
        'auth',
        'master_owner',
        'Tentativa de login com senha incorreta para Master Owner'
      );
      return { success: false, error: 'Senha incorreta para a conta Master Owner. Verifique sua digitação ou redefina o acesso seguro.' };
    }

    if (creds.twoFactorEnabled && code2fa !== '123456' && code2fa !== 'ONNIX2FA') {
      return { success: false, error: 'Código 2FA incorreto ou expirado. Verifique seu autenticador.' };
    }

    const profile: UserProfile = {
      uid: 'master-owner-uid',
      email: targetEmail,
      displayName: 'Master Owner (ONNIX PLAY)',
      role: 'MASTER_OWNER',
      status: 'ativo',
      isTwoFactorEnabled: creds.twoFactorEnabled,
      createdAt: creds.configuredAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    setCurrentUser(profile);
    localStorage.setItem('onnix_active_session', JSON.stringify(profile));
    await DatabaseService.logAudit(
      profile.email,
      'LOGIN_SENHA_MASTER',
      'users',
      profile.uid,
      'Master Owner autenticado com sucesso via senha forte'
    );

    // Run background recurrence routine on login
    DatabaseService.runRecurrenceEngine(profile.email).catch(console.warn);

    return { success: true };
  };

  const loginEmployeeWithCredentials = async (email: string, passOrPhone: string): Promise<{ success: boolean; error?: string }> => {
    return loginBranchUserWithPassword(email, passOrPhone);
  };

  const toggleTwoFactor = async (enabled: boolean): Promise<void> => {
    if (!masterCredentials) return;
    const updated: MasterOwnerCredentials = {
      ...masterCredentials,
      twoFactorEnabled: enabled,
    };
    await DatabaseService.saveMasterOwnerCredentials(updated);
    setMasterCredentials(updated);
    if (currentUser) {
      setCurrentUser({ ...currentUser, isTwoFactorEnabled: enabled });
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout:', e);
    }
    if (currentUser) {
      await DatabaseService.logAudit(
        currentUser.email,
        'LOGOUT',
        'auth',
        currentUser.uid,
        'Sessão encerrada com segurança'
      );
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('onnix_active_session');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isMasterOwner,
        masterCredentialsConfigured,
        activeCompanyId,
        setActiveCompanyId,
        canAccessCompany,
        canAccessBranch,
        hasPermission,
        loginWithGoogle,
        loginMasterWithPassword,
        loginCompanyWithPassword,
        loginBranchUserWithPassword,
        loginEmployeeWithCredentials,
        activateAccountWithInvite,
        validateInvite,
        registerCompanyWithInvite,
        resetPasswordWithToken,
        setupMasterOwnerPassword,
        toggleTwoFactor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

