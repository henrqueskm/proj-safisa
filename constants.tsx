
import React from 'react';
import { UserRole, OrderStatus } from './types';

// Modelos base atualizados conforme catálogo Safisa
export const normalizeModelName = (name: string) => {
  if (!name) return name;
  let normalized = name.replace(/\s*\(R\d+\)\s*/g, '').trim();
  if (normalized === "BR-040 (065)") return "BR-040";
  return normalized;
};

export const SERVO_BASE_MODELS = [
  "AL-10",
  "BR-015",
  "BR-040",
  "CJ-015",
  "MBF-015",
  "MBF-025",
  "MBF-032",
  "MBF-040",
  "MC-040",
  "SAF-040",
  "VF-040"
];

// Opções de Reparo padronizadas
export const REPAIR_MODELS = [
  "Jogo de Reparo 064",
  "Jogo de Reparo 065",
  "Jogo de Reparo 066",
  "Jogo de Reparo 067",
  "Jogo de Reparo 068"
];

// Listas para Sugestão com opção OUTROS
export const REPRESENTATIVES = ["ADRIANA", "REGIANE", "REBECA", "OUTROS"];
export const CARRIERS = ["RODONAVES", "BRASPRESS", "ITINERANTE", "SEDEX", "RETIRA", "OUTROS"];

// Mapeamento de Kits por modelo
export const SERVO_KITS: Record<string, string[]> = {
  "MBF-015": ["1A", "1B", "1C", "1E", "1F", "1H"],
  "MBF-025": ["2A", "2B", "2C", "2D", "2E", "2F", "2H"],
  "CJ-015": ["3A", "3B", "3C"],
  "BR-015": ["4B", "4C", "4E", "4F"],
  "MBF-040": ["5B", "5C", "5D", "5E", "5F", "5G", "5I", "5J", "5L", "5M", "5P", "5W", "5X", "5Z"],
  "VF-040": ["5H", "6A", "6B", "6C", "6F", "6G", "6H", "6J", "6L", "6O", "6P", "6R"],
  "BR-040": ["7A", "7AB", "7AC", "7AD", "7AF", "7D", "7E", "7F", "7H", "7N", "7P", "7Q", "7R", "7X", "7Y", "7Z"],
  "MBF-032": ["9A", "9B", "9C", "9D"],
  "MC-040": ["10A", "10B", "10C", "10D", "10E"],
  "AL-10": ["11A", "11B", "11C", "11D", "11E"],
  "SAF-040": ["12A"]
};

export const ASSEMBLERS = [
  "AMARO",
  "DANILO",
  "RONALDO",
  "OSMAR"
];

export const STATUS_LABELS: Record<string, string> = {
  [OrderStatus.PENDING]: "Aguardando Montagem",
  [OrderStatus.AWAITING_EXPEDITION]: "Aguardando Expedição",
  [OrderStatus.AWAITING_INVOICE]: "Aguardando Nota Fiscal",
  [OrderStatus.READY]: "NF Emitida / Pronto",
  [OrderStatus.COMPLETED]: "Pedido Despachado"
};

export const getStatusLabel = (status: string, requiresInvoice?: boolean) => {
  if (status === OrderStatus.READY && requiresInvoice === false) {
    return "Sem NF / Pronto";
  }
  return STATUS_LABELS[status] || "Status Inválido";
};

export const STATUS_COLORS: Record<string, string> = {
  [OrderStatus.PENDING]: "border-slate-700 bg-slate-900 text-slate-400 font-medium",
  [OrderStatus.AWAITING_EXPEDITION]: "border-slate-500/20 bg-slate-500/10 text-slate-300 font-medium",
  [OrderStatus.AWAITING_INVOICE]: "border-amber-500/20 bg-amber-500/10 text-amber-400 font-medium",
  [OrderStatus.READY]: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-medium",
  [OrderStatus.COMPLETED]: "border-slate-700 bg-slate-800 text-slate-500 font-medium"
};

export const getStatusColor = (status: string) => STATUS_COLORS[status] || "border-red-500 bg-red-500/10 text-red-500 font-bold animate-pulse";

export const ROLE_DATA = {
  [UserRole.ADMIN]: {
    label: "Administrativo",
    description: "Cadastro de pedidos e emissão de Notas Fiscais.",
    color: "bg-slate-700"
  },
  [UserRole.ASSEMBLY]: {
    label: "Montagem",
    description: "Registro de peças montadas e sequência de garantias.",
    color: "bg-orange-600"
  },
  [UserRole.EXPEDITION]: {
    label: "Expedição",
    description: "Conferência, Pesagem e Separação de Pedidos.",
    color: "bg-emerald-600"
  },
  [UserRole.SYSTEM_SETTINGS]: {
    label: "Sistema",
    description: "Acesso às configurações sem senha.",
    color: "bg-purple-600"
  }
};

export const ORIENTATION_LABELS: Record<string, string> = { 
  'NORMAL': 'NOR', 
  'INVERTIDO_015_VF': 'INV 015', 
  'INVERTIDO_028': 'INV 028', 
  'DESLOCADO': 'DES', 
  'REBAIXADO': 'REB', 
  'CORPO_PRINCIPAL': 'COR' 
};

export const ORIENTATION_FULL_NAMES: Record<string, string> = {
  'NORMAL': 'NORMAL',
  'INVERTIDO_015_VF': 'INVERTIDO 015/VF',
  'INVERTIDO_028': 'INVERTIDO 028',
  'DESLOCADO': 'DESLOCADO',
  'REBAIXADO': 'REBAIXADO',
  'CORPO_PRINCIPAL': 'SÓ O CORPO PRINCIPAL'
};

export const normalizeKitName = (kitName: string) => {
  if (!kitName) return kitName;
  return kitName;
};

export const isOrderFullySeparated = (order: any) => {
  if (!order || !order.items) return false;
  return order.items.every((item: any) => {
    const isServoOk = item.type === 'SERVO' ? !!item.guaranteeNumber : true;
    const isCollectedOk = (item.type === 'REPAIR' || item.type === 'SPARE_PART') ? !!item.isCollected : true;
    const isKitOk = (item.type === 'SERVO' || item.type === 'KIT') && item.installationKit && item.installationKit !== 'SEM KIT' ? !!item.isKitConfirmed : true;
    return isServoOk && isCollectedOk && isKitOk;
  });
};

export const getMissingItemsCount = (order: any) => {
  if (!order || !order.items) return 0;
  return order.items.filter((item: any) => {
    const isServoOk = item.type === 'SERVO' ? !!item.guaranteeNumber : true;
    const isCollectedOk = (item.type === 'REPAIR' || item.type === 'SPARE_PART') ? !!item.isCollected : true;
    const isKitOk = (item.type === 'SERVO' || item.type === 'KIT') && item.installationKit && item.installationKit !== 'SEM KIT' ? !!item.isKitConfirmed : true;
    return !(isServoOk && isCollectedOk && isKitOk);
  }).length;
};
