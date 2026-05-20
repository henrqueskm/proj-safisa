import { generateId, safeFormatDate, safeToUpper } from '../lib/utils';

import React, { useState, useMemo, useEffect } from 'react';
import * as JSPM from 'jsprintmanager';
import { Order, AssembledUnit, OrderStatus, OrderItem, OrderItemType, KitImage, Kit, KitData, ServoModelData } from '../types';
import { STATUS_COLORS, STATUS_LABELS, SERVO_BASE_MODELS, SERVO_KITS, getMissingItemsCount, ORIENTATION_LABELS, ORIENTATION_FULL_NAMES, normalizeModelName, normalizeKitName, isOrderFullySeparated, getStatusColor, getStatusLabel } from '../constants';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { useAppContext } from '../hooks/useAppContext';
import { 
  Package, Search, X, Check, History, Eye, MapPin, Calendar, 
  AlertTriangle, Warehouse, Truck, Box, ImageIcon, Wrench, Settings2, CheckCircle2, ClipboardList, Plus, Minus, Printer, Bell,
  PanelTop, LayoutDashboard, Pencil, CheckSquare, Trash2, Menu, Layers, FileText, RefreshCcw, Loader2
} from 'lucide-react';

interface ExpeditionViewProps {
  orders: Order[];
  availableUnits: AssembledUnit[];
  kits: Kit[];
  kitData: KitData[];
  kitImages: KitImage[];
  servoModelData: ServoModelData[];
  safisaIcon: string | null;
  onAssignBatch: (orderId: string, assigns: { itemId: string, guaranteeNumber: string | null }[]) => void;
  onMarkGroupCollected: (orderId: string, itemIds: string[]) => void;
  onAdjustKitStock: (params: { code: string, quantity: number, model?: string, observation?: string }) => Promise<void>;
  onUpdateStatus?: (id: string, s: OrderStatus, extra?: any) => Promise<void>;
  onCompleteExpedition: (orderId: string, weight: string, volume: string) => void;
  onToggleGroupKit: (orderId: string, itemIds: string[]) => void;
  passwords: Record<string, string>;
  updateConfig: (d: any) => void;
  printers: string[];
  selectedPrinter: string;
  setSelectedPrinter: (printer: string) => void;
  showTabs: boolean;
  setShowTabs: (show: boolean) => void;
  showSummaryCards: boolean;
  setShowSummaryCards: (show: boolean) => void;
  onDeleteKitGroup?: (model: string, name: string) => void;
}

const imageToBase64ZPL = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');
      
      const maxWidth = 200;
      const maxHeight = 100;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
      
      width = Math.ceil(width / 8) * 8;
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      let hexString = '';
      let byte = 0;
      let bitCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];
        
        const luminance = (a < 128) ? 255 : (0.299 * r + 0.587 * g + 0.114 * b);
        const isBlack = luminance < 128;
        
        byte = (byte << 1) | (isBlack ? 1 : 0);
        bitCount++;
        
        if (bitCount === 8) {
          hexString += byte.toString(16).padStart(2, '0').toUpperCase();
          byte = 0;
          bitCount = 0;
        }
      }
      
      const bytesPerRow = width / 8;
      const totalBytes = bytesPerRow * height;
      
      const zpl = `~DGR:LOGO.GRF,${totalBytes},${bytesPerRow},${hexString}`;
      resolve(zpl);
    };
    img.onerror = reject;
    img.src = base64Image;
  });
};

const ExpeditionView: React.FC<ExpeditionViewProps> = ({ 
  // Componente de Expedição - Atualizado para garantir a exibição de todos os itens
  orders, 
  availableUnits, 
  kits,
  kitData,
  kitImages, 
  servoModelData,
  safisaIcon,
  onAssignBatch, 
  onMarkGroupCollected, 
  onAdjustKitStock,
  onUpdateStatus,
  onCompleteExpedition,
  onToggleGroupKit,
  passwords,
  updateConfig,
  printers,
  selectedPrinter,
  setSelectedPrinter,
  showTabs,
  setShowTabs,
  showSummaryCards,
  setShowSummaryCards,
  onDeleteKitGroup
}) => {
  const { loadCompletedOrders, setLoadCompletedOrders } = useAppContext();
  const [activeTab, setActiveTab] = useState<'separation' | 'preparation' | 'dispatch' | 'inventory' | 'history' | 'labels' | 'kitRegistration' | 'kitsView'>('separation');

  useEffect(() => {
    if (activeTab === 'history' && setLoadCompletedOrders && !loadCompletedOrders) {
      setLoadCompletedOrders(true);
    }
  }, [activeTab, loadCompletedOrders, setLoadCompletedOrders]);

  const [inventorySubTab, setInventorySubTab] = useState<'servos' | 'kits'>('servos');
  const [kitRegistrationSubTab, setKitRegistrationSubTab] = useState<'register' | 'list'>('register');
  const [preparationSubTab, setPreparationSubTab] = useState<'kits' | 'looseParts' | 'repairs'>('kits');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedKit, setSelectedKit] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [batchSelectingFor, setBatchSelectingFor] = useState<{ orderId: string, groupKey: string } | null>(null);
  const [kitConfirmModal, setKitConfirmModal] = useState<{orderId: string, itemIds: string[], kitName: string, model: string} | null>(null);
  const [kitConfirmQty, setKitConfirmQty] = useState<number | ''>('');
  const [selectedSeriesForBatch, setSelectedSeriesForBatch] = useState<string[]>([]);
  const [printingBatchFor, setPrintingBatchFor] = useState<{ orderId: string, groupKey: string } | null>(null);
  const [selectedSeriesForPrint, setSelectedSeriesForPrint] = useState<string[]>([]);
  const [viewingKitImage, setViewingKitImage] = useState<string | null>(null);
  const [viewingKitData, setViewingKitData] = useState<KitData | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [undoAction, setUndoAction] = useState<{ orderId: string, previousStatus: OrderStatus, customerName: string } | null>(null);
  const [showManualKitModal, setShowManualKitModal] = useState(false);
  const [manualKitAction, setManualKitAction] = useState<'ADD' | 'REMOVE'>('ADD');
  const [manualKitCode, setManualKitCode] = useState('');
  const [manualKitQty, setManualKitQty] = useState<number | ''>('');
  const [isProcessingManualKit, setIsProcessingManualKit] = useState(false);

  const manualKitModel = useMemo(() => {
    if (!manualKitCode) return 'Geral';
    const normalizedCode = manualKitCode.toUpperCase().replace(/^KIT\s+/, '').trim();
    for (const [model, modelKits] of Object.entries(SERVO_KITS)) {
      if (modelKits.some(k => k.toUpperCase() === normalizedCode)) {
        return model;
      }
    }
    return 'Geral';
  }, [manualKitCode]);

  const getKitStock = (kitName: string) => {
    const subKitParts = normalizeKitName(kitName).split('/').map(s => safeToUpper(s).trim()).filter(Boolean);
    let minStock = Infinity;

    for (const part of subKitParts) {
      const partName = part.startsWith('KIT') ? part : `KIT ${part}`;
      const dbStock = kits.filter(k =>
        safeToUpper(normalizeKitName(k.name)) === safeToUpper(normalizeKitName(partName)) ||
        safeToUpper(normalizeKitName(k.name)) === safeToUpper(normalizeKitName(part))
      ).reduce((acc, current) => acc + current.quantity, 0);

      if (dbStock < minStock) minStock = dbStock;
    }

    return minStock === Infinity ? 0 : minStock;
  };
  const [labelModel, setLabelModel] = useState('');
  const [labelOrientation, setLabelOrientation] = useState('NORMAL');
  const [labelHasKit, setLabelHasKit] = useState(false);
  const [labelKit, setLabelKit] = useState('SEM KIT');
  const [labelSerial, setLabelSerial] = useState('');
  const [isManualSerial, setIsManualSerial] = useState(false);
  const [editingInvoiceOrderId, setEditingInvoiceOrderId] = useState<string | null>(null);
  const [editingInvoiceValue, setEditingInvoiceValue] = useState<string>('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );

  useEffect(() => {
    // Add any necessary lifecycle effects here
  }, [orders, kits]);

  const query = safeToUpper(searchQuery).trim();

  // Metrics for Dashboard
  const metrics = useMemo(() => {
    const activeOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION);
    const dispatchOrdersCount = orders.filter(o => o.status === OrderStatus.AWAITING_INVOICE || o.status === OrderStatus.READY).length;
    
    const pendingKitTotals: Record<string, number> = {};
    activeOrders.forEach(o => {
      const itemsWithKits = (o.items || []).filter(i => (i.type === 'SERVO' || i.type === 'KIT') && i.installationKit && i.installationKit !== 'SEM KIT');
      const kitGroups: Record<string, OrderItem[]> = {};
      itemsWithKits.forEach(i => {
        const kitCode = normalizeKitName(i.installationKit!);
        if(!kitGroups[kitCode]) kitGroups[kitCode] = [];
        kitGroups[kitCode].push(i);
      });
      Object.entries(kitGroups).forEach(([kitCode, group]) => {
        const pendingGroupItems = group.filter(i => !i.isKitPrepared && !i.isKitConfirmed);
        if (pendingGroupItems.length > 0) {
          pendingKitTotals[kitCode] = (pendingKitTotals[kitCode] || 0) + pendingGroupItems.length;
        }
      });
    });
    const pendingKits = Object.entries(pendingKitTotals).reduce(
      (total, [kitCode, needed]) => total + Math.max(0, needed - getKitStock(kitCode)),
      0
    );

    // Count pending loose parts
    let pendingLooseParts = 0;
    activeOrders.forEach(o => {
      const looseItems = (o.items || []).filter(i => i.type === 'SPARE_PART' && !i.isCollected);
      pendingLooseParts += looseItems.length;
    });

    // Count pending repairs
    let pendingRepairs = 0;
    activeOrders.forEach(o => {
      const repairItems = (o.items || []).filter(i => i.type === 'REPAIR' && !i.isCollected);
      pendingRepairs += repairItems.length;
    });

    return {
      separation: activeOrders.length,
      pendingKits,
      pendingLooseParts,
      pendingRepairs,
      dispatch: dispatchOrdersCount,
      stock: availableUnits.length
    };
  }, [orders, availableUnits, kits]);

  const groupItems = (items: OrderItem[]) => {
    if (!items) return [];
    const groups: Record<string, { model: string; kit: string; type: OrderItemType; orientation: string; items: OrderItem[] }> = {};
    (items || []).forEach(item => {
      const kit = normalizeKitName(item.installationKit || 'SEM KIT');
      const orient = item.orientation || 'NORMAL';
      const normModel = normalizeModelName(item.model);
      const key = `${normModel}-${kit}-${item.type}-${orient}`;
      if (!groups[key]) groups[key] = { model: normModel, kit, type: item.type, orientation: orient, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  };

  const currentBatchGroup = useMemo(() => {
    if (!batchSelectingFor) return null;
    const order = orders.find(o => o.id === batchSelectingFor.orderId);
    if (!order) return null;
    const groups = groupItems(order.items);
    return groups.find(g => `${g.model}-${g.kit}-${g.type}-${g.orientation}` === batchSelectingFor.groupKey) || null;
  }, [batchSelectingFor, orders]);

  const currentPrintGroup = useMemo(() => {
    if (!printingBatchFor) return null;
    const order = orders.find(o => o.id === printingBatchFor.orderId);
    if (!order) return null;
    const groups = groupItems(order.items);
    return groups.find(g => `${g.model}-${g.kit}-${g.type}-${g.orientation}` === printingBatchFor.groupKey) || null;
  }, [printingBatchFor, orders]);

  const filterOrder = (o: Order) => {
    if (!query) return true;
    return safeToUpper(o.customerName).includes(query) || 
           safeToUpper(o.city).includes(query) ||
           safeToUpper(o.negotiationNumber).includes(query) ||
           (o.invoiceNumber && safeToUpper(o.invoiceNumber).includes(query)) ||
           safeFormatDate(o.createdAt).includes(query) ||
           (o.dispatchedAt && safeFormatDate(o.dispatchedAt).includes(query)) ||
           (o.items || []).some((i: any) => safeToUpper(i.guaranteeNumber).includes(query));
  };

  const separationOrders = useMemo(() => 
    orders.filter(o => (o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION) && filterOrder(o))
    .sort((a,b) => {
      if (a.isSelectedForToday && !b.isSelectedForToday) return -1;
      if (!a.isSelectedForToday && b.isSelectedForToday) return 1;
      return a.createdAt - b.createdAt;
    }),
  [orders, query]);

  const dispatchOrders = useMemo(() => 
    orders.filter(o => (o.status === OrderStatus.AWAITING_INVOICE || o.status === OrderStatus.READY) && filterOrder(o))
    .sort((a,b) => {
      if (a.isSelectedForToday && !b.isSelectedForToday) return -1;
      if (!a.isSelectedForToday && b.isSelectedForToday) return 1;
      return a.status === OrderStatus.READY ? -1 : 1;
    }),
  [orders, query]);

  const historyOrders = useMemo(() => 
    orders.filter(o => {
      const matchesSearch = filterOrder(o);
      const isCompleted = o.status === OrderStatus.COMPLETED;
      if (!isCompleted || !matchesSearch) return false;
      
      if (historyDate && !query) {
        if (!o.dispatchedAt) return false;
        const orderDate = safeFormatDate(o.dispatchedAt, 'iso');
        if (orderDate !== historyDate) return false;
      }
      return true;
    })
    .sort((a,b) => (b.dispatchedAt || 0) - (a.dispatchedAt || 0)),
  [orders, query, historyDate]);

  const groupedKitData = useMemo(() => {
    const groupedKits: Record<string, { kit: string, orders: { orderId: string, customer: string, items: OrderItem[], isReady: boolean, isSelectedForToday: boolean }[] }> = {};
    
    const activeOrdersInSeparation = orders.filter(o => 
      o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION
    );
    
    activeOrdersInSeparation.forEach(o => {
      const itemsWithKits = (o.items || []).filter(i => (i.type === 'SERVO' || i.type === 'KIT') && i.installationKit && i.installationKit !== 'SEM KIT');
      
      const groups: Record<string, OrderItem[]> = {};
      itemsWithKits.forEach(i => {
        const kitCode = normalizeKitName(i.installationKit!);
        if(!groups[kitCode]) groups[kitCode] = [];
        groups[kitCode].push(i);
      });

      Object.entries(groups).forEach(([kitCode, groupItems]) => {
        if (!groupedKits[kitCode]) {
          groupedKits[kitCode] = { kit: kitCode, orders: [] };
        }
        groupedKits[kitCode].orders.push({
          orderId: o.id,
          customer: o.customerName,
          items: groupItems,
          isReady: groupItems.every(gi => gi.isKitPrepared || gi.isKitConfirmed),
          isSelectedForToday: !!o.isSelectedForToday
        });
      });
    });

    const queue = Object.values(groupedKits).map(gk => {
      gk.orders.sort((a,b) => {
        if (a.isSelectedForToday && !b.isSelectedForToday) return -1;
        if (!a.isSelectedForToday && b.isSelectedForToday) return 1;
        return 0;
      });
      
      const pendingOrders = gk.orders.filter(o => !o.isReady);
      const totalUnits = pendingOrders.reduce((acc, curr) => acc + (curr.items || []).filter(i => !i.isKitPrepared && !i.isKitConfirmed).length, 0);
      
      const effectiveStock = getKitStock(gk.kit);
      const deficit = Math.max(0, totalUnits - effectiveStock);
      
      let stockRemaining = effectiveStock;
      const ordersWithStock = gk.orders.map(o => {
          let hasStock = o.isReady; // Automatically true if already confirmed
          const pendingItemCount = (o.items || []).filter(i => !i.isKitPrepared && !i.isKitConfirmed).length;
          if (!o.isReady) {
              if (stockRemaining >= pendingItemCount) {
                  hasStock = true;
                  stockRemaining -= pendingItemCount;
              }
          }
          return { ...o, hasStock };
      });

      return {
        kit: gk.kit,
        orders: ordersWithStock,
        totalUnits,
        currentStock: effectiveStock,
        deficit,
        isAllReady: deficit <= 0 && pendingOrders.length === 0,
        hasTodayOrder: gk.orders.some(o => o.isSelectedForToday && !o.isReady)
      };
    }).sort((a,b) => {
      if (a.isAllReady !== b.isAllReady) return a.isAllReady ? 1 : -1;
      if (a.hasTodayOrder && !b.hasTodayOrder) return -1;
      if (!a.hasTodayOrder && b.hasTodayOrder) return 1;
      return 0;
    });

    return { queue };
  }, [orders, kits]);

  const handlePrepareKitStock = async (orderId: string, itemIds: string[], kitName: string, model: string) => {
    const order = orders.find(o => o.id === orderId);
    const pendingItemIds = itemIds.filter(itemId => {
      const item = (order?.items || []).find(i => i.id === itemId);
      return item && !item.isKitPrepared && !item.isKitConfirmed;
    });

    if (!order || pendingItemIds.length === 0) return;

    const subKits = normalizeKitName(kitName).split('/').map(s => s.trim()).filter(Boolean);
    for (const sub of subKits) {
      const kitNamePrefix = safeToUpper(sub).startsWith('KIT') ? sub : `KIT ${sub}`;
      const code = safeToUpper(normalizeKitName(kitNamePrefix));
      await onAdjustKitStock({
        code,
        quantity: pendingItemIds.length,
        model,
        observation: `Preparação de kit para ${order.customerName}`
      });
    }

    const preparedSet = new Set(pendingItemIds);
    const updatedItems = (order.items || []).map(item =>
      preparedSet.has(item.id) ? { ...item, isKitPrepared: true } : item
    );

    await supabase.from("orders").update({ data: { ...order, items: updatedItems } }).eq("id", orderId);
    toast.success("Kit preparado", { description: `${pendingItemIds.length} unidade(s) adicionada(s) ao estoque.` });
  };

  const loosePartsData = useMemo(() => {
    const groupedParts: Record<string, { model: string, orders: { orderId: string, customer: string, items: OrderItem[], isReady: boolean, isSelectedForToday: boolean }[] }> = {};
    
    const activeOrdersInSeparation = orders.filter(o => 
      o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION
    );
    
    activeOrdersInSeparation.forEach(o => {
      const looseItems = (o.items || []).filter(i => i.type === 'SPARE_PART');
      
      const groups: Record<string, OrderItem[]> = {};
      looseItems.forEach(i => {
        const model = i.model;
        if(!groups[model]) groups[model] = [];
        groups[model].push(i);
      });

      Object.entries(groups).forEach(([model, groupItems]) => {
        if (!groupedParts[model]) {
          groupedParts[model] = { model: model, orders: [] };
        }
        groupedParts[model].orders.push({
          orderId: o.id,
          customer: o.customerName,
          items: groupItems,
          isReady: groupItems.every(gi => gi.isCollected),
          isSelectedForToday: !!o.isSelectedForToday
        });
      });
    });

    const queue = Object.values(groupedParts).map(gp => {
      gp.orders.sort((a,b) => {
        if (a.isSelectedForToday && !b.isSelectedForToday) return -1;
        if (!a.isSelectedForToday && b.isSelectedForToday) return 1;
        return 0;
      });
      return {
        model: gp.model,
        orders: gp.orders,
        totalUnits: gp.orders.reduce((acc, curr) => acc + (curr.items || []).length, 0),
        isAllReady: gp.orders.every(o => o.isReady),
        hasTodayOrder: gp.orders.some(o => o.isSelectedForToday)
      };
    }).sort((a,b) => {
      if (a.isAllReady !== b.isAllReady) return a.isAllReady ? 1 : -1;
      if (a.hasTodayOrder && !b.hasTodayOrder) return -1;
      if (!a.hasTodayOrder && b.hasTodayOrder) return 1;
      return 0;
    });

    return { queue };
  }, [orders]);

  const repairsData = useMemo(() => {
    const groupedRepairs: Record<string, { model: string, orders: { orderId: string, customer: string, items: OrderItem[], isReady: boolean, isSelectedForToday: boolean }[] }> = {};
    
    const activeOrdersInSeparation = orders.filter(o => 
      o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION
    );
    
    activeOrdersInSeparation.forEach(o => {
      const repairItems = (o.items || []).filter(i => i.type === 'REPAIR');
      
      const groups: Record<string, OrderItem[]> = {};
      repairItems.forEach(i => {
        const model = i.model;
        if(!groups[model]) groups[model] = [];
        groups[model].push(i);
      });

      Object.entries(groups).forEach(([model, groupItems]) => {
        if (!groupedRepairs[model]) {
          groupedRepairs[model] = { model: model, orders: [] };
        }
        groupedRepairs[model].orders.push({
          orderId: o.id,
          customer: o.customerName,
          items: groupItems,
          isReady: groupItems.every(gi => gi.isCollected),
          isSelectedForToday: !!o.isSelectedForToday
        });
      });
    });

    const queue = Object.values(groupedRepairs).map(gr => {
      gr.orders.sort((a,b) => {
        if (a.isSelectedForToday && !b.isSelectedForToday) return -1;
        if (!a.isSelectedForToday && b.isSelectedForToday) return 1;
        return 0;
      });
      return {
        model: gr.model,
        orders: gr.orders,
        totalUnits: gr.orders.reduce((acc, curr) => acc + (curr.items || []).length, 0),
        isAllReady: gr.orders.every(o => o.isReady),
        hasTodayOrder: gr.orders.some(o => o.isSelectedForToday)
      };
    }).sort((a,b) => {
      if (a.isAllReady !== b.isAllReady) return a.isAllReady ? 1 : -1;
      if (a.hasTodayOrder && !b.hasTodayOrder) return -1;
      if (!a.hasTodayOrder && b.hasTodayOrder) return 1;
      return 0;
    });

    return { queue };
  }, [orders]);

  const groupedInventory = useMemo(() => {
    const groups: Record<string, { model: string; orientation: string; units: AssembledUnit[] }> = {};
    availableUnits.forEach(u => {
      const ori = u.orientation || 'NORMAL';
      const normModel = normalizeModelName(u.model);
      const key = `${normModel}-${ori}`;
      if (!groups[key]) groups[key] = { model: normModel, orientation: ori, units: [] };
      groups[key].units.push(u);
    });
    return Object.values(groups).sort((a, b) => a.model.localeCompare(b.model));
  }, [availableUnits]);

  const groupedKits = useMemo(() => {
    const groups: Record<string, Kit & { totalQuantity: number }> = {};
    kits.forEach(k => {
      if (k.quantity <= 0) return;
      const normalizedName = normalizeKitName(k.name);
      const key = `${k.model}-${normalizedName}`;
      if (!groups[key]) {
        groups[key] = { ...k, name: normalizedName, totalQuantity: k.quantity };
      } else {
        groups[key].totalQuantity += k.quantity;
      }
    });
    return Object.values(groups).sort((a, b) => a.model.localeCompare(b.model) || a.name.localeCompare(b.name));
  }, [kits]);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  useEffect(() => {
    if (selectedOrderId && selectedOrder) {
      if (activeTab === 'separation') {
        if (selectedOrder.status !== OrderStatus.PENDING && selectedOrder.status !== OrderStatus.AWAITING_EXPEDITION) {
          setSelectedOrderId(null);
        }
      } else if (activeTab === 'dispatch') {
        if (selectedOrder.status !== OrderStatus.AWAITING_INVOICE && selectedOrder.status !== OrderStatus.READY) {
          setSelectedOrderId(null);
        }
      }
    }
  }, [selectedOrder, selectedOrderId, activeTab]);

  const filteredStock = useMemo(() => {
    if (!currentBatchGroup) return [];
    return availableUnits
      .filter(u => normalizeModelName(u.model) === currentBatchGroup.model && (u.orientation || 'NORMAL') === currentBatchGroup.orientation)
      .sort((a, b) => parseInt(a.guaranteeNumber) - parseInt(b.guaranteeNumber));
  }, [currentBatchGroup, availableUnits]);

  const labelAvailableSerials = useMemo(() => {
    if (!labelModel) return [];
    return availableUnits
      .filter(u => normalizeModelName(u.model) === normalizeModelName(labelModel))
      .sort((a, b) => parseInt(a.guaranteeNumber) - parseInt(b.guaranteeNumber));
  }, [labelModel, availableUnits]);

  const labelAvailableKits = useMemo(() => {
    if (!labelModel) return [];
    return SERVO_KITS[normalizeModelName(labelModel)] || [];
  }, [labelModel]);

  const handleConfirmBatch = () => {
    if (!currentBatchGroup || selectedSeriesForBatch.length === 0) return;
    const itemsToAssign = (currentBatchGroup.items || []).filter((i: any) => !i.guaranteeNumber);
    const assigns = selectedSeriesForBatch.slice(0, itemsToAssign.length).map((sn, idx) => ({
      itemId: itemsToAssign[idx].id,
      guaranteeNumber: sn
    }));
    onAssignBatch(batchSelectingFor!.orderId, assigns);
    setBatchSelectingFor(null);
    setSelectedSeriesForBatch([]);
  };

  const handleUnassignItem = (itemId: string, guaranteeNumber: string) => {
    if (confirm(`Deseja desvincular a série A${guaranteeNumber}?`)) {
      onAssignBatch(batchSelectingFor!.orderId, [{ itemId, guaranteeNumber: null }]);
      // Update local state to reflect the change if needed, but usually Firebase sync handles it.
      // However, we might need to update the group in batchSelectingFor if it's stale.
    }
  };

  const handlePrintBatch = async () => {
    if (!selectedPrinter) {
      toast.error("Nenhuma impressora selecionada", { description: "Selecione uma impressora na aba de Etiquetas." });
      return;
    }

    if (!currentPrintGroup || selectedSeriesForPrint.length === 0) {
      toast.error("Nenhuma série selecionada", { description: "Selecione ao menos uma série para imprimir." });
      return;
    }

    if (JSPM.JSPrintManager.websocket_status === JSPM.WSStatus.Open) {
      try {
        var cpj = new JSPM.ClientPrintJob();
        cpj.clientPrinter = new JSPM.InstalledPrinter(selectedPrinter);

        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');
        
        const displayKit = (currentPrintGroup.kit && currentPrintGroup.kit !== 'SEM KIT') ? currentPrintGroup.kit : 'SEM KIT DE INSTALACAO';
        const kitDataObj = kitData.find(k => k.id === displayKit);
        
        // Se for SEM KIT, tenta usar o código de barras do modelo do servo
        let finalBarcode = kitDataObj?.barcode;
        if (currentPrintGroup.kit === 'SEM KIT') {
          const modelData = servoModelData.find(s => s.model === currentPrintGroup.model);
          if (modelData?.barcode) {
            finalBarcode = modelData.barcode;
          }
        }

        const kitApplication = kitDataObj?.application;
        const orientation = currentPrintGroup.orientation && currentPrintGroup.orientation !== 'N/A' && safeToUpper(currentPrintGroup.orientation) !== 'NORMAL'
          ? (ORIENTATION_FULL_NAMES[currentPrintGroup.orientation] || currentPrintGroup.orientation) 
          : '';

        let allZpl = "";
        
        if (safisaIcon) {
          const logoZpl = await imageToBase64ZPL(safisaIcon);
          allZpl += logoZpl;
        }

        for (const sn of selectedSeriesForPrint) {
          let zplCode = "^XA";
          
          if (safisaIcon) {
            zplCode += "^FO10,10^XGR:LOGO.GRF,1,1^FS";
          } else {
            zplCode += "^FO10,10^A0N,60,60^FDSAFISA^FS";
          }
          
          zplCode += "^FO50,100^A0N,30,30^FDModelo:^FS" +
                        `^FO20,140^FB760,1,0,C^A0N,50,50^FD${currentPrintGroup.model}^FS` +
                        (orientation ? `^FO20,190^FB760,1,0,C^A0N,50,50^FD${orientation}^FS` : "") +
                        "^FO50,250^GB700,3,3^FS" +
                        "^FO50,270^A0N,30,30^FDKit de Instalacao:^FS" +
                        `^FO20,310^FB760,1,0,C^A0N,50,50^FD${displayKit}^FS` +
                        (kitApplication ? `^FO50,390^FB700,4,0,L^A0N,30,30^FDAPLICACAO: ${kitApplication}^FS` : "") +
                        "^FO50,510^GB700,3,3^FS" +
                        "^FO50,530^A0N,30,30^FDNumero de Serie:^FS" +
                        `^FO20,570^FB760,1,0,C^A0N,60,60^FDA${sn}^FS` +
                        (finalBarcode ? `^FO200,650^BCN,60,Y,N,N^FD${finalBarcode}^FS` : "") +
                        "^FO50,750^GB700,3,3^FS" +
                        `^FO20,780^FB760,1,0,C^A0N,20,20^FDImpresso em: ${dateStr} as ${timeStr}^FS` +
                        "^XZ";
          allZpl += zplCode;
        }

        cpj.printerCommands = allZpl;

        await cpj.sendToClient();
        
        toast.success("Etiquetas Enviadas para Impressão", {
          description: `${selectedSeriesForPrint.length} etiquetas de ${currentPrintGroup.model}`,
          icon: <Printer size={16} className="text-slate-400" />
        });
        
        setPrintingBatchFor(null);
        setSelectedSeriesForPrint([]);
      } catch (error) {
        console.error("Erro ao imprimir em lote:", error);
        toast.error("Erro ao imprimir", { description: "Verifique a conexão com a impressora." });
      }
    } else {
      toast.error("JSPrintManager não está rodando", { description: "Certifique-se de que o aplicativo JSPrintManager está aberto no seu computador." });
    }
  };

  const handlePrintLoosePart = async (lp: any) => {
    if (!selectedPrinter) {
      toast.error("Nenhuma impressora selecionada", { description: "Selecione uma impressora na aba de Etiquetas." });
      return;
    }

    if (JSPM.JSPrintManager.websocket_status === JSPM.WSStatus.Open) {
      try {
        var cpj = new JSPM.ClientPrintJob();
        cpj.clientPrinter = new JSPM.InstalledPrinter(selectedPrinter);

        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');
        
        const cleanModel = lp.model ? lp.model.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

        let allZpl = "";
        if (safisaIcon) {
          const logoZpl = await imageToBase64ZPL(safisaIcon);
          allZpl += logoZpl;
        }

        let zplCode = "^XA";
        
        if (safisaIcon) {
          zplCode += "^FO50,20^XGR:LOGO.GRF,1,1^FS";
        } else {
          zplCode += "^FO50,40^A0N,80,80^FDSAFISA^FS";
        }
        
        zplCode += `^FO20,140^FB760,1,0,C^A0N,40,40^FDQuantidade: ${lp.totalUnits}^FS` +
                      "^FO20,380^FB760,1,0,C^A0N,50,50^FDPeca avulsa:^FS" +
                      `^FO20,460^FB760,4,0,C^A0N,70,70^FD${cleanModel}^FS` +
                      `^FO20,750^FB760,1,0,C^A0N,20,20^FDImpresso em: ${dateStr} as ${timeStr}^FS` +
                      "^XZ";
        allZpl += zplCode;

        cpj.printerCommands = allZpl;
        await cpj.sendToClient();
        
        toast.success("Etiqueta Enviada para Impressão", {
          description: `${cleanModel}`,
          icon: <Printer size={16} className="text-slate-400" />
        });
      } catch (error) {
        console.error("Erro ao imprimir peça avulsa:", error);
        toast.error("Erro ao imprimir", { description: "Verifique a conexão com a impressora." });
      }
    } else {
      toast.error("JSPrintManager não está rodando", { description: "Certifique-se de que o aplicativo JSPrintManager está aberto no seu computador." });
    }
  };

  const [dispatchConfirmModal, setDispatchConfirmModal] = useState<Order | null>(null);

  const handleFinalDispatch = () => {
    if (dispatchConfirmModal) {
      const order = dispatchConfirmModal;
      const previousStatus = order.status;
      
      onCompleteExpedition(order.id, weight, volume);
      
      // Set undo action for 8 seconds
      setUndoAction({ 
        orderId: order.id, 
        previousStatus: previousStatus,
        customerName: order.customerName
      });
      setTimeout(() => setUndoAction(null), 8000);

      setDispatchConfirmModal(null);
      setSelectedOrderId(null);
      setWeight('');
      setVolume('');
      toast.success(previousStatus === OrderStatus.READY ? "Pedido despachado com sucesso!" : "Pedido liberado com sucesso!");
    }
  };

  const renderOrderDetail = (order: Order) => (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0 w-full">
       <div className="p-6 md:p-8 bg-slate-800 border-b border-slate-700 shrink-0">
          <div className="flex justify-between items-start mb-6">
             <div className="overflow-hidden pr-4">
                <div className="flex items-center gap-3 mb-2">
                   <h3 className="text-2xl font-semibold uppercase italic tracking-tighter leading-none text-white">{order.customerName}</h3>
                   {editingInvoiceOrderId === order.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingInvoiceValue}
                          onChange={e => setEditingInvoiceValue(e.target.value)}
                          className="px-2.5 py-1 border border-slate-700 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase w-24 outline-none focus:ring-2 ring-slate-500"
                          placeholder="NF..."
                        />
                        <button
                          onClick={async () => {
                            const trimmed = editingInvoiceValue.trim();
                            if (trimmed !== order.invoiceNumber) {
                              await supabase.from("orders").update({ data: { ...order, invoiceNumber: trimmed } }).eq("id", order.id);
                              toast.success("Nota Fiscal atualizada!");
                            }
                            setEditingInvoiceOrderId(null);
                          }}
                          className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-md hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
                         aria-label="Salvar">
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingInvoiceOrderId(null)}
                          className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-600 transition-colors"
                         aria-label="Cancelar">
                          Cancelar
                        </button>
                      </div>
                   ) : (
                     (order.invoiceNumber || order.status !== OrderStatus.AWAITING_INVOICE) && (
                       <div className="flex items-center gap-2 group">
                         <span className={`${order.invoiceNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-700 text-slate-400'} px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest`}>
                           {order.invoiceNumber ? `NF: ${order.invoiceNumber}` : 'SEM NF'}
                         </span>
                         {order.status !== OrderStatus.COMPLETED && (
                           <button
                             onClick={() => {
                               setEditingInvoiceOrderId(order.id);
                               setEditingInvoiceValue(order.invoiceNumber || '');
                             }}
                             className={`${order.invoiceNumber ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} text-slate-400 hover:text-slate-100 transition-opacity`}
                             title="Editar Nota Fiscal"
                            aria-label="Editar Nota Fiscal">
                             <Pencil size={12} />
                           </button>
                         )}
                       </div>
                     )
                   )}
                </div>
                <div className="flex flex-wrap gap-4 mt-2 text-slate-500">
                   <p className="text-[10px] font-bold uppercase flex items-center gap-1.5"><MapPin size={12}/> {order.city}</p>
                   <p className="text-[10px] font-bold uppercase flex items-center gap-1.5"><Calendar size={12}/> {safeFormatDate(order.createdAt)}</p>
                </div>
             </div>
             <button onClick={() => setSelectedOrderId(null)} className="p-2 bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 rounded-xl transition-all shrink-0" aria-label="Botão"><X size={20} /></button>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 shrink-0 space-y-4">
             <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Negociação</span><span className="text-xs font-bold text-white truncate block">{order.negotiationNumber || '---'}</span></div>
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Entrega</span><span className="text-xs font-bold text-white truncate block">{order.deliveryDate || '---'}</span></div>
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Transporte</span><span className="text-xs font-bold text-white uppercase truncate block">{order.carrier}</span></div>
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Representante</span><span className="text-xs font-bold text-white uppercase truncate block">{order.representative}</span></div>
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Peso</span><span className="text-xs font-bold text-white uppercase truncate block">{order.weight ? `${order.weight}kg` : '---'}</span></div>
                <div><span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Volumes</span><span className="text-xs font-bold text-white uppercase truncate block">{order.volume || '---'}</span></div>
             </div>
             {order.observation && (
                <div className="pt-4 border-t border-slate-700/50">
                   <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Observação do Pedido</span>
                   <span className="text-xs font-bold text-white block whitespace-pre-wrap">{order.observation}</span>
                </div>
             )}
          </div>
       </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-left">Tipo</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-left">Descrição do Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-center">Qtd</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-left">Status / Séries</th>
                  {order.status !== OrderStatus.COMPLETED && (
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {groupItems(order.items).map((group, idx) => {
                  const isFullyReady = (group.items || []).every(i => {
                    const kitOk = !i.installationKit || i.installationKit === 'SEM KIT' || i.isKitConfirmed;
                    if (i.type === 'SERVO') return !!i.guaranteeNumber && kitOk;
                    if (i.type === 'KIT') return kitOk;
                    return !!i.isCollected;
                  });
                  const isKitGroup = (group.type === 'SERVO' || group.type === 'KIT') && group.kit !== 'SEM KIT';
                  const isKitIncluded = (group.items || []).every(i => i.isKitConfirmed);
                  const kitItemsToInclude = (group.items || []).filter(i => !i.isKitConfirmed);
                  const hasRequiredKitStock = !isKitGroup || isKitIncluded || getKitStock(group.kit) >= kitItemsToInclude.length;

                  return (
                    <React.Fragment key={`${group.model}-${group.kit}-${group.type}-${group.orientation}`}>
                      <tr className={`group transition-colors ${isFullyReady ? 'bg-emerald-900/5 hover:bg-emerald-900/10' : 'bg-slate-800/30 hover:bg-slate-800/50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${
                              group.type === 'SERVO' ? 'bg-slate-700/20 text-slate-200' : 
                              group.type === 'KIT' ? 'bg-slate-800 text-slate-300' : 
                              group.type === 'REPAIR' ? 'bg-blue-500/10 text-blue-500' : 
                              'bg-slate-500/10 text-slate-500'
                            }`}>
                              {group.type === 'SERVO' ? <Package size={14}/> : group.type === 'KIT' ? <Box size={14}/> : group.type === 'REPAIR' ? <Wrench size={14}/> : <Settings2 size={14}/>}
                            </div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{group.type === 'SERVO' ? 'SERVO' : group.type === 'KIT' ? 'KIT' : group.type === 'REPAIR' ? 'REPARO' : 'PEÇA'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[13px] uppercase italic text-white flex items-center flex-wrap leading-tight">
                                <span>{group.type === 'KIT' ? `KIT ${group.kit}` : group.model}</span>
                                {group.type === 'SERVO' && (
                                  <span className="text-slate-400 font-semibold ml-2">
                                    | {group.orientation} | <span className="text-white">KIT: {group.kit}</span>
                                  </span>
                                )}
                              </span>
                            </div>
                            {(group.type === 'SERVO' || group.type === 'KIT') && group.kit !== 'SEM KIT' && (
                              <button onClick={() => setViewingKitImage(group.kit)} className="text-slate-400 hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors pt-0.5" title="Visualizar foto do kit" aria-label="Visualizar foto do kit">
                                <Eye size={14} /> <span className="underline decoration-slate-400/30 underline-offset-2">FOTO</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-700/50 text-slate-300 text-[13px] font-bold shadow-sm">
                            {(group.items || []).length}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {group.type === 'SERVO' && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase border ${(group.items || []).every(i => i.guaranteeNumber) ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-slate-700/30 border-slate-700 text-slate-500'}`}>
                                {(group.items || []).filter(i => i.guaranteeNumber).length}/{(group.items || []).length} Séries
                              </span>
                            )}
                            {isKitGroup && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase border ${isKitIncluded ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-700/30 border-slate-700 text-slate-500'}`}>
                                Kit {isKitIncluded ? 'Incluso' : 'Pendente'}
                              </span>
                            )}
                            {(group.type === 'REPAIR' || group.type === 'SPARE_PART') && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase border ${(group.items || []).every(i => i.isCollected) ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-slate-700/30 border-slate-700 text-slate-500'}`}>
                                {(group.items || []).every(i => i.isCollected) ? 'Coletado' : 'Pendente'}
                              </span>
                            )}
                          </div>
                        </td>
                        {order.status !== OrderStatus.COMPLETED && (
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2 text-slate-400">
                              {group.type === 'SERVO' && (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => { setBatchSelectingFor({ orderId: order.id, groupKey: `${group.model}-${group.kit}-${group.type}-${group.orientation}` }); setSelectedSeriesForBatch([]); }}
                                    className="p-2 bg-slate-900 border border-slate-700 hover:border-slate-500 hover:text-white rounded-lg transition-all"
                                    title="Vincular Séries"
                                   aria-label="Vincular Séries">
                                    <Layers size={14} />
                                  </button>
                                  <button 
                                    onClick={() => { setPrintingBatchFor({ orderId: order.id, groupKey: `${group.model}-${group.kit}-${group.type}-${group.orientation}` }); setSelectedSeriesForPrint((group.items || []).filter(i => i.guaranteeNumber).map(i => i.guaranteeNumber!)); }}
                                    className="p-2 bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 rounded-lg transition-all"
                                    title="Imprimir Etiquetas"
                                   aria-label="Imprimir Etiquetas">
                                    <Printer size={14} />
                                  </button>
                                </div>
                              )}
                              
                              {(group.type === 'REPAIR' || group.type === 'SPARE_PART') && (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handlePrintLoosePart({ totalUnits: (group.items || []).length, model: group.model })}
                                    className="p-2 bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 rounded-lg transition-all"
                                    title="Imprimir Etiqueta"
                                   aria-label="Imprimir Etiqueta">
                                    <Printer size={14} />
                                  </button>
                                  <button 
                                    onClick={() => onMarkGroupCollected(order.id, (group.items || []).map(i => i.id))}
                                    className={`p-2 rounded-lg transition-all ${(group.items || []).every(i => i.isCollected) ? 'bg-emerald-600 text-white' : 'bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400'}`}
                                    title={(group.items || []).every(i => i.isCollected) ? 'Coletado' : 'Marcar como Coletado'}
                                   aria-label="Botão">
                                    <Check size={14} />
                                  </button>
                                </div>
                              )}

                              {isKitGroup && (
                                <button 
                                  onClick={() => {
                                    if (!isKitIncluded && hasRequiredKitStock) {
                                      onToggleGroupKit(order.id, kitItemsToInclude.map(i => i.id));
                                    }
                                  }} 
                                  disabled={isKitIncluded || !hasRequiredKitStock}
                                  className={`p-2 rounded-lg transition-all ${!isKitIncluded && hasRequiredKitStock ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-900 border border-slate-700 text-slate-600 cursor-not-allowed opacity-60'}`}
                                  title={isKitIncluded ? 'Kit já incluso' : hasRequiredKitStock ? 'Incluir kit' : 'Estoque insuficiente'}
                                 aria-label={isKitIncluded ? 'Kit já incluso' : hasRequiredKitStock ? 'Incluir kit' : 'Estoque insuficiente'}>
                                  <Box size={14}/>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {(group.items || []).some((i: any) => i.guaranteeNumber) && (
                        <tr key={`${idx}-serials`}>
                          <td colSpan={order.status !== OrderStatus.COMPLETED ? 6 : 5} className="px-6 py-2 bg-slate-900/30">
                            <div className="flex flex-wrap gap-2">
                              {(group.items || []).filter(i => i.guaranteeNumber).map(item => (
                                <span key={item.id} className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold text-[9px] text-white shadow-sm italic">A{item.guaranteeNumber}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
       </div>

       {order.status !== OrderStatus.COMPLETED && (
            <div className="p-4 md:p-6 shrink-0 bg-slate-800 border-t border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-4">
                 <div className="space-y-1 w-32">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Peso Total (kg)</label>
                    <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg font-black text-xs outline-none focus:border-slate-500 shadow-inner placeholder:text-slate-600" />
                 </div>
                 <div className="space-y-1 w-32">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Volumes</label>
                    <input value={volume} onChange={e => setVolume(e.target.value)} placeholder="1" className="w-full px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-lg font-black text-xs outline-none focus:border-slate-500 shadow-inner placeholder:text-slate-600" />
                 </div>
              </div>

              <div className="flex shrink-0">
                 {order.status === OrderStatus.READY ? (
                   <button onClick={() => {
                     setDispatchConfirmModal(order);
                   }} className="bg-emerald-600 text-white px-8 py-3 h-full rounded-xl font-bold uppercase text-[10px] shadow-xl hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 transition-all" aria-label="Confirmar Despacho">Confirmar Despacho</button>
                 ) : order.status === OrderStatus.AWAITING_INVOICE ? (
                   <button disabled className="px-8 py-3 h-full rounded-xl font-black uppercase text-[10px] shadow-xl transition-all bg-slate-100 text-slate-400 cursor-not-allowed border" aria-label="Aguardando Faturamento">Aguardando Faturamento</button>
                 ) : (
                   <button onClick={() => {
                     setDispatchConfirmModal(order);
                   }} disabled={!isOrderFullySeparated(order) || !weight || !volume} className={`px-8 py-3 h-full rounded-xl font-black uppercase text-[10px] shadow-xl transition-all ${isOrderFullySeparated(order) && weight && volume ? 'bg-slate-900 text-white hover:scale-105' : 'bg-slate-100 text-slate-300 cursor-not-allowed border'}`} aria-label="Botão">{order.requiresInvoice === false ? 'Liberar para Saída' : 'Liberar Faturamento'}</button>
                 )}
              </div>
            </div>
          )}
    </div>
  );

  const renderLabelsTab = () => {
    const handlePrint = async () => {
      if (!labelModel || !labelSerial) {
        toast.error("Campos Incompletos", { description: "Preencha o modelo e o número de série." });
        return;
      }

      if (!selectedPrinter) {
        toast.error("Nenhuma impressora selecionada", { description: "Selecione uma impressora disponível." });
        return;
      }

      if (JSPM.JSPrintManager.websocket_status === JSPM.WSStatus.Open) {
        try {
          // 2. Definir a impressora
          var cpj = new JSPM.ClientPrintJob();
          cpj.clientPrinter = new JSPM.InstalledPrinter(selectedPrinter);

          // 3. Criar os comandos ZPL
          const orientation = labelOrientation && safeToUpper(labelOrientation) !== 'NORMAL' ? (ORIENTATION_FULL_NAMES[labelOrientation] || labelOrientation) : '';
          const now = new Date();
          const dateStr = now.toLocaleDateString('pt-BR');
          const timeStr = now.toLocaleTimeString('pt-BR');
          
          let allZpl = "";
          if (safisaIcon) {
            const logoZpl = await imageToBase64ZPL(safisaIcon);
            allZpl += logoZpl;
          }

          const kitsToPrint = (labelHasKit && labelKit !== 'SEM KIT') ? labelKit.split('/') : ['SEM KIT'];

          for (const kName of kitsToPrint) {
            const currentKit = kName.trim();
            const displayKit = currentKit === 'SEM KIT' ? 'SEM KIT DE INSTALACAO' : currentKit;
            const kitDataObj = kitData.find(k => k.id === currentKit);
            
            // Se for SEM KIT, tenta usar o código de barras do modelo do servo
            let finalBarcode = kitDataObj?.barcode;
            if (currentKit === 'SEM KIT') {
              const modelData = servoModelData.find(s => s.model === labelModel);
              if (modelData?.barcode) {
                finalBarcode = modelData.barcode;
              }
            }

            const kitApplication = kitDataObj?.application;
            
            let zplCode = "^XA";
            
            if (safisaIcon) {
              zplCode += "^FO10,10^XGR:LOGO.GRF,1,1^FS";
            } else {
              zplCode += "^FO10,10^A0N,60,60^FDSAFISA^FS";
            }
            
            zplCode += "^FO50,100^A0N,30,30^FDModelo:^FS" +
                          `^FO20,140^FB760,1,0,C^A0N,50,50^FD${labelModel}^FS` +
                          (orientation ? `^FO20,190^FB760,1,0,C^A0N,50,50^FD${orientation}^FS` : "") +
                          "^FO50,250^GB700,3,3^FS" +
                          "^FO50,270^A0N,30,30^FDKit de Instalacao:^FS" +
                          `^FO20,310^FB760,1,0,C^A0N,50,50^FD${displayKit}^FS` +
                          (kitApplication ? `^FO50,390^FB700,4,0,L^A0N,30,30^FDAPLICACAO: ${kitApplication}^FS` : "") +
                          "^FO50,510^GB700,3,3^FS" +
                          "^FO50,530^A0N,30,30^FDNumero de Serie:^FS" +
                          `^FO20,570^FB760,1,0,C^A0N,60,60^FDA${labelSerial}^FS` +
                          (finalBarcode ? `^FO200,650^BCN,60,Y,N,N^FD${finalBarcode}^FS` : "") +
                          "^FO50,750^GB700,3,3^FS" +
                          `^FO20,780^FB760,1,0,C^A0N,20,20^FDImpresso em: ${dateStr} as ${timeStr}^FS` +
                          "^XZ";
            allZpl += zplCode;
          }

          cpj.printerCommands = allZpl;

          // 4. Enviar para a impressora
          await cpj.sendToClient();
          
          toast.success("Etiqueta Enviada para Impressão", {
            description: `${labelModel} - A${labelSerial}`,
            icon: <Printer size={16} className="text-slate-400" />
          });
        } catch (error) {
          console.error("Erro ao imprimir:", error);
          toast.error("Erro ao imprimir", { description: "Verifique a conexão com a impressora." });
        }
      } else {
        toast.error("JSPrintManager não está rodando", { description: "Certifique-se de que o aplicativo JSPrintManager está aberto no seu computador." });
      }
    };

    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-xl no-print">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400">
                <Printer size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Impressão de Etiquetas</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zebra ZD220 • 10x10cm</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Modelo do Servo</label>
                <select 
                  value={labelModel} 
                  onChange={e => {
                    setLabelModel(e.target.value);
                    setLabelKit('SEM KIT');
                    setLabelSerial('');
                    setIsManualSerial(false);
                    setLabelOrientation('NORMAL');
                  }} 
                  className="w-full px-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500 uppercase text-sm"
                >
                  <option value="">SELECIONE O MODELO...</option>
                  {SERVO_BASE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Orientação</label>
                <select 
                  value={labelOrientation} 
                  onChange={e => setLabelOrientation(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500 uppercase text-sm"
                >
                  {Object.entries(ORIENTATION_FULL_NAMES).map(([key, value]) => (
                    <option key={key} value={key}>{value}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kit de Instalação</label>
                    {labelKit !== 'SEM KIT' && (
                      <button onClick={() => setViewingKitImage(labelKit)} className="text-slate-400 hover:text-white flex items-center gap-1" aria-label="Ver Foto">
                        <Eye size={12} /><span className="text-[8px] font-black uppercase">Ver Foto</span>
                      </button>
                    )}
                  </div>
                  <select 
                    value={labelKit} 
                    onChange={e => {
                      setLabelKit(e.target.value);
                      setLabelHasKit(e.target.value !== 'SEM KIT');
                    }}
                    disabled={!labelModel}
                    className="w-full px-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500 uppercase text-sm disabled:opacity-50"
                  >
                    <option value="SEM KIT">SEM KIT</option>
                    {labelAvailableKits.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Número de Série</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400">A</span>
                    <select 
                      value={isManualSerial ? 'MANUAL' : labelSerial} 
                      onChange={e => {
                        if (e.target.value === 'MANUAL') {
                          setIsManualSerial(true);
                          setLabelSerial('');
                        } else {
                          setIsManualSerial(false);
                          setLabelSerial(e.target.value);
                        }
                      }}
                      disabled={!labelModel}
                      className="w-full pl-10 pr-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500 uppercase text-sm disabled:opacity-50"
                    >
                      <option value="">SELECIONE...</option>
                      {labelAvailableSerials.map(u => (
                        <option key={u.id} value={u.guaranteeNumber}>{u.guaranteeNumber}</option>
                      ))}
                      <option value="MANUAL">DIGITAR MANUALMENTE...</option>
                    </select>
                  </div>
                </div>
              </div>

              {isManualSerial && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Série Manual</label>
                  <input 
                    type="text"
                    value={labelSerial}
                    placeholder="Digite o número..."
                    className="w-full px-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500"
                    onChange={e => setLabelSerial(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
                <button 
                  onClick={() => setLabelHasKit(!labelHasKit)}
                  className={`w-12 h-6 rounded-full transition-all relative ${labelHasKit ? 'bg-slate-700' : 'bg-slate-300'}`}
                 aria-label="Botão">
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${labelHasKit ? 'left-7' : 'left-1'}`} />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Exibir Kit na Etiqueta</span>
              </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={handlePrint}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
               aria-label="Imprimir (Navegador)">
                <Printer size={20} /> Imprimir (Navegador)
              </button>
            </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                  <Printer size={14} /> Impressora
                </label>
                <select 
                  value={selectedPrinter} 
                  onChange={e => setSelectedPrinter(e.target.value)} 
                  className="w-full px-6 py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black outline-none focus:ring-2 ring-slate-500 uppercase text-sm"
                >
                  {printers.length === 0 && <option value="">Buscando impressoras...</option>}
                  {printers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2 mt-6">
                <Warehouse size={14} /> Unidades em Estoque ({labelModel || 'Todos'})
              </h4>
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 max-h-[400px] overflow-y-auto space-y-2">
                {labelAvailableSerials.length === 0 ? (
                  <div className="py-10 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase">Nenhuma unidade em estoque para este modelo</p>
                  </div>
                ) : (
                  labelAvailableSerials.map(unit => (
                    <button 
                      key={unit.id}
                      onClick={() => {
                        setLabelModel(unit.model);
                        setLabelSerial(unit.guaranteeNumber);
                        setLabelOrientation(unit.orientation || 'NORMAL');
                      }}
                      className={`w-full p-4 rounded-xl border transition-all group flex justify-between items-center ${labelSerial === unit.guaranteeNumber ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 hover:border-slate-400'}`}
                     aria-label="Botão">
                      <div className="text-left">
                        <span className={`block font-black text-[10px] uppercase italic ${labelSerial === unit.guaranteeNumber ? 'text-white' : 'text-white'}`}>{unit.model}</span>
                        <span className={`text-[8px] font-bold uppercase ${labelSerial === unit.guaranteeNumber ? 'text-slate-300' : 'text-slate-400'}`}>{unit.orientation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black group-hover:scale-110 transition-transform text-white">A{unit.guaranteeNumber}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title="Expedição"
        tabs={[
          { id: 'separation', label: 'Separação', icon: <Package size={16} /> },
          { 
            id: 'preparation', 
            label: 'Preparação', 
            icon: <ClipboardList size={16} />,
            subTabs: [
              { id: 'kits', label: 'Kits Pendentes' },
              { id: 'looseParts', label: 'Peças Avulsas' },
              { id: 'repairs', label: 'Reparos' }
            ]
          },
          { id: 'dispatch', label: 'Saída', icon: <Truck size={16} /> },
          { 
            id: 'inventory', 
            label: 'Estoque', 
            icon: <Warehouse size={16} />,
            subTabs: [
              { id: 'servos', label: 'Servos' },
              { id: 'kits', label: 'Kits' }
            ]
          },
          { 
            id: 'kitRegistration', 
            label: 'Cadastro', 
            icon: <Box size={16} />,
            subTabs: [
              { id: 'register', label: 'Novo Kit' },
              { id: 'list', label: 'Lista' }
            ]
          },
          { id: 'history', label: 'Histórico', icon: <History size={16} /> },
          { id: 'labels', label: 'Etiquetas', icon: <Printer size={16} /> },
          { id: 'kitsView', label: 'Kits', icon: <ImageIcon size={16} /> }
        ]}
        activeTab={activeTab}
        activeSubTab={
          activeTab === 'preparation' ? preparationSubTab :
          activeTab === 'inventory' ? inventorySubTab :
          activeTab === 'kitRegistration' ? kitRegistrationSubTab :
          undefined
        }
        onTabChange={(id, subTabId) => {
          setActiveTab(id as any);
          if (id === 'preparation' && subTabId) setPreparationSubTab(subTabId as any);
          if (id === 'inventory' && subTabId) setInventorySubTab(subTabId as any);
          if (id === 'kitRegistration' && subTabId) setKitRegistrationSubTab(subTabId as any);
          setSelectedOrderId(null);
        }}
      />
      
      <div className={`transition-all duration-300 w-full p-3 md:p-4 ${isSidebarOpen ? 'lg:pl-[280px]' : ''}`}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        {showTabs && (
          <div className="flex items-center w-full">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 shadow-sm"
              title="Menu"
             aria-label="Menu">
              <Menu size={20} />
            </button>
            <h2 className="text-xl font-bold text-white uppercase italic tracking-tighter ml-4">
              Expedição - {
                [
                  { id: 'separation', label: 'Separação' },
                  { id: 'preparation', label: 'Preparação' },
                  { id: 'dispatch', label: 'Saída' },
                  { id: 'inventory', label: 'Estoque' },
                  { id: 'kitRegistration', label: 'Cadastro' },
                  { id: 'history', label: 'Histórico' },
                  { id: 'labels', label: 'Etiquetas' },
                  { id: 'kitsView', label: 'Kits' }
                ].find(t => t.id === activeTab)?.label
              }
            </h2>
          </div>
        )}
        <div className={`flex items-center gap-3 w-full ${showTabs ? 'md:w-auto' : 'md:w-full justify-end'}`}>
          <div className="bg-slate-800 p-2.5 px-4 rounded-xl border border-slate-700 flex items-center gap-3 shadow-sm flex-1 md:w-[200px] md:flex-none">
             <Search className="text-slate-300" size={14} />
             <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PESQUISA..." className="flex-1 bg-transparent border-none outline-none font-bold text-[9px] uppercase text-white placeholder:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Dashboard de Indicadores - Bento Style */}
      {showSummaryCards && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 no-print">
           <div 
              onClick={() => setActiveTab('separation')}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-slate-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-slate-950/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-slate-900/30 rounded-lg flex items-center justify-center text-slate-400 mb-4 relative z-10"><Package size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Em Separação</span>
                 <span className="block text-2xl font-bold text-white tracking-tighter">{metrics.separation}</span>
              </div>
           </div>
           <div 
              onClick={() => { setActiveTab('preparation'); setPreparationSubTab('kits'); }}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-orange-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-400 mb-4 relative z-10"><Box size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Kits Pendentes</span>
                 <span className="block text-2xl font-black text-white tracking-tighter">{metrics.pendingKits}</span>
              </div>
           </div>
           <div 
              onClick={() => { setActiveTab('preparation'); setPreparationSubTab('looseParts'); }}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-slate-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-slate-900 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 mb-4 relative z-10"><Settings2 size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Peças Avulsas</span>
                 <span className="block text-2xl font-black text-white tracking-tighter">{metrics.pendingLooseParts}</span>
              </div>
           </div>
           <div 
              onClick={() => { setActiveTab('preparation'); setPreparationSubTab('repairs'); }}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-400 mb-4 relative z-10"><Wrench size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Reparos</span>
                 <span className="block text-2xl font-black text-white tracking-tighter">{metrics.pendingRepairs}</span>
              </div>
           </div>
           <div 
              onClick={() => setActiveTab('dispatch')}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-emerald-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-400 mb-4 relative z-10"><Truck size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Aguardando Saída</span>
                 <span className="block text-2xl font-black text-white tracking-tighter">{metrics.dispatch}</span>
              </div>
           </div>
           <div 
              onClick={() => setActiveTab('inventory')}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-white transition-all relative overflow-hidden cursor-pointer active:scale-95"
           >
              <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
              <div className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center text-white mb-4 relative z-10"><Warehouse size={18}/></div>
              <div className="relative z-10">
                 <span className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estoque Disponível</span>
                 <span className="block text-2xl font-black text-white tracking-tighter">{metrics.stock}</span>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'kitRegistration' && (
        <div className="space-y-8 animate-in fade-in duration-500 p-6">
          {/* Sub-tabs de Cadastro */}
          <div className="flex flex-wrap gap-2 no-print bg-slate-800 p-2 rounded-2xl border border-slate-700 w-fit">
            {[
              { id: 'register', label: 'Novo Kit', icon: <Plus size={14} /> },
              { id: 'list', label: 'Lista', icon: <Box size={14} /> }
            ].map(sub => (
              <button 
                key={sub.id} 
                onClick={() => setKitRegistrationSubTab(sub.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${kitRegistrationSubTab === sub.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/50'}`}
               aria-label="Botão">
                {sub.icon} {sub.label}
              </button>
            ))}
          </div>

          {kitRegistrationSubTab === 'register' && (
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-sm max-w-lg mx-auto">
              <h3 className="text-white font-black uppercase tracking-widest mb-6 italic flex items-center gap-2">
                <Plus size={18} className="text-slate-400" /> Cadastrar Kit para Estoque
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const model = formData.get('model') as string;
                const kit = formData.get('kit') as string;
                const quantity = Number(formData.get('quantity'));
                
                if (!model || !kit || !quantity) {
                  toast.error('Preencha todos os campos!');
                  return;
                }

                await supabase.from("kits").insert({ id: generateId(), data: { name: `Kit ${kit}`, model, quantity } });
                toast.success('Kit cadastrado com sucesso!');
                e.currentTarget.reset();
                setSelectedModel('');
                setSelectedKit('');
              }} className="space-y-4">
                <select name="model" className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-slate-500 transition-all font-bold appearance-none" required onChange={(e) => { setSelectedModel(e.target.value); setSelectedKit(''); }}>
                  <option value="">Selecione o Modelo</option>
                  {SERVO_BASE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className="relative">
                  <select 
                    name="kit" 
                    className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white outline-none focus:border-slate-500 transition-all font-bold appearance-none pr-12" 
                    required 
                    disabled={!selectedModel}
                    onChange={(e) => setSelectedKit(e.target.value)}
                  >
                    <option value="">Selecione o Kit</option>
                    {selectedModel && SERVO_KITS[selectedModel]?.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  {selectedKit && (
                    <button
                      type="button"
                      onClick={() => setViewingKitImage(selectedKit)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      title="Ver Foto de Referência"
                     aria-label="Ver Foto de Referência">
                      <Eye size={20} />
                    </button>
                  )}
                </div>
                <input name="quantity" type="number" placeholder="Quantidade" className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white outline-none focus:border-slate-500 transition-all font-bold" required />
                <button type="submit" className="w-full bg-slate-950 text-white py-4 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-900 transition-all active:scale-95" aria-label="Cadastrar">Cadastrar</button>
              </form>
            </div>
          )}

          {kitRegistrationSubTab === 'list' && (
            <div className="space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                 <Box size={14} /> Estoque de Kits
               </h3>
               <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="p-4">Lente</th>
                          <th className="p-4">Kit</th>
                          <th className="p-4">Modelo</th>
                          <th className="p-4 text-center">Quantidade</th>
                          <th className="p-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {groupedKits.map(kit => (
                          <tr key={`${kit.model}-${kit.name}`} className="hover:bg-slate-700/50 transition-colors">
                            <td className="p-4">
                              <button 
                                onClick={() => setViewingKitImage(kit.name.replace('Kit ', ''))}
                                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex items-center justify-center shadow-sm"
                                title="Ver Foto de Referência"
                               aria-label="Ver Foto de Referência">
                                <Eye size={16} />
                              </button>
                            </td>
                            <td className="p-4 font-semibold text-white whitespace-nowrap">{kit.name}</td>
                            <td className="p-4 text-slate-300 text-sm whitespace-nowrap">{kit.model}</td>
                            <td className="p-4 text-center">
                              <span className="text-sm font-semibold text-white bg-slate-900 px-4 py-1.5 rounded-md shadow-inner">{kit.totalQuantity}</span>
                            </td>
                            <td className="p-4 text-right">
                              {onDeleteKitGroup && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Tem certeza que deseja remover todos os kits ${kit.name} (${kit.model}) do estoque?`)) {
                                      onDeleteKitGroup(kit.model, kit.name);
                                    }
                                  }}
                                  className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm"
                                  title="Remover do Estoque"
                                 aria-label="Remover do Estoque">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {groupedKits.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-20 text-center opacity-40">
                               <Box size={48} className="mx-auto mb-4 text-slate-500" />
                               <p className="text-sm font-semibold">Nenhum Kit em Estoque</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'labels' && renderLabelsTab()}

      {activeTab === 'kitsView' && (
        <div className="space-y-8 animate-in fade-in duration-500 p-6">
          {Object.entries(SERVO_KITS).map(([model, kitNames]) => {
            const modelKits = kitData.filter(k => kitNames.includes(k.name));
            if (modelKits.length === 0) return null;
            return (
              <div key={model} className="mb-8">
                <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest border-b-2 border-slate-700 pb-3 flex items-center gap-3">
                  <Box size={20} className="text-slate-400" />
                  {model}
                </h3>
                <div className="flex flex-wrap gap-4">
                  {modelKits.map(kit => (
                    <button
                      key={kit.id}
                      onClick={() => setViewingKitData(kit)}
                      className="px-8 py-4 bg-slate-800 hover:bg-slate-950 text-white rounded-xl border-2 border-slate-700 hover:border-slate-600 transition-all font-black uppercase tracking-widest text-sm shadow-sm hover:-translate-y-1"
                     aria-label="Botão">
                      {kit.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          
          {(() => {
            const mappedKitNames = Object.values(SERVO_KITS).flat();
            const unmappedKits = kitData.filter(k => !mappedKitNames.includes(k.name));
            if (unmappedKits.length === 0) return null;
            return (
              <div className="mb-8">
                <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest border-b-2 border-slate-700 pb-3 flex items-center gap-3">
                  <Box size={20} className="text-slate-500" />
                  Outros Kits
                </h3>
                <div className="flex flex-wrap gap-4">
                  {unmappedKits.map(kit => (
                    <button
                      key={kit.id}
                      onClick={() => setViewingKitData(kit)}
                      className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border-2 border-slate-700 hover:border-slate-500 transition-all font-black uppercase tracking-widest text-sm shadow-sm hover:shadow-xl hover:-translate-y-1"
                     aria-label="Botão">
                      {kit.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {kitData.length === 0 && (
            <div className="py-20 text-center border-4 border-dashed border-slate-700 rounded-2xl opacity-50">
              <ImageIcon size={48} className="mx-auto mb-4 text-slate-500" />
              <p className="text-xl font-black uppercase text-slate-400">Nenhum Kit Cadastrado</p>
            </div>
          )}
        </div>
      )}

      {viewingKitData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setViewingKitData(null)} />
          
          <button 
            onClick={() => setViewingKitData(null)}
            className="absolute top-6 right-6 p-4 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full transition-colors z-10 backdrop-blur-sm"
           aria-label="Botão">
            <X size={32} />
          </button>

          <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] flex flex-col items-center justify-center animate-in zoom-in-95 pointer-events-none">
            {(() => {
              const kitImage = kitImages.find(img => img.id === viewingKitData.name);
              return kitImage ? (
                <img src={kitImage.data} alt={viewingKitData.name} className="w-full h-full object-contain drop-shadow-2xl pointer-events-auto" />
              ) : (
                <div className="text-slate-500 flex flex-col items-center pointer-events-auto">
                  <ImageIcon size={80} className="mb-6 opacity-50" />
                  <span className="text-xl font-black uppercase tracking-widest">Sem Imagem</span>
                </div>
              );
            })()}
            
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-md px-8 py-4 rounded-full border border-slate-700/50 shadow-2xl flex items-center gap-6 pointer-events-auto">
                <span className="text-2xl font-black text-white">{viewingKitData.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'separation' || activeTab === 'dispatch') && (
        <div className="space-y-6">
           <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="sticky top-0 z-10">
                   <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                     <th className="p-4">Cliente</th>
                     <th className="p-4 hidden md:table-cell">Cidade</th>
                     <th className="p-4 hidden md:table-cell">Transportadora</th>
                     <th className="p-4">Itens</th>
                     <th className="p-4">Status</th>
                     <th className="p-4 hidden sm:table-cell">NF</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-700/50">
                   {(activeTab === 'separation' ? separationOrders : dispatchOrders).map(o => (
                     <tr key={o.id} onClick={() => { setSelectedOrderId(o.id); setWeight(o.weight || ''); setVolume(o.volume || ''); }} className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${selectedOrderId === o.id ? 'bg-slate-700' : ''} ${o.isSelectedForToday || isOrderFullySeparated(o) ? 'bg-blue-900/10' : ''}`}>
                        <td className="p-4 font-semibold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {(o.isSelectedForToday || isOrderFullySeparated(o)) && <Calendar size={14} className={`shrink-0 ${isOrderFullySeparated(o) ? 'text-blue-400' : 'text-blue-500'}`} title={isOrderFullySeparated(o) ? "Totalmente Separado" : "Planejado para Hoje"} />}
                            <span className="truncate max-w-[200px] block" title={o.customerName}>{o.customerName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{o.city}</span></div></td>
                        <td className="p-4 text-xs text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><Truck size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{o.carrier}</span></div></td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-semibold text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-md">
                              {(o.items || []).length} un
                            </span>
                             {getMissingItemsCount(o) > 0 && <span className="text-[10px] font-semibold text-amber-400">({getMissingItemsCount(o)} falt.)</span>}
                             {!isOrderFullySeparated(o) && <AlertTriangle size={14} className="text-amber-500 shrink-0"/>}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                           <span className={`px-2 py-1 text-[10px] font-semibold rounded-md border uppercase ${getStatusColor(o.status)}`}>{getStatusLabel(o.status, o.requiresInvoice)}</span>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          {o.invoiceNumber ? <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-1 rounded-md">NF {o.invoiceNumber}</span> : <span className="text-slate-600">-</span>}
                        </td>
                     </tr>
                   ))}
                   {(activeTab === 'separation' ? separationOrders : dispatchOrders).length === 0 && (
                     <tr>
                       <td colSpan={6} className="py-20 text-center opacity-40">
                         <Package size={48} className="mx-auto mb-4 text-slate-500" />
                         <p className="text-sm font-semibold">Fila Vazia</p>
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
        </div>
      )}

      {selectedOrder && (activeTab === 'separation' || activeTab === 'dispatch' || activeTab === 'history') && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderId(null)} />
          <div className="relative w-full max-w-4xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
             {renderOrderDetail(selectedOrder)}
          </div>
        </div>
      )}

      {activeTab === 'preparation' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Sub-tabs de Preparação */}
          <div className="flex flex-wrap gap-2 no-print bg-slate-800 p-2 rounded-2xl border border-slate-700 w-fit">
            {[
              { id: 'kits', label: 'Kits', icon: <Box size={14} />, count: metrics.pendingKits },
              { id: 'looseParts', label: 'Peças Avulsas', icon: <Settings2 size={14} />, count: metrics.pendingLooseParts },
              { id: 'repairs', label: 'Reparos', icon: <Wrench size={14} />, count: metrics.pendingRepairs }
            ].map(sub => (
              <button 
                key={sub.id} 
                onClick={() => setPreparationSubTab(sub.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${preparationSubTab === sub.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
               aria-label="Botão">
                {sub.icon} {sub.label} ({sub.count})
              </button>
            ))}
          </div>

          {preparationSubTab === 'kits' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Box size={14} /> Fila de Preparação de Kits (Pedidos em Separação)
                </h3>
                <button 
                  onClick={() => setShowManualKitModal(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl border border-slate-700 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                  aria-label="Gestão de Saldo"
                >
                  <RefreshCcw size={14} className="text-orange-400" /> Gestão de Saldo
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {groupedKitData.queue.map((kq, idx) => {
                  return (
                  <div key={idx} className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-700 shadow-sm transition-all flex flex-col justify-between h-full">
                    <div>
                       <div className="flex justify-between items-start mb-4">
                          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-lg">
                             <span className="block font-black text-2xl italic leading-none tracking-tighter">KIT {kq.kit}</span>
                          </div>
                           <div className="text-right">
                             <span className="block text-2xl font-black text-white tracking-tighter">{kq.totalUnits}</span>
                             <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">UNIDADES TOTAIS</span>
                          </div>
                       </div>

                       {!kq.isAllReady && (
                         <div className="flex flex-col gap-2 mb-4">
                           <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                             <div className="flex gap-4">
                               <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Estoque Kit</span>
                                 <span className="text-sm font-black text-white">{kq.currentStock}</span>
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Faltam</span>
                                 <span className={`text-sm font-black ${kq.deficit > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{kq.deficit}</span>
                               </div>
                             </div>
                           </div>
                         </div>
                       )}

                       <div className="space-y-3 mb-6">
                          {(kq.orders as any[]).map(orderGroup => (
                             <div key={orderGroup.orderId} className={`flex justify-between items-center p-3 rounded-2xl border ${orderGroup.isSelectedForToday ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-slate-900/50 border-slate-700/50'}`}>
                                <div className="overflow-hidden">
                                   <div className="flex items-center gap-1.5">
                                     <span className={`block font-black text-[10px] uppercase italic truncate ${orderGroup.isSelectedForToday ? 'text-blue-400' : 'text-slate-300'}`}>{orderGroup.customer}</span>
                                     {orderGroup.isSelectedForToday && <Calendar size={10} className="text-blue-400 shrink-0" title="Despacho Hoje" />}
                                   </div>
                                   <span className="block text-[10px] font-black text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md uppercase mt-1 w-fit">{(orderGroup.items || []).length} UN</span>
                                </div>
                                <button 
                                  onClick={() => {
                                     const pendingIds = (orderGroup.items || [])
                                       .filter((i: any) => !i.isKitPrepared && !i.isKitConfirmed)
                                       .map((i: any) => i.id);
                                     handlePrepareKitStock(orderGroup.orderId, pendingIds, kq.kit, orderGroup.items[0]?.model || 'Geral');
                                  }}
                                  disabled={(orderGroup.items || []).every((i: any) => i.isKitPrepared || i.isKitConfirmed)}
                                  className="bg-slate-800 hover:bg-slate-700 disabled:hover:bg-slate-800 text-white disabled:text-slate-500 border border-slate-600 disabled:border-slate-700 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center gap-1.5"
                                  aria-label="Adicionar Kit ao Estoque"
                                  title="Adicionar quantidade deste kit ao estoque"
                                >
                                  <Plus size={12} /> Estoque
                                </button>
                             </div>
                          ))}
                       </div>

                       <button onClick={() => setViewingKitImage(kq.kit)} className="text-slate-400 hover:text-white flex items-center gap-1.5 w-fit ml-2" aria-label="Foto de Referência">
                         <Eye size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Foto de Referência</span>
                       </button>
                    </div>
                  </div>
                )})}
                {groupedKitData.queue.length === 0 && (
                  <div className="col-span-full py-20 text-center border-4 border-dashed rounded-2xl opacity-20">
                     <Package size={48} className="mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase">Nenhum kit pendente nos pedidos em separação</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {preparationSubTab === 'looseParts' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                <Settings2 size={14} /> Fila de Peças Avulsas (Pedidos em Separação)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loosePartsData.queue.map((lp, idx) => (
                  <div key={idx} className={`bg-slate-800 p-8 rounded-2xl border-2 shadow-sm transition-all flex flex-col justify-between h-full ${lp.isAllReady ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700'}`}>
                    <div>
                       <div className="flex justify-between items-start mb-4">
                          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-lg">
                             <span className="block font-black text-lg italic leading-none tracking-tighter uppercase">{lp.model}</span>
                          </div>
                          <div className="text-right">
                             <span className="prep-total-badge block text-2xl font-black text-white tracking-tighter bg-black px-3 py-1 rounded-lg inline-block">{lp.totalUnits}</span>
                             <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">UNIDADES TOTAIS</span>
                          </div>
                       </div>

                       <div className="space-y-3 mb-6">
                          {lp.orders.map(orderGroup => (
                             <div key={orderGroup.orderId} className={`flex justify-between items-center p-3 rounded-2xl border ${orderGroup.isSelectedForToday ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-slate-900/50 border-slate-700/50'}`}>
                                <div className="overflow-hidden">
                                   <div className="flex items-center gap-1.5">
                                     <span className={`block font-black text-[10px] uppercase italic truncate ${orderGroup.isSelectedForToday ? 'text-blue-400' : 'text-slate-300'}`}>{orderGroup.customer}</span>
                                     {orderGroup.isSelectedForToday && <Calendar size={10} className="text-blue-400 shrink-0" />}
                                   </div>
                                   <span className="block text-[10px] font-black text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md uppercase mt-1 w-fit">{(orderGroup.items || []).length} UN</span>
                                </div>
                                {orderGroup.isReady ? (
                                   <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                                ) : (
                                   <button 
                                     onClick={() => onMarkGroupCollected(orderGroup.orderId, (orderGroup.items || []).map(i => i.id))}
                                     className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all"
                                    aria-label="Coletar">
                                     Coletar
                                   </button>
                                )}
                             </div>
                          ))}
                       </div>
                    </div>
                    
                    <button 
                      onClick={() => handlePrintLoosePart(lp)}
                      className="w-full py-3 mt-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                     aria-label="Imprimir Etiqueta">
                      <Printer size={14} /> Imprimir Etiqueta
                    </button>
                    
                    {lp.isAllReady && (
                      <div className="w-full py-4 mt-6 rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-md animate-in zoom-in-95">
                        <Check size={16} strokeWidth={4} />
                        <span className="font-black uppercase text-[10px] tracking-widest">TODAS COLETADAS</span>
                      </div>
                    )}
                  </div>
                ))}
                {loosePartsData.queue.length === 0 && (
                  <div className="col-span-full py-20 text-center border-4 border-dashed rounded-2xl opacity-20">
                     <ClipboardList size={48} className="mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase">Nenhuma peça avulsa pendente</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {preparationSubTab === 'repairs' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                <Wrench size={14} /> Fila de Reparos (Pedidos em Separação)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {repairsData.queue.map((rp, idx) => (
                  <div key={idx} className={`bg-slate-800 p-8 rounded-2xl border-2 shadow-sm transition-all flex flex-col justify-between h-full ${rp.isAllReady ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700'}`}>
                    <div>
                       <div className="flex justify-between items-start mb-4">
                          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-lg">
                             <span className="block font-black text-lg italic leading-none tracking-tighter uppercase">{rp.model}</span>
                          </div>
                          <div className="text-right">
                             <span className="prep-total-badge block text-2xl font-black text-white tracking-tighter bg-black px-3 py-1 rounded-lg inline-block">{rp.totalUnits}</span>
                             <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">UNIDADES TOTAIS</span>
                          </div>
                       </div>

                       <div className="space-y-3 mb-6">
                          {rp.orders.map(orderGroup => (
                             <div key={orderGroup.orderId} className={`flex justify-between items-center p-3 rounded-2xl border ${orderGroup.isSelectedForToday ? 'bg-blue-900/20 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-slate-900/50 border-slate-700/50'}`}>
                                <div className="overflow-hidden">
                                   <div className="flex items-center gap-1.5">
                                     <span className={`block font-black text-[10px] uppercase italic truncate ${orderGroup.isSelectedForToday ? 'text-blue-400' : 'text-slate-300'}`}>{orderGroup.customer}</span>
                                     {orderGroup.isSelectedForToday && <Calendar size={10} className="text-blue-400 shrink-0" />}
                                   </div>
                                   <span className="block text-[10px] font-black text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md uppercase mt-1 w-fit">{(orderGroup.items || []).length} UN</span>
                                 </div>
                                 {orderGroup.isReady ? (
                                    <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                                 ) : (
                                    <button 
                                      onClick={() => onMarkGroupCollected(orderGroup.orderId, (orderGroup.items || []).map(i => i.id))}
                                      className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all"
                                     aria-label="Coletar">
                                      Coletar
                                    </button>
                                 )}
                             </div>
                          ))}
                       </div>
                    </div>
                    
                    {rp.isAllReady && (
                      <div className="w-full py-4 mt-6 rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-md animate-in zoom-in-95">
                        <Check size={16} strokeWidth={4} />
                        <span className="font-black uppercase text-[10px] tracking-widest">TODOS COLETADOS</span>
                      </div>
                    )}
                  </div>
                ))}
                {repairsData.queue.length === 0 && (
                  <div className="col-span-full py-20 text-center border-4 border-dashed rounded-2xl opacity-20">
                     <Wrench size={48} className="mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase">Nenhum reparo pendente</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <span className="text-sm font-semibold text-slate-300">Data de Despacho</span>
              <input 
                type="date" 
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
              />
           </div>
           <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-4">Data de Despacho</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4 hidden md:table-cell">Cidade</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 hidden sm:table-cell">NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {historyOrders.map(o => (
                      <tr 
                        key={o.id} 
                        onClick={() => setSelectedOrderId(o.id)} 
                        className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${selectedOrderId === o.id ? 'bg-slate-700' : ''}`}
                      >
                        <td className="p-4 text-xs text-slate-300 whitespace-nowrap">{safeFormatDate(o.dispatchedAt)}</td>
                        <td className="p-4 font-semibold text-white whitespace-nowrap">
                          <span className="truncate max-w-[200px] block" title={o.customerName}>{o.customerName}</span>
                        </td>
                        <td className="p-4 text-xs text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{o.city}</span></div></td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">CONCLUÍDO</span>
                        </td>
                        <td className="p-4 hidden sm:table-cell whitespace-nowrap">
                          {o.invoiceNumber ? <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-1 rounded-md">NF {o.invoiceNumber}</span> : <span className="text-slate-600">-</span>}
                        </td>
                      </tr>
                    ))}
                    {historyOrders.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-20 text-center opacity-40">
                           <History size={48} className="mx-auto mb-4 text-slate-500" />
                           <p className="text-sm font-semibold">Nenhum histórico disponível para esta data</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button onClick={() => setInventorySubTab('servos')} className={`px-6 py-3 rounded-xl font-semibold uppercase text-[10px] tracking-widest transition-all ${inventorySubTab === 'servos' ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} aria-label="Servos em Estoque">Servos em Estoque</button>
            <button onClick={() => setInventorySubTab('kits')} className={`px-6 py-3 rounded-xl font-semibold uppercase text-[10px] tracking-widest transition-all ${inventorySubTab === 'kits' ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} aria-label="Kits em Estoque">Kits em Estoque</button>
          </div>
          
          {inventorySubTab === 'servos' && (
             <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Modelo</th>
                        <th className="p-4">Orientação</th>
                        <th className="p-4 text-center">Quantidade</th>
                        <th className="p-4 w-[50%]">Números de Garantia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {groupedInventory.map((group, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                          <td className="p-4 font-semibold text-white whitespace-nowrap">{group.model}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-[10px] font-semibold text-slate-300 bg-slate-900/50 border border-slate-700 px-2 py-0.5 rounded-md uppercase">{group.orientation}</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-semibold text-white bg-slate-900 px-3 py-1 rounded-md shadow-inner">{group.units.length}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                              {group.units.sort((a,b) => parseInt(a.guaranteeNumber) - parseInt(b.guaranteeNumber)).map(unit => (
                                <span key={unit.id} className="font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded-md text-slate-400 hover:text-white transition-colors cursor-default">A{unit.guaranteeNumber}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {groupedInventory.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-20 text-center opacity-40">
                             <Warehouse size={48} className="mx-auto mb-4 text-slate-500" />
                             <p className="text-sm font-semibold">Estoque de Servos Vazio</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {inventorySubTab === 'kits' && (
             <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Lente</th>
                        <th className="p-4">Kit</th>
                        <th className="p-4">Modelo</th>
                        <th className="p-4 text-center">Quantidade</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {groupedKits.map(kit => (
                        <tr key={`${kit.model}-${kit.name}`} className="hover:bg-slate-700/50 transition-colors">
                          <td className="p-4">
                            <button 
                              onClick={() => setViewingKitImage(kit.name.replace('Kit ', ''))}
                              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all flex items-center justify-center shadow-sm"
                              title="Ver Foto de Referência"
                             aria-label="Ver Foto de Referência">
                              <Eye size={16} />
                            </button>
                          </td>
                          <td className="p-4 font-semibold text-white whitespace-nowrap">{kit.name}</td>
                          <td className="p-4 text-slate-300 text-sm whitespace-nowrap">{kit.model}</td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-semibold text-white bg-slate-900 px-4 py-1.5 rounded-md shadow-inner">{kit.totalQuantity}</span>
                          </td>
                          <td className="p-4 text-right">
                            {onDeleteKitGroup && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Tem certeza que deseja remover todos os kits ${kit.name} (${kit.model}) do estoque?`)) {
                                    onDeleteKitGroup(kit.model, kit.name);
                                  }
                                }}
                                className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm"
                                title="Remover do Estoque"
                               aria-label="Remover do Estoque">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {groupedKits.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-20 text-center opacity-40">
                             <Box size={48} className="mx-auto mb-4 text-slate-500" />
                             <p className="text-sm font-semibold">Nenhum Kit em Estoque</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </div>
      )}

      {(viewingKitImage) && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300" role="dialog" aria-modal="true">
           <div className="absolute inset-0 cursor-zoom-out" onClick={() => { setViewingKitImage(null); setZoomScale(1); }} />
           
           <div className="relative w-[95vw] h-[95vh] flex flex-col items-center justify-center overflow-hidden">
              {/* Header Flutuante */}
              <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
                 <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 pointer-events-auto">
                    <h4 className="font-black uppercase italic tracking-tighter text-white text-lg leading-none">
                      {'Referência do Kit'}
                    </h4>
                 </div>
                 <button 
                   onClick={() => { setViewingKitImage(null); setZoomScale(1); }} 
                   className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-2xl border border-white/10 transition-all pointer-events-auto"
                  aria-label="Botão">
                   <X size={24} />
                 </button>
              </div>

              {/* Controles de Zoom */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
                 <button onClick={() => setZoomScale(s => Math.min(s + 0.5, 4))} className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all" aria-label="Botão"><Plus size={20}/></button>
                 <button onClick={() => setZoomScale(1)} className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all text-[10px] font-black" aria-label="1x">1x</button>
                 <button onClick={() => setZoomScale(s => Math.max(s - 0.5, 0.5))} className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all" aria-label="Botão"><Minus size={20}/></button>
              </div>
              
              <div className="w-full h-full flex items-center justify-center overflow-auto p-10">
                 {kitImages.find(img => img.id === viewingKitImage?.replace(/^KIT\s+/i, '').trim()) ? (
                   <img 
                     src={kitImages.find(img => img.id === viewingKitImage?.replace(/^KIT\s+/i, '').trim())?.data} 
                     className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out shadow-2xl rounded-lg"
                     style={{ transform: `scale(${zoomScale})` }}
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center text-white/20">
                      <ImageIcon size={120} />
                      <p className="text-sm font-black uppercase mt-6 tracking-widest">Nenhuma imagem cadastrada</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {currentBatchGroup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setBatchSelectingFor(null)} />
          <div className="relative bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Vincular Garantias</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    Modelo: {currentBatchGroup.model} | Ori: {currentBatchGroup.orientation}
                  </p>
               </div>
               <button onClick={() => setBatchSelectingFor(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all" aria-label="Botão"><X size={18} /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-8">
               {/* Séries já vinculadas */}
               {(currentBatchGroup.items || []).some((i: any) => i.guaranteeNumber) && (
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <CheckCircle2 size={14} className="text-emerald-500" /> Séries Vinculadas
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                       {(currentBatchGroup.items || []).filter((i: any) => i.guaranteeNumber).map((item: any) => (
                         <div key={item.id} className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 flex flex-col items-center relative group">
                            <span className="font-mono font-black text-lg italic text-emerald-700">A{item.guaranteeNumber}</span>
                            <button 
                              onClick={() => handleUnassignItem(item.id, item.guaranteeNumber)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                              title="Desvincular"
                             aria-label="Desvincular">
                               <X size={12} strokeWidth={4} />
                            </button>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Warehouse size={14} /> Disponível em Estoque
                  </h4>
                  <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-700 shadow-inner">
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black text-slate-300 uppercase">Necessário: {(currentBatchGroup.items || []).filter((i:any) => !i.guaranteeNumber).length} unidades</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase">Selecionado: {selectedSeriesForBatch.length}</span>
                     </div>
                     <button 
                       onClick={() => {
                         const needed = (currentBatchGroup.items || []).filter((i:any) => !i.guaranteeNumber).length;
                         const toSelect = filteredStock.slice(0, needed).map(u => u.guaranteeNumber);
                         setSelectedSeriesForBatch(toSelect);
                       }}
                       className="bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-600 transition-all shadow-md active:scale-95 flex items-center gap-2"
                      aria-label="Auto-Selecionar">
                       <CheckSquare size={14} /> Auto-Selecionar
                     </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {filteredStock.length === 0 ? (
                       <div className="col-span-full py-10 text-center opacity-30">
                          <AlertTriangle size={32} className="mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase">Sem estoque disponível deste modelo</p>
                       </div>
                     ) : filteredStock.map(unit => (
                       <button 
                         key={unit.id}
                         onClick={() => {
                           const isSelected = selectedSeriesForBatch.includes(unit.guaranteeNumber);
                           if (isSelected) {
                             setSelectedSeriesForBatch(selectedSeriesForBatch.filter(s => s !== unit.guaranteeNumber));
                           } else if (selectedSeriesForBatch.length < (currentBatchGroup.items || []).filter((i:any) => !i.guaranteeNumber).length) {
                             setSelectedSeriesForBatch([...selectedSeriesForBatch, unit.guaranteeNumber]);
                           }
                         }}
                         className={`p-4 rounded-2xl border-2 flex flex-col items-center transition-all ${
                           selectedSeriesForBatch.includes(unit.guaranteeNumber)
                             ? 'border-slate-400 bg-slate-700 text-white shadow-md scale-[1.05]'
                             : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500'
                         }`}
                        aria-label="Botão">
                          <span className="font-mono font-black text-lg italic text-white">A{unit.guaranteeNumber}</span>
                          <span className="text-[7px] font-bold uppercase mt-1 opacity-60">{unit.assembler}</span>
                       </button>
                     ))}
                  </div>
               </div>
            </div>
            
            <div className="p-6 bg-slate-900 border-t border-slate-700 flex justify-end gap-4 shrink-0">
               <button onClick={() => setBatchSelectingFor(null)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900" aria-label="Cancelar">Cancelar</button>
               <button 
                 onClick={handleConfirmBatch}
                 disabled={selectedSeriesForBatch.length === 0}
                 className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-20 transition-all hover:scale-105 active:scale-95"
                aria-label="Confirmar Vínculo">
                 Confirmar Vínculo
               </button>
            </div>
          </div>
        </div>
      )}

      {currentPrintGroup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPrintingBatchFor(null)} />
          <div className="relative bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Imprimir Etiquetas</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    Modelo: {currentPrintGroup.model} | Ori: {currentPrintGroup.orientation}
                  </p>
               </div>
               <button onClick={() => setPrintingBatchFor(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all" aria-label="Botão"><X size={18} /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
               <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <Printer size={14} className="text-emerald-500" /> Selecione as séries para imprimir
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {(currentPrintGroup.items || []).filter((i: any) => i.guaranteeNumber).map((item: any) => (
                       <button 
                         key={item.id}
                         onClick={() => {
                           if (selectedSeriesForPrint.includes(item.guaranteeNumber!)) {
                             setSelectedSeriesForPrint(prev => prev.filter(sn => sn !== item.guaranteeNumber!));
                           } else {
                             setSelectedSeriesForPrint(prev => [...prev, item.guaranteeNumber!]);
                           }
                         }}
                         className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedSeriesForPrint.includes(item.guaranteeNumber!) ? 'bg-emerald-500/10 border-emerald-500 shadow-lg scale-105' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                        aria-label="Botão">
                         <span className={`block text-xs font-black uppercase mb-1 ${selectedSeriesForPrint.includes(item.guaranteeNumber!) ? 'text-emerald-400' : 'text-slate-400'}`}>A{item.guaranteeNumber}</span>
                       </button>
                     ))}
                     {(currentPrintGroup.items || []).filter((i: any) => i.guaranteeNumber).length === 0 && (
                       <div className="col-span-full text-center py-10 border-2 border-dashed border-slate-700 rounded-2xl opacity-50">
                          <p className="text-xs font-black text-slate-400 uppercase">Nenhuma série vinculada</p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
            
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-between items-center shrink-0">
               <span className="text-[10px] font-black text-slate-400 uppercase">
                 {selectedSeriesForPrint.length} selecionadas
               </span>
               <div className="flex gap-2">
                 <button 
                   onClick={() => setSelectedSeriesForPrint((currentPrintGroup.items || []).filter((i: any) => i.guaranteeNumber).map((i: any) => i.guaranteeNumber!))}
                   className="px-6 py-3 bg-slate-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-600 transition-all"
                  aria-label="Selecionar Todas">
                   Selecionar Todas
                 </button>
                 <button 
                   onClick={handlePrintBatch}
                   disabled={selectedSeriesForPrint.length === 0}
                   className="px-10 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-20 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 flex items-center gap-2"
                  aria-label="Imprimir">
                   <Printer size={14}/> Imprimir
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {undoAction && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-4 bg-slate-900 border border-slate-700 px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-l-4 border-l-orange-500"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{undoAction.previousStatus === OrderStatus.READY ? "Pedido Despachado" : "Pedido Liberado"}</span>
              <span className="text-sm font-bold text-white">{undoAction.customerName}</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-700 mx-2" />
            <button 
              onClick={async () => {
                if (onUpdateStatus) {
                  await onUpdateStatus(undoAction.orderId, undoAction.previousStatus);
                  toast.success(undoAction.previousStatus === OrderStatus.READY ? "Despacho desfeito com sucesso!" : "Liberação desfeita com sucesso!");
                  setUndoAction(null);
                }
              }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
             aria-label="Desfazer">
              <History size={14} /> Desfazer
            </button>
            <button 
              onClick={() => setUndoAction(null)}
              className="p-2 text-slate-500 hover:text-white transition-colors"
             aria-label="Botão">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {dispatchConfirmModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setDispatchConfirmModal(null)} />
          <div className="relative bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-700 animate-in zoom-in-95">
             <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                   {dispatchConfirmModal.status === OrderStatus.READY ? <Truck size={40} /> : <FileText size={40} />}
                </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-white uppercase italic tracking-tight">
                     {dispatchConfirmModal.status === OrderStatus.READY ? "Confirmar Despacho?" : (dispatchConfirmModal.requiresInvoice === false ? "Liberar para Saída?" : "Liberar para Faturamento?")}
                   </h3>
                   <p className="text-sm text-slate-400 font-medium">
                      {dispatchConfirmModal.status === OrderStatus.READY ? "Você está prestes a despachar o pedido de " : (dispatchConfirmModal.requiresInvoice === false ? "Você está prestes a liberar para saída o pedido de " : "Você está prestes a liberar para faturamento o pedido de ")}<span className="text-white font-bold">{dispatchConfirmModal.customerName}</span>.
                   </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                   <div className="text-center">
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Peso</span>
                      <span className="text-lg font-black text-white">{weight || dispatchConfirmModal.weight || '0'}kg</span>
                   </div>
                   <div className="text-center">
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Volumes</span>
                      <span className="text-lg font-black text-white">{volume || dispatchConfirmModal.volume || '1'}</span>
                   </div>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                   <button 
                     onClick={handleFinalDispatch}
                     className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95"
                    aria-label="Botão">
                     {dispatchConfirmModal.status === OrderStatus.READY ? "Confirmar e Finalizar" : "Confirmar Liberação"}
                   </button>
                   <button 
                     onClick={() => setDispatchConfirmModal(null)}
                     className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                    aria-label="Voltar e Revisar">
                     Voltar e Revisar
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {false && kitConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setKitConfirmModal(null)} />
          <div className="relative bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Conferir Kit de Instalação</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    Kit: {kitConfirmModal.kitName}
                  </p>
               </div>
               <button onClick={() => setKitConfirmModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all" aria-label="Botão"><X size={18} /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                 {(() => {
                   const subKits = normalizeKitName(kitConfirmModal.kitName).split('/').map(s => s.trim());
                   const needed = kitConfirmModal.itemIds.length;

                   return (
                     <>
                       {subKits.map((sub, idx) => {
                         const kitNamePrefix = safeToUpper(sub).startsWith('KIT') ? sub : `KIT ${sub}`;
                         const code = safeToUpper(normalizeKitName(kitNamePrefix));
                         let available = 0;
                         kits.forEach(k => {
                            if (safeToUpper(normalizeKitName(k.name)) === code || safeToUpper(normalizeKitName(`KIT ${k.name}`)) === code) {
                               available += k.quantity;
                            }
                         });
                         const deficit = Math.max(0, needed - available);

                         return (
                            <div key={idx} className="bg-slate-900 p-4 border border-slate-700 rounded-xl shadow-inner">
                              <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                 <h4 className="font-black text-sm uppercase text-white">{kitNamePrefix}</h4>
                                 <button onClick={() => setViewingKitImage(kitNamePrefix)} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded" aria-label="Ver Foto">
                                    <Eye size={12}/> <span className="text-[8px] font-black uppercase tracking-widest">Ver Foto</span>
                                 </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                 <div className="bg-slate-800/80 rounded border border-slate-700 p-2">
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Necessário</span>
                                    <span className="text-lg font-black text-white">{needed}</span>
                                 </div>
                                 <div className="bg-slate-800/80 rounded border border-slate-700 p-2">
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Em Estoque</span>
                                    <span className={`text-lg font-black ${available >= needed ? 'text-emerald-400' : 'text-slate-300'}`}>{available}</span>
                                 </div>
                                 <div className={`bg-slate-800/80 rounded border p-2 ${deficit > 0 ? 'border-orange-500/50' : 'border-slate-700'}`}>
                                    <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Montar Agora</span>
                                    <span className={`text-lg font-black ${deficit > 0 ? 'text-orange-400' : 'text-slate-500'}`}>{deficit > 0 ? deficit : 0}</span>
                                 </div>
                              </div>
                              {deficit > 0 && (
                                <p className="text-[9px] font-black tracking-widest text-orange-400 mt-4 text-center uppercase flex items-center justify-center gap-1">
                                   <Package size={12} /> É necessário montar {deficit} un.
                                </p>
                              )}
                            </div>
                         )
                       })}

                       <div className="bg-slate-900 p-6 border border-slate-700 rounded-xl shadow-inner mt-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">
                             Quantidade a Conferir / Dar Baixa (Max: {needed})
                          </label>
                          <input 
                             type="number" 
                             min={1} 
                             max={needed} 
                             value={kitConfirmQty}
                             onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') { setKitConfirmQty(''); return; }
                                const num = parseInt(val, 10);
                                if (num > needed) setKitConfirmQty(needed);
                                else if (num < 1) setKitConfirmQty(1);
                                else setKitConfirmQty(num);
                             }}
                             className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-black text-xl text-center focus:border-emerald-500 focus:outline-none transition-all"
                             placeholder={needed.toString()}
                          />
                       </div>
                     </>
                   );
                 })()}
            </div>
            
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end items-center shrink-0">
                 <button 
                   onClick={() => {
                     const qtyToConfirm = kitConfirmQty === '' ? kitConfirmModal.itemIds.length : (kitConfirmQty as number);
                     onToggleGroupKit(kitConfirmModal.orderId, kitConfirmModal.itemIds.slice(0, qtyToConfirm));
                     setKitConfirmModal(null);
                   }}
                   className="px-10 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] active:scale-95 flex items-center gap-2"
                  aria-label="Dar Conferido">
                   <Check size={14}/> Dar Conferido
                 </button>
            </div>
          </div>
        </div>
      )}

      {showManualKitModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowManualKitModal(false)} />
          <div className="relative bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg"><RefreshCcw size={20} /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Gestão de Saldo de Kits</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajuste Manual de Estoque</p>
                  </div>
               </div>
               <button onClick={() => setShowManualKitModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={18} /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="flex p-1 bg-slate-900 rounded-xl">
                 <button 
                  onClick={() => setManualKitAction('ADD')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${manualKitAction === 'ADD' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   <Plus size={14} className="inline mr-2" /> Entrada
                 </button>
                 <button 
                  onClick={() => setManualKitAction('REMOVE')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${manualKitAction === 'REMOVE' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   <Minus size={14} className="inline mr-2" /> Baixa
                 </button>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Escolha o Kit</label>
                <select 
                  value={manualKitCode}
                  onChange={(e) => setManualKitCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-xs focus:border-orange-500 outline-none"
                >
                  <option value="">Selecione um Kit...</option>
                  {[...new Set(kits.map(k => normalizeKitName(k.name).toUpperCase()))].sort().map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Quantidade</label>
                  <input 
                    type="number"
                    value={manualKitQty}
                    onChange={(e) => setManualKitQty(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-black text-lg focus:border-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2">Modelo Ref.</label>
                  <input 
                    type="text"
                    value={manualKitModel}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 font-bold text-xs focus:border-orange-500 outline-none cursor-not-allowed"
                    placeholder="Auto-preenchido"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end shrink-0">
              <button 
                onClick={async () => {
                  if (!manualKitCode || !manualKitQty) {
                    toast.error("Campos Obrigatórios", { description: "Informe o Kit e a Quantidade." });
                    return;
                  }
                  setIsProcessingManualKit(true);
                  try {
                    await onAdjustKitStock({
                      code: manualKitCode,
                      quantity: manualKitAction === 'ADD' ? (manualKitQty as number) : -(manualKitQty as number),
                      model: manualKitModel,
                      observation: ''
                    });
                    setShowManualKitModal(false);
                    setManualKitCode('');
                    setManualKitQty('');
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsProcessingManualKit(false);
                  }
                }}
                disabled={isProcessingManualKit}
                className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${manualKitAction === 'ADD' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white`}
              >
                {isProcessingManualKit ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Check size={16} /> Confirmar {manualKitAction === 'ADD' ? 'Entrada' : 'Baixa'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
    </>
  );
};

export default ExpeditionView;
