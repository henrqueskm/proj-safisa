import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import { safeToUpper } from './lib/utils';
import { UserRole } from './types';
import { supabase } from './supabase';

import AppHeader from './components/AppHeader';
import AppLoadingScreen from './components/AppLoadingScreen';
import Chat from './components/Chat';
import ChatLauncher from './components/ChatLauncher';
import LoginModal from './components/LoginModal';
import RestrictedAccessModal from './components/RestrictedAccessModal';
import RoleSelectionScreen from './components/RoleSelectionScreen';
import SystemSettingsModal from './components/SystemSettingsModal';
import SystemSettingsPasswordModal from './components/SystemSettingsPasswordModal';
import AdminSector from './components/sectors/AdminSector';
import AssemblySector from './components/sectors/AssemblySector';
import ExpeditionSector from './components/sectors/ExpeditionSector';

import { AppProvider } from './hooks/useAppContext';
import { cleanData, useOrderManagement } from './hooks/useOrderManagement';
import { useAdminActions } from './hooks/useAdminActions';
import { useAssemblyActions } from './hooks/useAssemblyActions';
import { useAuthentication } from './hooks/useAuthentication';
import { useChatActions } from './hooks/useChatActions';
import { useConfigActions } from './hooks/useConfigActions';
import { useExpeditionActions } from './hooks/useExpeditionActions';
import { useFirebaseData } from './hooks/useFirebaseData';
import { useNotifications } from './hooks/useNotifications';
import { usePendingActionsCount } from './hooks/usePendingActionsCount';
import { usePrinters } from './hooks/usePrinters';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const [showTabs, setShowTabs] = useState(true);
  const [showSummaryCards, setShowSummaryCards] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isSystemSettingsPasswordPromptOpen, setIsSystemSettingsPasswordPromptOpen] = useState(false);

  const { themeState, toggleTheme } = useTheme();
  const { printers, selectedPrinter, setSelectedPrinter } = usePrinters();
  const {
    notificationPermission,
    requestNotificationPermission,
    showSystemNotification
  } = useNotifications();

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
    setAuditLogLimit,
    loadCompletedOrders,
    setLoadCompletedOrders
  } = useFirebaseData(
    loggedInUserRef,
    activeRoleRef,
    isChatOpenRef,
    setIsChatOpen,
    showSystemNotification
  );

  useEffect(() => {
    if (!loggedInUser) return;

    const updatedUser = users.find(user => user.id === loggedInUser.id);
    if (!updatedUser) return;

    const hasUserChanged =
      updatedUser.name !== loggedInUser.name ||
      updatedUser.username !== loggedInUser.username ||
      updatedUser.linkedRepresentative !== loggedInUser.linkedRepresentative ||
      JSON.stringify(updatedUser.permissions) !== JSON.stringify(loggedInUser.permissions);

    if (hasUserChanged) {
      setLoggedInUser(updatedUser);
    }
  }, [users, loggedInUser, setLoggedInUser]);

  const representatives = useMemo(() => {
    const reps = new Set<string>(globalRepresentatives || []);
    orders.forEach(order => {
      if (order.representative) reps.add(safeToUpper(order.representative));
    });
    customers.forEach(customer => {
      if (customer.representative) reps.add(safeToUpper(customer.representative));
    });
    return Array.from(reps).sort();
  }, [orders, customers, globalRepresentatives]);

  const availableUnits = useMemo(() => {
    return assembledUnits.filter(unit => !unit.isAssigned);
  }, [assembledUnits]);

  const {
    addOrder,
    deleteOrder,
    deleteKitGroup,
    onAssignBatch,
    onToggleGroupKit,
    onAdjustKitStock,
    reconcileInventory,
    handleExportBackup,
    handleImportBackup
  } = useOrderManagement(orders, assembledUnits, customers, kits, loggedInUserRef, isSyncing);

  const configActions = useConfigActions();
  const adminActions = useAdminActions({ orders, loggedInUser });
  const assemblyActions = useAssemblyActions({
    assembledUnits,
    currentSequence,
    loggedInUser,
    orders,
    setSequence: configActions.setSequence
  });
  const expeditionActions = useExpeditionActions({ kits, loggedInUser, orders });
  const pendingActionsCount = usePendingActionsCount(activeRole, orders);
  const chatActions = useChatActions({ activeRole, loggedInUser, messages });

  const updateOrderStatus = async (id: string, status: string, extra?: any) => {
    const order = orders.find(item => item.id === id);
    if (!order) return;

    await supabase.from('orders').update({
      data: cleanData({ ...order, ...extra, status })
    }).eq('id', id);
  };

  const openSystemSettings = () => {
    if (loggedInUser && loggedInUser.permissions.includes(UserRole.SYSTEM_SETTINGS)) {
      setIsSystemSettingsOpen(true);
      return;
    }

    setIsSystemSettingsPasswordPromptOpen(true);
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
    updateStatus: updateOrderStatus,
    updateConfig: configActions.updateConfig,
    setSequence: configActions.setSequence,
    reconcileInventory,
    setLoadCompletedOrders,
    onLoadMoreAuditLogs: () => setAuditLogLimit(previous => previous + 50),
    onSaveKitImage: configActions.saveKitImage,
    onDeleteKitImage: configActions.deleteKitImage,
    onSaveKitData: configActions.saveKitData,
    onDeleteKitData: configActions.deleteKitData,
    onSaveServoModelData: configActions.saveServoModelData,
    onDeleteServoModelData: configActions.deleteServoModelData
  };

  if (isSyncing) {
    return <AppLoadingScreen />;
  }

  return (
    <AppProvider value={appContextValue}>
      <div className="min-h-screen flex flex-col transition-colors duration-300 bg-slate-900 text-slate-100 print:bg-white">
        <Toaster position="top-right" richColors closeButton theme={themeState} />

        {!activeRole ? (
          <>
            <RoleSelectionScreen
              loggedInUser={loggedInUser}
              onLogout={handleLogout}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onOpenSettings={openSystemSettings}
              onSelectRole={handleRoleSelection}
            />
            <RestrictedAccessModal
              isOpen={!!pendingRole}
              pendingRole={pendingRole}
              passwordInput={passwordInput}
              setPasswordInput={setPasswordInput}
              setPendingRole={setPendingRole}
              onConfirm={() => confirmPendingRole(passwords)}
            />
            <LoginModal
              isOpen={isLoginModalOpen}
              loginPassword={loginPassword}
              loginUsername={loginUsername}
              setIsOpen={setIsLoginModalOpen}
              setLoginPassword={setLoginPassword}
              setLoginUsername={setLoginUsername}
              users={users}
              onLogin={handleLogin}
            />
            <SystemSettingsPasswordModal
              isOpen={isSystemSettingsPasswordPromptOpen}
              onApproved={() => setIsSystemSettingsOpen(true)}
              onClose={() => setIsSystemSettingsPasswordPromptOpen(false)}
            />
          </>
        ) : (
          <>
            <AppHeader
              activeRole={activeRole}
              notificationPermission={notificationPermission}
              pendingActionsCount={pendingActionsCount}
              printers={printers}
              selectedPrinter={selectedPrinter}
              setActiveRole={setActiveRole}
              setSelectedPrinter={setSelectedPrinter}
              setShowSummaryCards={setShowSummaryCards}
              setShowTabs={setShowTabs}
              showSummaryCards={showSummaryCards}
              showTabs={showTabs}
              themeState={themeState}
              onRequestNotificationPermission={requestNotificationPermission}
              onToggleTheme={toggleTheme}
            />

            <main className="flex-1 w-full print:max-w-none print:p-0 print:bg-white">
              {activeRole === UserRole.ADMIN && (
                <AdminSector
                  orders={orders}
                  assembledUnits={assembledUnits}
                  kits={kits}
                  kitData={kitData}
                  servoModelData={servoModelData}
                  customers={customers}
                  kitImages={kitImages}
                  partRegistry={partRegistry}
                  safisaIcon={safisaIcon}
                  auditLogs={auditLogs}
                  addOrder={addOrder}
                  deleteOrder={deleteOrder}
                  updateStatus={adminActions.updateStatus}
                  currentSequence={currentSequence}
                  passwords={passwords}
                  updateConfig={configActions.updateConfig}
                  setSequence={configActions.setSequence}
                  onSaveKitImage={configActions.saveKitImage}
                  onDeleteKitImage={configActions.deleteKitImage}
                  onReconcile={reconcileInventory}
                  onSaveKitData={configActions.saveKitData}
                  onDeleteKitData={configActions.deleteKitData}
                  onSaveServoModelData={configActions.saveServoModelData}
                  onDeleteServoModelData={configActions.deleteServoModelData}
                />
              )}

              {activeRole === UserRole.ASSEMBLY && (
                <AssemblySector
                  assemblers={globalAssemblers || []}
                  units={assembledUnits}
                  orders={orders}
                  kits={kits}
                  manualQuantities={manualQuantities}
                  onAddBatch={assemblyActions.onAddBatch}
                  onUpdateUnit={assemblyActions.onUpdateUnit}
                  currentSequence={currentSequence}
                  onToggleOrderToday={assemblyActions.onToggleOrderToday}
                  onToggleGroupKit={onToggleGroupKit}
                  onReturnToStock={assemblyActions.onReturnToStock}
                  passwords={passwords}
                  updateConfig={configActions.updateConfig}
                />
              )}

              {activeRole === UserRole.EXPEDITION && (
                <ExpeditionSector
                  orders={orders}
                  availableUnits={availableUnits}
                  kits={kits}
                  kitData={kitData}
                  servoModelData={servoModelData}
                  kitImages={kitImages}
                  safisaIcon={safisaIcon}
                  onAssignBatch={onAssignBatch}
                  onDeleteKitGroup={deleteKitGroup}
                  onUpdateStatus={expeditionActions.onUpdateStatus}
                  onMarkGroupCollected={expeditionActions.onMarkGroupCollected}
                  onCompleteExpedition={expeditionActions.onCompleteExpedition}
                  onToggleGroupKit={onToggleGroupKit}
                  onAdjustKitStock={onAdjustKitStock}
                  passwords={passwords}
                  updateConfig={configActions.updateConfig}
                  printers={printers}
                  selectedPrinter={selectedPrinter}
                  setSelectedPrinter={setSelectedPrinter}
                  showTabs={showTabs}
                  setShowTabs={setShowTabs}
                  showSummaryCards={showSummaryCards}
                  setShowSummaryCards={setShowSummaryCards}
                />
              )}
            </main>

            <ChatLauncher unreadCount={chatActions.unreadCount} onOpen={() => setIsChatOpen(true)} />

            {isChatOpen && (
              <Chat
                messages={messages}
                activeRole={activeRole}
                users={users}
                loggedInUser={loggedInUser}
                onSendMessage={chatActions.sendMessage}
                onReadMessages={chatActions.readMessages}
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
            updateConfig={configActions.updateConfig}
            servoModelData={servoModelData}
            onSaveServoModelData={configActions.saveServoModelData}
            onDeleteServoModelData={configActions.deleteServoModelData}
            kitData={kitData}
            onSaveKitData={configActions.saveKitData}
            kitImages={kitImages}
            onSaveKitImage={configActions.saveKitImage}
            onDeleteKitImage={configActions.deleteKitImage}
            users={users}
            onSaveUser={configActions.saveUser}
            onDeleteUser={configActions.deleteUser}
            representatives={representatives}
            auditLogs={auditLogs}
            onLoadMoreAuditLogs={() => setAuditLogLimit(previous => previous + 50)}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            globalAssemblers={globalAssemblers}
            globalRepresentatives={globalRepresentatives}
            currentSequence={currentSequence}
            setSequence={configActions.setSequence}
          />
        )}
      </div>
    </AppProvider>
  );
};

export default App;
