
export enum UserRole {
  ADMIN = 'ADMIN',
  ASSEMBLY = 'ASSEMBLY',
  EXPEDITION = 'EXPEDITION',
  SYSTEM_SETTINGS = 'SYSTEM_SETTINGS'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  AWAITING_EXPEDITION = 'AWAITING_EXPEDITION',
  AWAITING_INVOICE = 'AWAITING_INVOICE',
  READY = 'READY',
  COMPLETED = 'COMPLETED'
}

export type OrderItemType = 'SERVO' | 'REPAIR' | 'SPARE_PART' | 'KIT';
export type ServoOrientation = 'NORMAL' | 'INVERTIDO_015_VF' | 'INVERTIDO_028' | 'DESLOCADO' | 'REBAIXADO' | 'CORPO_PRINCIPAL';

export interface ServoConfig {
  model: string;
  kit: string;
  orientation: ServoOrientation;
}

export interface OrderItem {
  id: string;
  model: string;
  type: OrderItemType;
  orientation?: ServoOrientation;
  guaranteeNumber?: string;
  assemblyDate?: string;
  isCollected?: boolean;
  installationKit?: string;
  isKitConfirmed?: boolean;
  isKitPrepared?: boolean;
}

export interface Order {
  id: string;
  customerName: string;
  city: string;
  negotiationNumber: string;
  deliveryDate: string;
  carrier: string;
  representative: string;
  notes: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  dispatchedAt?: number;
  weight?: string;
  volume?: string;
  invoiceNumber?: string;
  isSelectedForToday?: boolean;
  requiresInvoice?: boolean;
  observation?: string;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  carrier: string;
  representative: string;
  lastPurchaseAt: number;
}

export interface AssembledUnit {
  id: string;
  model: string;
  orientation?: ServoOrientation;
  guaranteeNumber: string;
  assembler: string;
  assemblyDate: string;
  isAssigned: boolean;
}

export interface KitImage {
  id: string;
  data: string;
}

export interface ChatMessage {
  id: string;
  sender: UserRole | string; // Can be a Role or a User ID
  recipient: UserRole | string; // Can be a Role or a User ID
  senderName?: string;
  text: string;
  timestamp: number;
  isRead?: boolean;
}

export interface Part {
  id: string;
  code: string;
  name: string;
  stock: number;
}

export interface KitComponent {
  partId: string;
  quantity: number;
}

export interface KitData {
  id: string;
  name: string;
  barcode: string;
  application: string;
  components?: KitComponent[];
}

export interface Kit {
  id: string;
  name: string;
  model: string;
  quantity: number;
  kitName?: string;
  assembledBy?: string;
  assembledAt?: string;
  isAssigned?: boolean;
  barcode?: string;
}

export interface ServoModelData {
  id: string;
  model: string;
  barcode: string;
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  permissions: UserRole[];
  isOnline?: boolean;
  lastSeen?: number;
  linkedRepresentative?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: number;
  targetId?: string;
  targetType?: 'ORDER' | 'KIT' | 'UNIT' | 'SYSTEM';
}

export interface AppState {
  orders: Order[];
  assembledUnits: AssembledUnit[];
  kits: Kit[];
  kitData: KitData[];
  servoModelData: ServoModelData[];
  customers: Customer[];
  parts: Part[];
  activeRole: UserRole;
  currentSequence: number;
  messages: ChatMessage[];
  representativeNotifications: Record<string, boolean>;
}
