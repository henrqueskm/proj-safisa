import { generateId, safeToUpper } from './lib/utils';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserRole, Order, AssembledUnit, OrderStatus, ChatMessage, KitImage, Customer, OrderItem, Kit, KitData, ServoModelData, AppUser, AuditLog } from './types';
import { ROLE_DATA, normalizeModelName, normalizeKitName, STATUS_LABELS, getStatusLabel } from './constants';
import { Skeleton } from './components/Skeleton';
import AdminView from './components/AdminView';
import AssemblyView from './components/AssemblyView';
import ExpeditionView from './components/ExpeditionView';
import Chat from './components/Chat';
import SystemSettingsModal from './components/SystemSettingsModal';
import { supabase } from './supabase';
import { uploadFile } from './supabaseStorage';
import { ShieldCheck, Settings, Truck, LogOut, MessageSquare, Loader2, Volume2, VolumeX, Bell, Moon, Sun, Package, Printer, PanelTop, LayoutDashboard, User, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import * as JSPM from 'jsprintmanager';

import { useAuthentication } from './hooks/useAuthentication';
import { useFirebaseData } from './hooks/useFirebaseData';
import { useOrderManagement, cleanData } from './hooks/useOrderManagement';
import { AppProvider } from './hooks/useAppContext';

const getGuaranteeLookupKey = (value: unknown) => safeToUpper(String(value ?? '').trim()).replace(/^A/, '');

const App: React.FC = () => {
  const [muteSound, setMuteSound] = useState(false);
  
  const [showTabs, setShowTabs] = useState(true);
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');

  useEffect(() => {
    JSPM.JSPrintManager.auto_reconnect = true;
    JSPM.JSPrintManager.start();
    
    JSPM.JSPrintManager.WS.onStatusChanged = function () {
      if (JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.Open) {
        JSPM.JSPrintManager.getPrinters().then(function (myPrinters: string[]) {
          setPrinters(myPrinters);
          if (myPrinters.length > 0) {
            setSelectedPrinter(myPrinters[0]);
          }
        });
      }
    };
  }, []);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [themeState, setThemeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('safisa-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (themeState === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    localStorage.setItem('safisa-theme', themeState);
  }, [themeState]);

  const [isSystemSettingsPasswordPromptOpen, setIsSystemSettingsPasswordPromptOpen] = useState(false);
  const [systemSettingsPasswordInput, setSystemSettingsPasswordInput] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      toast.success('Notificações Ativadas!', { description: 'Você receberá alertas de novos pedidos na área de trabalho.' });
    }
  };

  const showSystemNotification = (title: string, body: string, tag: string = 'system-notification') => {
    if (notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag,
        requireInteraction: true
      });

      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();
      };
    }
  };

  const isChatOpenRef = useRef(false);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  const {
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
  } = useAuthentication();

  const {
    isSyncing,
    users,
    orders,
    assembledUnits,
    kits,
    kitData,
    servoModelData,
    customers,
    kitImages,
    auditLogs,
    messages,
    partRegistry,
    safisaIcon,
    currentSequence,
    passwords,
    manualQuantities,
    globalAssemblers,
    globalRepresentatives,
    auditLogLimit,
    setAuditLogLimit,
    loadCompletedOrders,
    setLoadCompletedOrders
  } = useFirebaseData(loggedInUserRef, activeRoleRef, isChatOpenRef, setIsChatOpen, showSystemNotification);

  // Re-bind useAuthentication with proper users
  useEffect(() => {
    if (loggedInUser) {
      const updatedUser = users.find(u => u.id === loggedInUser.id);
      if (updatedUser && (
        updatedUser.name !== loggedInUser.name ||
        updatedUser.username !== loggedInUser.username ||
        updatedUser.linkedRepresentative !== loggedInUser.linkedRepresentative ||
        updatedUser.role !== loggedInUser.role
      )) {
        setLoggedInUser(updatedUser);
      }
    }
  }, [users, loggedInUser]);

  const representatives = useMemo(() => {
    const reps = new Set<string>(globalRepresentatives || []);
    orders.forEach(o => {
      if (o.representative) reps.add(safeToUpper(o.representative));
    });
    customers.forEach(c => {
      if (c.representative) reps.add(safeToUpper(c.representative));
    });
    return Array.from(reps).sort();
  }, [orders, customers, globalRepresentatives]);

  const {
    addOrder,
    deleteOrder,
    deleteUnit,
    deleteKitGroup,
    onAssignBatch,
    onToggleGroupKit,
    onAdjustKitStock,
    reconcileInventory,
    handleExportBackup,
    handleImportBackup,
    addAuditLog
  } = useOrderManagement(orders, assembledUnits, customers, kits, loggedInUserRef, isSyncing);

  const pendingActionsCount = useMemo(() => {
    if (!activeRole) return 0;
    switch (activeRole) {
      case UserRole.ADMIN: return orders.filter(o => o.status === OrderStatus.AWAITING_INVOICE).length;
      case UserRole.ASSEMBLY: return orders.filter(o => o.status === OrderStatus.PENDING && o.isSelectedForToday && (o.items || []).some(i => i.type === 'SERVO' && !i.guaranteeNumber)).length;
      case UserRole.EXPEDITION: return orders.filter(o => o.status === OrderStatus.AWAITING_EXPEDITION || o.status === OrderStatus.READY).length;
      default: return 0;
    }
  }, [orders, activeRole]);

  if (isSyncing) return (
    <div className="min-h-screen bg-slate-950 p-6 sm:p-12 flex flex-col gap-8">
      <div className="flex gap-4 items-center mb-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="w-64 h-8" />
          <Skeleton className="w-32 h-4" />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <Skeleton className="w-full lg:w-[300px] h-96 rounded-2xl shrink-0" />
        <div className="flex flex-col gap-6 flex-1">
          <Skeleton className="w-full h-32 rounded-2xl" />
          <Skeleton className="w-full h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );

  const updateConfig = async (d: any) => {
    const { data } = await supabase.from("config").select("data").eq("id", "global").single();
    const currentData = data?.data || {};
    await supabase.from("config").update({ data: cleanData({ ...currentData, ...d }) }).eq("id", "global");
  };

  const setSequence = async (v: number) => {
    const { data } = await supabase.from("config").select("data").eq("id", "global").single();
    const currentData = data?.data || {};
    await supabase.from("config").update({ data: { ...currentData, currentSequence: Number(v) } }).eq("id", "global");
  };

  const returnServoToStock = async (data: { guaranteeNumber: string; model?: string; orientation?: any; assembler?: string }) => {
    if (!loggedInUser) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para retornar séries ao estoque." });
      return;
    }

    const guaranteeKey = getGuaranteeLookupKey(data.guaranteeNumber);
    if (!guaranteeKey) return;

    const linkedOrder = orders.find(order =>
      (order.items || []).some(item => getGuaranteeLookupKey(item.guaranteeNumber) === guaranteeKey)
    );

    if (linkedOrder) {
      const updatedItems = (linkedOrder.items || []).map(item =>
        getGuaranteeLookupKey(item.guaranteeNumber) === guaranteeKey
          ? { ...item, guaranteeNumber: undefined }
          : item
      );

      await supabase.from("orders").update({
        data: cleanData({ ...linkedOrder, items: updatedItems })
      }).eq("id", linkedOrder.id);
    }

    const existingUnit = assembledUnits.find(unit => getGuaranteeLookupKey(unit.guaranteeNumber) === guaranteeKey);
    if (existingUnit) {
      await supabase.from("assembledunits").update({
        data: cleanData({ ...existingUnit, isAssigned: false })
      }).eq("id", existingUnit.id);
      return;
    }

    const unitId = generateId();
    await supabase.from("assembledunits").upsert({
      id: unitId,
      data: cleanData({
        id: unitId,
        model: data.model || "RETORNO",
        orientation: data.orientation || "NORMAL",
        guaranteeNumber: guaranteeKey,
        assembler: data.assembler || "RETORNO",
        assemblyDate: new Date().toISOString(),
        isAssigned: false
      })
    });
  };

  const appContextValue = {
    activeRole,
    loggedInUser,
    isSyncing,
    users,
    orders,
    assembledUnits,
    kits,
    kitData,
    servoModelData,
    customers,
    kitImages,
    auditLogs,
    messages,
    partRegistry,
    safisaIcon,
    currentSequence,
    passwords,
    manualQuantities,
    globalAssemblers,
    globalRepresentatives,
    loadCompletedOrders,
    addOrder,
    deleteOrder,
    updateStatus: async (id: string, s: string, ex?: any) => {
      const order = orders.find((o: any) => o.id === id);
      if (!order) return;
      return supabase.from("orders").update({ data: cleanData({ ...order, ...ex, status: s }) }).eq("id", id);
    },
    updateConfig,
    setSequence,
    reconcileInventory,
    setLoadCompletedOrders,
    onLoadMoreAuditLogs: () => setAuditLogLimit(prev => prev + 50),
    onSaveKitImage: async (i: string, file: File) => { const url = await uploadFile("kit-images", `${i}-${Date.now()}.${file.name.split('.').pop()}`, file); await supabase.from("kitimages").upsert({ id: i, data: { id: i, data: url } }); },
    onDeleteKitImage: async (i: string) => supabase.from("kitimages").delete().eq("id", i),
    onSaveKitData: async (k: KitData) => supabase.from("kitdata").upsert({ id: k.id, data: cleanData(k) }),
    onDeleteKitData: async (i: string) => supabase.from("kitdata").delete().eq("id", i),
    onSaveServoModelData: async (s: ServoModelData) => supabase.from("servomodeldata").upsert({ id: s.id, data: cleanData(s) }),
    onDeleteServoModelData: async (i: string) => supabase.from("servomodeldata").delete().eq("id", i),
    // Optional placeholder mapping for missing actions but defined in types if needed
  };

  return (
    <AppProvider value={appContextValue}>
      <div className="min-h-screen flex flex-col transition-colors duration-300 bg-slate-900 text-slate-100 print:bg-white">
      <Toaster position="top-right" richColors closeButton theme={themeState} />
      {!activeRole ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
          {loggedInUser ? (
            <div className="absolute top-6 left-6 flex items-center gap-4 bg-slate-900/50 p-2 pr-4 rounded-xl backdrop-blur-md border border-slate-800 z-50">
              <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-white">
                {loggedInUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Logado como</p>
                <p className="text-sm font-bold text-white">{loggedInUser.name}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-4 p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-900/30 rounded-xl transition-all"
                title="Sair"
               aria-label="Sair">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="absolute top-6 left-6 px-6 py-3 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all shadow-sm z-50 backdrop-blur-md border border-slate-800 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"
             aria-label="Fazer Login">
              <User size={16} /> Fazer Login
            </button>
          )}

          <button 
            onClick={() => {
              if (loggedInUser && loggedInUser.permissions.includes(UserRole.SYSTEM_SETTINGS)) {
                setIsSystemSettingsOpen(true);
              } else {
                setIsSystemSettingsPasswordPromptOpen(true);
              }
            }}
            className="absolute top-6 right-6 p-3 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all shadow-sm z-50 backdrop-blur-md border border-slate-800"
           aria-label="Botão">
            <Settings size={24} />
          </button>

          {/* Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-700 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[120px]" />
          </div>

          <div className="max-w-5xl w-full text-center space-y-16 relative z-10">
            <div className="space-y-4">
              <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter italic leading-none">
                SAFISA<span className="text-slate-500">.</span>
              </h1>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.3em]">Industrial Management System</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[UserRole.ADMIN, UserRole.ASSEMBLY, UserRole.EXPEDITION].map((role) => (
                <button 
                  key={role} 
                  onClick={() => handleRoleSelection(role)} 
                  className="bg-slate-900/40 backdrop-blur-3xl p-12 rounded-3xl border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all text-center group relative overflow-hidden shadow-2xl hover:shadow-[0_0_40px_rgba(79,70,229,0.15)] flex flex-col items-center hover:-translate-y-2"
                 aria-label="Botão">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="absolute -inset-24 bg-gradient-to-b from-slate-500/5 to-transparent rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:bg-slate-700 group-hover:border-slate-500 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(71,85,105,0.4)] text-slate-400 transition-all duration-500 relative z-10">
                    {role === UserRole.ADMIN ? <ShieldCheck size={32}/> : role === UserRole.ASSEMBLY ? <Settings size={32}/> : <Truck size={32}/>}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-3 relative z-10">{ROLE_DATA[role].label}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors relative z-10">
                    {role === UserRole.ADMIN ? 'Gestão e Faturamento' : role === UserRole.ASSEMBLY ? 'Produção e Testes' : 'Separação e Envio'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 w-full text-center z-10 pointer-events-none">
             <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest flex items-center justify-center pointer-events-auto">
               Desenvolvido por Henrique Klein
             </p>
          </div>

          {pendingRole && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setPendingRole(null)} />
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  confirmPendingRole(passwords);
                }} 
                className="relative bg-slate-900/90 backdrop-blur-3xl p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700/50"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
                <div className="space-y-2">
                  <div className="w-20 h-20 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50 shadow-xl">
                    <ShieldCheck size={36} />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-widest text-white">Acesso Restrito</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Identifique-se para continuar</p>
                </div>
                
                <input 
                  autoFocus 
                  type="password" 
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)} 
                  placeholder="••••"
                  className="w-full py-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-5xl tracking-[0.3em] font-mono font-black text-white outline-none focus:border-slate-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner" 
                />
                
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setPendingRole(null)}
                    className="flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                   aria-label="Cancelar">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] bg-slate-700 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(71,85,105,0.3)] hover:shadow-[0_0_30px_rgba(71,85,105,0.5)] hover:bg-slate-600 transition-all active:scale-95"
                   aria-label="Confirmar">
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          )}

          {isLoginModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsLoginModalOpen(false)} />
              <form 
                onSubmit={(e) => handleLogin(e, users)} 
                className="relative bg-slate-900/90 backdrop-blur-3xl p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700/50"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="space-y-2">
                  <div className="w-20 h-20 bg-slate-800 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50 shadow-xl">
                    <User size={36} />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-widest text-white">Login</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Entre com suas credenciais</p>
                </div>
                
                <div className="space-y-4">
                  <input 
                    autoFocus 
                    type="text" 
                    value={loginUsername} 
                    onChange={e => setLoginUsername(e.target.value)} 
                    placeholder="Usuário"
                    className="w-full py-4 px-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-xl font-bold text-white outline-none focus:border-emerald-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner" 
                  />
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    placeholder="Senha"
                    className="w-full py-4 px-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-xl tracking-[0.3em] font-mono font-black text-white outline-none focus:border-emerald-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner" 
                  />
                </div>
                
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsLoginModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                   aria-label="Cancelar">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition-all active:scale-95"
                   aria-label="Entrar">
                    Entrar
                  </button>
                </div>
              </form>
            </div>
          )}

          {isSystemSettingsPasswordPromptOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsSystemSettingsPasswordPromptOpen(false)} />
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (systemSettingsPasswordInput === '456') { 
                    setIsSystemSettingsOpen(true); 
                    setIsSystemSettingsPasswordPromptOpen(false); 
                    setSystemSettingsPasswordInput(''); 
                  }
                  else { 
                    toast.error("Acesso Negado", { description: "Senha incorreta. Tente novamente." });
                    setSystemSettingsPasswordInput(''); 
                  }
                }} 
                className="relative bg-slate-800 p-12 rounded-xl shadow-2xl w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700"
              >
                <div className="space-y-2">
                  <div className="w-16 h-16 bg-slate-900 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                    <Settings size={32} />
                  </div>
                  <h2 className="text-2xl font-bold uppercase italic tracking-tighter text-white">Configurações</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha do Sistema</p>
                </div>
                
                <input 
                  autoFocus 
                  type="password" 
                  value={systemSettingsPasswordInput} 
                  onChange={e => setSystemSettingsPasswordInput(e.target.value)} 
                  placeholder="••••"
                  className="w-full py-6 bg-slate-900 border-2 border-slate-700 rounded-xl text-center text-4xl font-bold text-white outline-none focus:border-slate-500 focus:bg-slate-900 transition-all placeholder:text-slate-600" 
                />
                
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsSystemSettingsPasswordPromptOpen(false)}
                    className="flex-1 py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white transition-colors"
                   aria-label="Cancelar">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-700 transition-all active:scale-95"
                   aria-label="Confirmar">
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <>
          <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center px-6 justify-between sticky top-0 z-50 no-print">
            <div className="flex items-center gap-4">
              <span className="font-bold text-white italic tracking-tighter text-xl">SAFISA PRO</span>
              <div className="h-6 w-[2px] bg-slate-800 mx-1"></div>
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{ROLE_DATA[activeRole].label}</span>
              
              {activeRole === UserRole.EXPEDITION && (
                <>
                  <div className="h-6 w-[2px] bg-slate-800 mx-1"></div>
                  <div className="bg-slate-800 p-1.5 px-3 rounded-xl border border-slate-700 flex items-center gap-2 shadow-sm max-w-[200px]">
                    <Printer className="text-slate-400 shrink-0" size={14} />
                    <select 
                      value={selectedPrinter} 
                      onChange={e => setSelectedPrinter(e.target.value)} 
                      className="bg-transparent border-none outline-none font-bold text-[10px] uppercase text-white w-full truncate cursor-pointer"
                      title="Impressora"
                    >
                      {printers.length === 0 && <option value="">Buscando...</option>}
                      {printers.map(p => <option key={p} value={p} className="bg-slate-800">{p}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setShowTabs(!showTabs)} className={`p-2 border rounded-xl transition-all shadow-sm ${showTabs ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`} title="Alternar Abas" aria-label="Alternar Abas">
                    <PanelTop size={14} />
                  </button>
                  <button onClick={() => setShowSummaryCards(!showSummaryCards)} className={`p-2 border rounded-xl transition-all shadow-sm ${showSummaryCards ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`} title="Alternar Cards de Resumo" aria-label="Alternar Cards de Resumo">
                    <LayoutDashboard size={14} />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {notificationPermission !== 'granted' && (
                <button 
                  onClick={requestNotificationPermission}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-all group"
                  title="Ativar Alertas na Área de Trabalho"
                 aria-label="Ativar Alertas na Área de Trabalho">
                  <Bell size={14} className="group-hover:animate-bounce" />
                  <span className="text-[8px] font-bold uppercase tracking-widest">Ativar Alertas</span>
                </button>
              )}
              <button 
                onClick={() => setThemeState(currentTheme => currentTheme === 'light' ? 'dark' : 'light')}
                className="hidden sm:flex items-center justify-center p-2 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Alternar Tema (Claro/Escuro)"
               aria-label="Alternar Tema (Claro/Escuro)">
                {themeState === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className={`p-2 rounded-xl transition-all ${pendingActionsCount > 0 ? 'bg-red-50 text-red-500 animate-pulse' : 'text-slate-300'}`}>
                <Bell size={20} />
              </div>
              <div className="h-6 w-[2px] bg-slate-100"></div>
              <button onClick={() => setActiveRole(null)} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors font-bold text-xs uppercase tracking-widest" aria-label="Sair">
                <span className="hidden sm:inline">Sair</span>
                <LogOut size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 w-full print:max-w-none print:p-0 print:bg-white">
            {activeRole === UserRole.ADMIN && <AdminView orders={orders} assembledUnits={assembledUnits} kits={kits} kitData={kitData} servoModelData={servoModelData} customers={customers} kitImages={kitImages} partRegistry={partRegistry} safisaIcon={safisaIcon} auditLogs={auditLogs} addOrder={addOrder} deleteOrder={deleteOrder} updateStatus={async (id, s, ex) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para alterar o status." });
                return;
              }
              const order = orders.find(o => o.id === id);
              if (!order) return;
              await supabase.from("orders").update({ data: cleanData({ ...order, ...ex, status: s }) }).eq("id", id);
            }} currentSequence={currentSequence} passwords={passwords} updateConfig={updateConfig} setSequence={setSequence} onSaveKitImage={async (i, file) => { const url = await uploadFile("kit-images", `${i}-${Date.now()}.${file.name.split('.').pop()}`, file); await supabase.from("kitimages").upsert({ id: i, data: { id: i, data: url } }); }} onDeleteKitImage={(i) => supabase.from("kitimages").delete().eq("id", i)} onReconcile={reconcileInventory} onSaveKitData={(k) => supabase.from("kitdata").upsert({ id: k.id, data: cleanData(k) })} onDeleteKitData={(i) => supabase.from("kitdata").delete().eq("id", i)} onSaveServoModelData={(s) => supabase.from("servomodeldata").upsert({ id: s.id, data: cleanData(s) })} onDeleteServoModelData={(i) => supabase.from("servomodeldata").delete().eq("id", i)} />}
            {activeRole === UserRole.ASSEMBLY && <AssemblyView assemblers={globalAssemblers || []} units={assembledUnits} orders={orders} kits={kits} manualQuantities={manualQuantities} onAddBatch={async (units) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para registrar lotes." });
                return;
              }
              const promises = units.map(u => supabase.from("assembledunits").upsert({ id: u.id, data: cleanData(u) }));
              await Promise.all(promises);
              const lastNum = Math.max(...units.map(u => Number(u.guaranteeNumber)));
              if (lastNum > currentSequence) {
                const { data } = await supabase.from("config").select("data").eq("id", "global").single();
                const currentData = data?.data || {};
                await supabase.from("config").update({ data: { ...currentData, currentSequence: lastNum } }).eq("id", "global");
              }
            }} onUpdateUnit={async (id, d) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para atualizar unidades." });
                return;
              }
              const currentUnit = assembledUnits.find(u => u.id === id);
              if (!currentUnit) {
                toast.error("Série não encontrada", { description: "Atualize a tela e tente novamente." });
                return;
              }
              await supabase.from("assembledunits").update({ data: cleanData({ ...currentUnit, ...d }) }).eq("id", id);
            }} currentSequence={currentSequence} onToggleOrderToday={async (id, val) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para alterar o planejamento." });
                return;
              }
              const orderToUpdate = orders.find(o => o.id === id);
              if (orderToUpdate) {
                await supabase.from("orders").update({ data: cleanData({ ...orderToUpdate, isSelectedForToday: val }) }).eq("id", id);
              }
            }} onToggleGroupKit={onToggleGroupKit} onReturnToStock={returnServoToStock} onAdjustKitStock={onAdjustKitStock} passwords={passwords} updateConfig={updateConfig} />}
            {activeRole === UserRole.EXPEDITION && <ExpeditionView orders={orders} availableUnits={assembledUnits.filter(u => !u.isAssigned)} kits={kits} kitData={kitData} servoModelData={servoModelData} kitImages={kitImages} safisaIcon={safisaIcon} onAssignBatch={onAssignBatch} onDeleteKitGroup={deleteKitGroup} onUpdateStatus={async (id, s, ex) => {
              const orderToUpdate = orders.find(o => o.id === id);
              if (orderToUpdate) {
                await supabase.from("orders").update({ data: cleanData({ ...orderToUpdate, ...ex, status: s }) }).eq("id", id);
              }
            }} onMarkGroupCollected={async (id, itemIds) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para marcar itens." });
                return;
              }
              const order = orders.find(o => o.id === id); if (!order) return;
              const items = (order.items || []).map(i => itemIds.includes(i.id) ? { ...i, isCollected: !i.isCollected } : i);
              
              const isFullySeparated = (items || []).every(item => {
                const isServoOk = item.type === 'SERVO' ? !!item.guaranteeNumber : true;
                const isCollectedOk = (item.type === 'REPAIR' || item.type === 'SPARE_PART') ? !!item.isCollected : true;
                const isKitOk = (item.type === 'SERVO' || item.type === 'KIT') && item.installationKit && item.installationKit !== 'SEM KIT' ? !!item.isKitConfirmed : true;
                return isServoOk && isCollectedOk && isKitOk;
              });

              let newStatus = order.status;
              const allServosAssigned = (items || []).filter(i => i.type === 'SERVO').every(i => !!i.guaranteeNumber);
              if (allServosAssigned && order.status === OrderStatus.PENDING) {
                newStatus = OrderStatus.AWAITING_EXPEDITION;
              }

              await supabase.from("orders").update({ data: cleanData({ ...order, items, status: newStatus }) }).eq("id", id);
            }} onCompleteExpedition={async (id, w, v) => {
              if (!loggedInUser) {
                toast.error("Ação Bloqueada", { description: "Você precisa estar logado para completar a expedição." });
                return;
              }
              const order = orders.find(o => o.id === id); if (!order) return;
              
              if (order.status !== OrderStatus.AWAITING_EXPEDITION && order.status !== OrderStatus.READY) {
                 toast.warning("Ação Inválida", { description: "Este pedido já sofreu alteração de status por outro usuário." });
                 return;
              }

              // Deduct stock for all kits
              const stockUpdates: { id: string, newQuantity: number }[] = [];
              const itemsWithKits = (order.items || []).filter(i => (i.type === 'SERVO' || i.type === 'KIT') && i.installationKit && i.installationKit !== 'SEM KIT');
              
              const kitCounts = new Map<string, number>();
              for (const item of itemsWithKits) {
                const subKits = normalizeKitName(item.installationKit!).split('/').map(s => s.trim());
                for (const sub of subKits) {
                  const normalized = safeToUpper(normalizeKitName(sub));
                  kitCounts.set(normalized, (kitCounts.get(normalized) || 0) + 1);
                }
              }

              for (const [kitName, quantityNeeded] of kitCounts.entries()) {
                const kitNamePrefix = kitName.startsWith('KIT') ? kitName : `KIT ${kitName}`;
                const kitDocs = kits.filter(k => safeToUpper(normalizeKitName(k.name)) === safeToUpper(kitNamePrefix) || safeToUpper(normalizeKitName(k.name)) === safeToUpper(kitName));
                let remainingToDeduct = quantityNeeded;
                for (const kitDoc of kitDocs) {
                  if (remainingToDeduct <= 0) break;
                  const deductAmount = Math.min(kitDoc.quantity, remainingToDeduct);
                  stockUpdates.push({ id: kitDoc.id, newQuantity: kitDoc.quantity - deductAmount });
                  remainingToDeduct -= deductAmount;
                }
              }

              for (const update of stockUpdates) {
                const targetKit = kits.find(k => k.id === update.id);
                if (targetKit) {
                  await supabase.from('kits').update({ data: cleanData({ ...targetKit, quantity: update.newQuantity }) }).eq('id', update.id);
                }
              }

              const oldStatus = order.status;
              const status = order.status === OrderStatus.READY ? OrderStatus.COMPLETED : (order.requiresInvoice === false ? OrderStatus.READY : OrderStatus.AWAITING_INVOICE);
              await supabase.from("orders").update({ data: cleanData({ ...order, status, weight: w, volume: v, dispatchedAt: status === OrderStatus.COMPLETED ? Date.now() : undefined }) }).eq("id", id);
            }} onToggleGroupKit={onToggleGroupKit} onAdjustKitStock={onAdjustKitStock} passwords={passwords} updateConfig={updateConfig} printers={printers} selectedPrinter={selectedPrinter} setSelectedPrinter={setSelectedPrinter} showTabs={showTabs} setShowTabs={setShowTabs} showSummaryCards={showSummaryCards} setShowSummaryCards={setShowSummaryCards} />}
          </main>

          <button onClick={() => setIsChatOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 no-print" aria-label="Botão">
            <MessageSquare size={24} />
            {messages.filter(m => m.recipient === (loggedInUser?.id || activeRole) && !m.isRead).length > 0 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-4 border-slate-950 animate-bounce">
                {messages.filter(m => m.recipient === (loggedInUser?.id || activeRole) && !m.isRead).length}
              </div>
            )}
          </button>

          {isChatOpen && (
            <Chat 
              messages={messages} 
              activeRole={activeRole} 
              users={users}
              loggedInUser={loggedInUser}
              onSendMessage={async (text, rec, senderName) => {
                const currentSenderId = loggedInUser?.id || activeRole;
                await supabase.from("messages").insert({
                  id: generateId(),
                  data: cleanData({ 
                    sender: currentSenderId, 
                    recipient: rec, 
                    senderName: senderName || ROLE_DATA[activeRole].label,
                    text, 
                    timestamp: Date.now(), 
                    isRead: false 
                  })
                });
              }} 
              onReadMessages={async (sender) => {
                const currentRecipientId = loggedInUser?.id || activeRole;
                const unread = messages.filter(m => m.sender === sender && m.recipient === currentRecipientId && !m.isRead);
                unread.forEach(async m => await supabase.from("messages").update({ data: { ...m, isRead: true } }).eq("id", m.id));
              }} 
              onClose={() => setIsChatOpen(false)} 
            />
          )}
        </>
      )}

      {isSystemSettingsOpen && (
        <SystemSettingsModal 
          onClose={() => setIsSystemSettingsOpen(false)}
          onReconcile={reconcileInventory}
          safisaIcon={safisaIcon}
          updateConfig={updateConfig}
          servoModelData={servoModelData}
          onSaveServoModelData={(s) => supabase.from("servomodeldata").upsert({ id: s.id, data: cleanData(s) })}
          onDeleteServoModelData={(i) => supabase.from("servomodeldata").delete().eq("id", i)}
          kitData={kitData}
          onSaveKitData={(k) => supabase.from("kitdata").upsert({ id: k.id, data: cleanData(k) })}
          kitImages={kitImages}
          onSaveKitImage={async (i, file) => { const url = await uploadFile("kit-images", `${i}-${Date.now()}.${file.name.split('.').pop()}`, file); await supabase.from("kitimages").upsert({ id: i, data: { id: i, data: url } }); }}
          onDeleteKitImage={(i) => supabase.from("kitimages").delete().eq("id", i)}
          users={users}
          onSaveUser={async (u) => {
            const res = await supabase.from("users").upsert({ id: u.id, data: cleanData(u) });
            if (res.error) {
              console.error("Error saving user:", res.error);
              toast.error("Erro ao salvar usuário DB", { description: res.error.message });
              return false;
            }
            return true;
          }}
          onDeleteUser={(i) => supabase.from("users").delete().eq("id", i)}
          representatives={representatives}
          auditLogs={auditLogs}
          onLoadMoreAuditLogs={() => setAuditLogLimit(prev => prev + 50)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          globalAssemblers={globalAssemblers}
          globalRepresentatives={globalRepresentatives}
          currentSequence={currentSequence}
          setSequence={setSequence}
        />
      )}
      </div>
    </AppProvider>
  );
};

export default App;
