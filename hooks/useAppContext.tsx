import React, { createContext, useContext, ReactNode } from 'react';
import { UserRole, Order, AssembledUnit, Kit, KitData, ServoModelData, Customer, KitImage, AuditLog, ChatMessage, AppUser } from '../types';

interface AppContextType {
  activeRole: UserRole | null;
  loggedInUser: AppUser | null;
  isSyncing: boolean;
  users: AppUser[];
  orders: Order[];
  assembledUnits: AssembledUnit[];
  kits: Kit[];
  kitData: KitData[];
  servoModelData: ServoModelData[];
  customers: Customer[];
  kitImages: KitImage[];
  auditLogs: AuditLog[];
  messages: ChatMessage[];
  partRegistry: Record<string, any>;
  safisaIcon: string | null;
  currentSequence: number;
  passwords: Record<string, string>;
  manualQuantities: Record<string, Record<string, string>>;
  globalAssemblers: string[];
  globalRepresentatives: string[];
  loadCompletedOrders?: boolean;
  
  // Actions
  addOrder?: (order: Order) => Promise<void>;
  deleteOrder?: (id: string) => Promise<void>;
  updateStatus?: (id: string, s: string, ex?: any) => Promise<void>;
  updateConfig?: (d: any) => Promise<void>;
  setSequence?: (v: number) => Promise<void>;
  reconcileInventory?: () => Promise<void>;
  setLoadCompletedOrders?: (val: boolean) => void;
  onLoadMoreAuditLogs?: () => void;
  onSaveKitImage?: (id: string, file: File) => Promise<void>;
  onDeleteKitImage?: (id: string) => Promise<void>;
  onSaveKitData?: (k: KitData) => Promise<void>;
  onDeleteKitData?: (id: string) => Promise<void>;
  onSaveServoModelData?: (s: ServoModelData) => Promise<void>;
  onDeleteServoModelData?: (id: string) => Promise<void>;
  onAddBatch?: (units: any[]) => Promise<void>;
  onSaveCustomer?: (c: Customer) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ value: AppContextType; children: ReactNode }> = ({ value, children }) => {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
