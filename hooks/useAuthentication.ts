import React, { useState, useRef, useEffect } from 'react';
import { UserRole, AppUser } from '../types';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { generateId } from '../lib/utils';

export function useAuthentication() {
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const loggedInUserRef = useRef<AppUser | null>(null);
  const activeRoleRef = useRef<UserRole | null>(null);

  useEffect(() => {
    loggedInUserRef.current = loggedInUser;
  }, [loggedInUser]);

  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  useEffect(() => {
    if (!loggedInUser) return;

    const updateStatus = async () => {
      await supabase.from("users").update({ data: {
        ...loggedInUser,
        isOnline: true,
        lastSeen: Date.now()
      } }).eq("id", loggedInUser.id);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);

    const handleUnload = () => {
      supabase.from("users").update({ data: {
        ...loggedInUser,
        isOnline: false
      } }).eq("id", loggedInUser.id);
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [loggedInUser]);

  const handleLogin = (e: React.FormEvent, users: AppUser[]) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginUsername && u.passwordHash === loginPassword);
    if (user) {
      setLoggedInUser(user);
      setIsLoginModalOpen(false);
      setLoginUsername('');
      setLoginPassword('');
      toast.success(`Bem-vindo, ${user.name}!`);
      supabase.from("auditlogs").insert({ id: generateId(), data: {
        userId: user.id,
        userName: user.name,
        action: "LOGIN",
        details: `Usuário ${user.name} entrou no sistema`,
        timestamp: Date.now(),
        targetType: 'SYSTEM'
      } });
    } else {
      toast.error("Login Falhou", { description: "Usuário ou senha incorretos." });
    }
  };

  const handleLogout = () => {
    if (loggedInUser) {
      supabase.from("auditlogs").insert({ id: generateId(), data: {
        userId: loggedInUser.id,
        userName: loggedInUser.name,
        action: "LOGOUT",
        details: `Usuário ${loggedInUser.name} saiu do sistema`,
        timestamp: Date.now(),
        targetType: 'SYSTEM'
      } });
    }
    setLoggedInUser(null);
  };

  const handleRoleSelection = (role: UserRole) => {
    if (!loggedInUser) {
      toast.error("Login Necessário", { description: "Você precisa estar logado para acessar os setores." });
      setIsLoginModalOpen(true);
      return;
    }
    if (loggedInUser.permissions.includes(role)) {
      setActiveRole(role);
    } else if (role === UserRole.ADMIN) {
      setPendingRole(role);
    } else {
      toast.error("Acesso Negado", { description: "Você não tem permissão para acessar este setor." });
    }
  };

  const confirmPendingRole = (passwords: Record<UserRole, string>) => {
    if (pendingRole && passwordInput === passwords[pendingRole]) {
      setActiveRole(pendingRole);
      setPendingRole(null);
      setPasswordInput('');
    } else {
      toast.error("Acesso Negado", { description: "Senha incorreta. Tente novamente." });
      setPasswordInput('');
    }
  };

  return {
    activeRole,
    setActiveRole,
    pendingRole,
    setPendingRole,
    loggedInUser,
    setLoggedInUser,
    passwordInput,
    setPasswordInput,
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginUsername,
    setLoginUsername,
    loginPassword,
    setLoginPassword,
    loggedInUserRef,
    activeRoleRef,
    handleLogin,
    handleLogout,
    handleRoleSelection,
    confirmPendingRole
  };
}
