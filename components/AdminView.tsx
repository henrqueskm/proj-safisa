import { safeFormatDate, safeToUpper } from '../lib/utils';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, OrderStatus, AssembledUnit, Customer, OrderItem, OrderItemType, ServoOrientation, KitImage, Kit, KitData, ServoModelData, AuditLog } from '../types';
import { SERVO_BASE_MODELS, SERVO_KITS, REPAIR_MODELS, REPRESENTATIVES, CARRIERS, STATUS_COLORS, STATUS_LABELS, getMissingItemsCount, normalizeModelName, normalizeKitName, isOrderFullySeparated, getStatusLabel, getStatusColor } from '../constants';
import { Sidebar } from './Sidebar';
import { 
  Plus, Trash2, Search, X, MapPin, Calendar, Layers, LayoutDashboard, 
  Users, Warehouse, History, Settings, RefreshCcw, UserCircle, 
  AlertTriangle, Box, Image as ImageIcon, Trash, Package, Wrench, Settings2,
  FileText, Truck, CheckCircle2, TrendingUp, Filter, Eye, EyeOff, Pencil, Minus, Bell, Loader2, Camera, Barcode, ShieldCheck,
  Menu
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '../hooks/useAppContext';

interface AdminViewProps {
  orders: Order[];
  assembledUnits: AssembledUnit[];
  kits: Kit[];
  kitData: KitData[];
  servoModelData: ServoModelData[];
  customers: Customer[];
  kitImages: KitImage[];
  partRegistry: Record<string, any>;
  safisaIcon: string | null;
  addOrder: (order: Order) => void;
  deleteOrder: (id: string) => void;
  updateStatus: (id: string, status: OrderStatus, extra?: any) => void;
  currentSequence: number;
  passwords: Record<string, string>;
  updateConfig: (d: any) => void;
  setSequence: (v: number) => void;
  onSaveKitImage: (id: string, file: File) => Promise<void> | void;
  onDeleteKitImage: (id: string) => void;
  onSaveKitData: (kitData: KitData) => Promise<void>;
  onDeleteKitData: (id: string) => void;
  onSaveServoModelData: (servoModelData: ServoModelData) => Promise<void>;
  onDeleteServoModelData: (id: string) => void;
  onReconcile: () => Promise<void>;
  auditLogs: AuditLog[];
}

const AdminView: React.FC<AdminViewProps> = ({ 
  // Componente Administrativo - Atualizado para garantir a exibição de todos os itens
  orders, assembledUnits, kits, kitData, servoModelData, customers, kitImages, partRegistry, safisaIcon, addOrder, deleteOrder, 
  updateStatus, currentSequence, setSequence, passwords, updateConfig,
  onSaveKitImage, onDeleteKitImage, onSaveKitData, onDeleteKitData, onSaveServoModelData, onDeleteServoModelData, onReconcile, auditLogs
}) => {
  const { loadCompletedOrders, setLoadCompletedOrders } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'inventory' | 'history' | 'system' | 'audit'>('orders');
  
  useEffect(() => {
    if (activeTab === 'history' && setLoadCompletedOrders && !loadCompletedOrders) {
      setLoadCompletedOrders(true);
    }
  }, [activeTab, loadCompletedOrders, setLoadCompletedOrders]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inventorySubTab, setInventorySubTab] = useState<'servos' | 'kits'>('servos');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL' | 'PLANNED_TODAY'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(false);
  
  // Form States
  const [customerName, setCustomerName] = useState('');
  const [city, setCity] = useState('');
  const [representative, setRepresentative] = useState(REPRESENTATIVES[0]);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [customCarrier, setCustomCarrier] = useState('');
  const [customRepresentative, setCustomRepresentative] = useState('');
  const [negotiationNumber, setNegotiationNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [orderCreatedDate, setOrderCreatedDate] = useState('');
  const [observation, setObservation] = useState('');
  const [formItems, setFormItems] = useState<OrderItem[]>([]);
  
  // Item States
  const [selectedType, setSelectedType] = useState<OrderItemType>('SERVO');
  const [selectedModel, setSelectedModel] = useState(SERVO_BASE_MODELS[0]);
  const [customModel, setCustomModel] = useState('');
  const [selectedOrientation, setSelectedOrientation] = useState<ServoOrientation>('NORMAL');
  const [selectedKit, setSelectedKit] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [requiresInvoice, setRequiresInvoice] = useState(true);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [viewingKitImage, setViewingKitImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingInvoiceOrderId, setEditingInvoiceOrderId] = useState<string | null>(null);
  const [editingInvoiceValue, setEditingInvoiceValue] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [selectedRepresentative, setSelectedRepresentative] = useState<string | 'ALL'>('ALL');
  const [historyDate, setHistoryDate] = useState<string>(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );

  // Auto-fill logic
  useEffect(() => {
    const match = customers.find(c => safeToUpper(c.name) === safeToUpper(customerName));
    if (match) {
      setCity(match.city);
      setRepresentative(match.representative);
      setCarrier(match.carrier);
    }
  }, [customerName, customers]);

  // Reset model selection when type changes
  useEffect(() => {
    if (selectedType === 'SERVO') setSelectedModel(SERVO_BASE_MODELS[0]);
    else if (selectedType === 'REPAIR') setSelectedModel(REPAIR_MODELS[0]);
    else setCustomModel('');
  }, [selectedType]);

  // Reset kit selection when model changes
  useEffect(() => {
    setSelectedKit('SEM KIT');
  }, [selectedModel]);

  const query = safeToUpper(searchQuery).trim();

  // Metrics for Dashboard
  const metrics = useMemo(() => {
    const today = safeFormatDate(Date.now(), 'iso');
    return {
      awaitingInvoice: orders.filter(o => o.status === OrderStatus.AWAITING_INVOICE).length,
      awaitingExpedition: orders.filter(o => o.status === OrderStatus.AWAITING_EXPEDITION).length,
      awaitingReady: orders.filter(o => o.status === OrderStatus.READY).length,
      plannedToday: orders.filter(o => o.isSelectedForToday && (o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION)).length,
      stockTotal: assembledUnits.filter(u => !u.isAssigned).length,
      newToday: orders.filter(o => o.status !== OrderStatus.COMPLETED && safeFormatDate(o.createdAt, 'iso') === today).length,
      dispatchedToday: orders.filter(o => o.status === OrderStatus.COMPLETED && o.dispatchedAt && safeFormatDate(o.dispatchedAt, 'iso') === today).length,
      anomalous: orders.filter(o => !o.status || !Object.values(OrderStatus).includes(o.status as any)).length
    };
  }, [orders, assembledUnits]);

  // Deduplicated Unique Customers
  const uniqueCustomers = useMemo(() => {
    const uniqueMap = new Map<string, Customer>();
    customers.forEach(c => {
      const nameKey = safeToUpper(c.name).trim();
      
      const existing = uniqueMap.get(nameKey);
      if (!existing || c.lastPurchaseAt > existing.lastPurchaseAt) {
        uniqueMap.set(nameKey, c);
      }
    });
    return Array.from(uniqueMap.values());
  }, [customers, orders]);

  const uniqueRepresentatives = useMemo(() => {
    const reps = new Set<string>();
    orders.forEach(o => {
      if (o.representative) reps.add(safeToUpper(o.representative));
    });
    customers.forEach(c => {
      if (c.representative) reps.add(safeToUpper(c.representative));
    });
    return Array.from(reps).sort();
  }, [orders, customers]);

  const cityUfOptions = useMemo(() => {
    const citySet = new Set<string>();
    customers.forEach(c => {
      const cityValue = safeToUpper(c.city).trim();
      if (cityValue) citySet.add(cityValue);
    });
    orders.forEach(o => {
      const cityValue = safeToUpper(o.city).trim();
      if (cityValue) citySet.add(cityValue);
    });
    return Array.from(citySet).sort();
  }, [customers, orders]);

  const groupedKits = useMemo(() => {
    const groups: Record<string, Kit & { totalQuantity: number }> = {};
    kits.forEach(k => {
      if (k.quantity <= 0) return;
      const normalizedName = normalizeKitName(k.name);
      const normalizedModel = normalizeModelName(k.model);
      const key = `${normalizedModel}-${normalizedName}`;
      if (!groups[key]) {
        groups[key] = { ...k, model: normalizedModel, name: normalizedName, totalQuantity: k.quantity };
      } else {
        groups[key].totalQuantity += k.quantity;
      }
    });
    return Object.values(groups).sort((a, b) => a.model.localeCompare(b.model) || a.name.localeCompare(b.name));
  }, [kits]);

  const filteredOrders = useMemo(() => 
    orders.filter(o => {
      const matchesSearch = 
        safeToUpper(o.customerName).includes(query) || 
        safeToUpper(o.city).includes(query) ||
        safeToUpper(o.negotiationNumber).includes(query) ||
        (o.invoiceNumber && safeToUpper(o.invoiceNumber).includes(query)) ||
        safeFormatDate(o.createdAt).includes(query) ||
        (o.dispatchedAt && safeFormatDate(o.dispatchedAt).includes(query)) ||
        (o.items || []).some((i: any) => safeToUpper(i.guaranteeNumber).includes(query));
      
      if (statusFilter === 'PLANNED_TODAY') {
        return o.isSelectedForToday && (o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION) && matchesSearch;
      }
      if ((statusFilter as string) === 'ANOMALOUS') {
        return (!o.status || !Object.values(OrderStatus).includes(o.status as any)) && matchesSearch;
      }
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
      return o.status !== OrderStatus.COMPLETED && matchesSearch && matchesStatus;
    }),
  [orders, query, statusFilter]);

  const filteredHistory = useMemo(() => 
    orders.filter(o => {
      const matchesSearch = 
        safeToUpper(o.customerName).includes(query) || 
        safeToUpper(o.city).includes(query) ||
        safeToUpper(o.negotiationNumber).includes(query) ||
        (o.invoiceNumber && safeToUpper(o.invoiceNumber).includes(query)) ||
        safeFormatDate(o.createdAt).includes(query) ||
        (o.dispatchedAt && safeFormatDate(o.dispatchedAt).includes(query)) ||
        (o.items || []).some((i: any) => safeToUpper(i.guaranteeNumber).includes(query));
      
      const isCompleted = o.status === OrderStatus.COMPLETED;
      if (!isCompleted) return false;
      
      if (historyDate && !query) {
        if (!o.dispatchedAt) return false;
        const orderDate = safeFormatDate(o.dispatchedAt, 'iso');
        if (orderDate !== historyDate) return false;
      }
      
      return matchesSearch;
    })
    .sort((a,b) => (b.dispatchedAt || 0) - (a.dispatchedAt || 0)),
  [orders, query, historyDate]);

  const filteredCustomersList = useMemo(() => {
    return uniqueCustomers.filter(c => {
      const matchesName = safeToUpper(c.name).includes(query);
      if (matchesName) return true;

      const customerOrders = orders.filter(o => safeToUpper(o.customerName) === safeToUpper(c.name));
      return customerOrders.some(o => 
        safeToUpper(o.negotiationNumber).includes(query) ||
        (o.items || []).some((i: any) => safeToUpper(i.guaranteeNumber).includes(query))
      );
    }).sort((a,b) => a.name.localeCompare(b.name)).map(c => {
      const customerOrders = orders.filter(o => safeToUpper(o.customerName) === safeToUpper(c.name));
      const totalOrders = customerOrders.length;
      const totalItems = customerOrders.reduce((acc, o) => acc + (o.items || []).length, 0);
      
      const modelCounts: Record<string, number> = {};
      customerOrders.forEach(o => {
        (o.items || []).forEach(i => {
          modelCounts[i.model] = (modelCounts[i.model] || 0) + 1;
        });
      });
      
      let favoriteModel = 'N/A';
      let maxCount = 0;
      Object.entries(modelCounts).forEach(([model, count]) => {
        if (count > maxCount) {
          maxCount = count;
          favoriteModel = model;
        }
      });

      return {
        ...c,
        behavior: {
          totalOrders,
          totalItems,
          favoriteModel,
          avgItemsPerOrder: totalOrders > 0 ? (totalItems / totalOrders).toFixed(1) : '0'
        }
      };
    });
  }, [uniqueCustomers, query, orders]);

  const groupedInventory = useMemo(() => {
    const groups: Record<string, { model: string; orientation: string; units: AssembledUnit[] }> = {};
    assembledUnits.filter(u => !u.isAssigned).forEach(u => {
      const ori = u.orientation || 'NORMAL';
      const normModel = normalizeModelName(u.model);
      const key = `${normModel}-${ori}`;
      if (!groups[key]) groups[key] = { model: normModel, orientation: ori, units: [] };
      groups[key].units.push(u);
    });
    return Object.values(groups).sort((a, b) => a.model.localeCompare(b.model));
  }, [assembledUnits]);

  const groupedItems = (items: OrderItem[]) => {
    if (!items) return [];
    const groups: Record<string, { model: string; kit: string; type: OrderItemType; orientation: string; count: number; items: OrderItem[] }> = {};
    (items || []).forEach(item => {
      const kit = item.installationKit || 'SEM KIT';
      const ori = item.orientation || '---';
      const key = `${item.model}-${kit}-${item.type}-${ori}`;
      if (!groups[key]) groups[key] = { model: item.model, kit, type: item.type, orientation: ori, count: 0, items: [] };
      groups[key].count++;
      groups[key].items.push(item);
    });
    return Object.values(groups);
  };

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const dateInputToTimestamp = (dateValue: string, fallback: number) => {
    const [year, month, day] = dateValue.split('-').map(Number);
    if (!year || !month || !day) return fallback;
    const date = new Date(fallback);
    date.setFullYear(year, month - 1, day);
    return date.getTime();
  };

  const normalizeCityUfInput = (value: string) => (
    safeToUpper(value)
      .replace(/\s*[/|-]\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const handleUpdatePasswords = () => {
    if (!newAdminPassword) return;
    updateConfig({ passwords: { ...passwords, ADMIN: newAdminPassword } });
    setNewAdminPassword('');
    toast.success("Senha administrativa atualizada com sucesso!");
  };

  const resetOrderForm = () => {
    setShowForm(false);
    setEditingOrderId(null);
    setFormItems([]);
    setCustomerName('');
    setNegotiationNumber('');
    setDeliveryDate('');
    setOrderCreatedDate('');
    setCity('');
    setCustomCarrier('');
    setCustomRepresentative('');
    setObservation('');
    setRequiresInvoice(true);
  };

  const openNewOrder = () => {
    resetOrderForm();
    const today = safeFormatDate(Date.now(), 'iso');
    setDeliveryDate(today);
    setOrderCreatedDate(today);
    setShowForm(true);
  };

  const handleSaveOrder = () => {
    if (!customerName || formItems.length === 0) { 
      toast.error("Campos Incompletos", { description: "Preencha o cliente e adicione ao menos um item." }); 
      return; 
    }
    
    const finalCarrier = carrier === 'OUTROS' ? safeToUpper(customCarrier) : carrier;
    const finalRepresentative = representative === 'OUTROS' ? safeToUpper(customRepresentative) : representative;

    if (!finalCarrier || !finalRepresentative) { 
      toast.error("Campos Incompletos", { description: "Informe a transportadora e o representante." }); 
      return; 
    }

    const existingOrder = editingOrderId ? orders.find(o => o.id === editingOrderId) : undefined;
    if (editingOrderId && !existingOrder) {
      toast.error("Pedido não encontrado", { description: "Reabra o pedido e tente salvar novamente." });
      return;
    }

    const orderToSave: Order = editingOrderId ? {
      ...(existingOrder as Order),
      customerName: safeToUpper(customerName),
      city: safeToUpper(city),
      negotiationNumber,
      deliveryDate,
      createdAt: dateInputToTimestamp(orderCreatedDate, existingOrder?.createdAt || Date.now()),
      carrier: finalCarrier,
      representative: finalRepresentative,
      requiresInvoice,
      observation,
      items: formItems,
    } : {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      customerName: safeToUpper(customerName),
      city: safeToUpper(city),
      negotiationNumber,
      deliveryDate,
      carrier: finalCarrier,
      representative: finalRepresentative,
      notes: '',
      requiresInvoice,
      observation,
      items: formItems,
      status: OrderStatus.PENDING,
      createdAt: dateInputToTimestamp(orderCreatedDate, Date.now())
    };

    addOrder(orderToSave);
    resetOrderForm();
    
    toast.success(editingOrderId ? "Pedido Atualizado!" : "Pedido Cadastrado!", {
      description: (
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-white">{orderToSave.customerName}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {(orderToSave.items || []).length} Itens • {orderToSave.carrier}
          </div>
        </div>
      ),
      icon: <Bell className="text-slate-400" size={18} />
    });
  };

  const [partCode, setPartCode] = useState('');
  const [partDescription, setPartDescription] = useState('');
  
  // Auto-fill description/config when partCode changes
  useEffect(() => {
    if (partCode) {
      const config = partRegistry[partCode];
      if (selectedType === 'SPARE_PART' && typeof config === 'string') {
        setPartDescription(config);
      } else if (selectedType === 'SERVO' && typeof config === 'object') {
        setSelectedModel(config.model);
        setSelectedOrientation(config.orientation);
      }
    }
  }, [partCode, selectedType, partRegistry]);

  // Separate useEffect to ensure kit is set after model
  useEffect(() => {
    if (selectedType === 'SERVO' && partCode && partRegistry[partCode]) {
      const config = partRegistry[partCode];
      if (typeof config === 'object' && config.model === selectedModel) {
        setSelectedKit(config.kit);
      }
    }
  }, [selectedModel, partCode, selectedType, partRegistry]);

  const addItemToForm = () => {
    let modelToUse = '';
    if (selectedType === 'SPARE_PART') {
      if (!partCode) {
        toast.error("Informação Faltante", { description: "Informe o código da peça." });
        return;
      }
      if (!partDescription) {
        toast.error("Informação Faltante", { description: "Informe a descrição da peça." });
        return;
      }
      modelToUse = `${partCode} - ${partDescription}`;
      
      // Save new mapping if it doesn't exist or is different
      if (partRegistry[partCode] !== partDescription) {
        updateConfig({ partRegistry: { ...partRegistry, [partCode]: partDescription } });
      }
    } else if (selectedType === 'SERVO') {
      if (!partCode) {
        toast.error("Informação Faltante", { description: "Informe o código do servo." });
        return;
      }
      modelToUse = selectedModel;
      
      // Save new mapping if it doesn't exist or is different
      const newConfig = { model: selectedModel, kit: selectedKit, orientation: selectedOrientation };
      if (JSON.stringify(partRegistry[partCode]) !== JSON.stringify(newConfig)) {
        updateConfig({ partRegistry: { ...partRegistry, [partCode]: newConfig } });
      }
    } else {
      modelToUse = selectedModel;
    }

    if (!modelToUse) {
      toast.error("Informação Faltante", { description: "Informe o modelo ou descrição do item." });
      return;
    }

    const newItems: OrderItem[] = [];
    for (let i = 0; i < itemQuantity; i++) {
      newItems.push({
        id: Math.random().toString(36),
        model: modelToUse,
        type: selectedType,
        orientation: (selectedType === 'SERVO' || selectedType === 'KIT') ? selectedOrientation : undefined,
        installationKit: (selectedType === 'SERVO' || selectedType === 'KIT') ? (selectedKit || 'SEM KIT') : undefined
      });
    }
    setFormItems([...formItems, ...newItems]);
    setItemQuantity(1);
    setPartCode('');
    setPartDescription('');
    setCustomModel('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, kitId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.promise(
        async () => {
          await onSaveKitImage(kitId, file);
        },
        {
          loading: "Enviando imagem...",
          success: () => `Imagem do KIT ${kitId} atualizada!`,
          error: "Erro ao enviar imagem",
        }
      );
    }
  };

  const openEditOrder = (order: Order) => {
    setSelectedOrderId(null);
    setEditingOrderId(order.id);
    setCustomerName(order.customerName);
    setCity(order.city);
    setNegotiationNumber(order.negotiationNumber);
    setDeliveryDate(order.deliveryDate);
    setOrderCreatedDate(safeFormatDate(order.createdAt, 'iso'));
    setObservation(order.observation || '');
    setRequiresInvoice(order.requiresInvoice !== false);
    
    if (CARRIERS.includes(order.carrier)) {
      setCarrier(order.carrier);
      setCustomCarrier('');
    } else {
      setCarrier('OUTROS');
      setCustomCarrier(order.carrier);
    }

    if (REPRESENTATIVES.includes(order.representative)) {
      setRepresentative(order.representative);
      setCustomRepresentative('');
    } else {
      setRepresentative('OUTROS');
      setCustomRepresentative(order.representative);
    }

    setFormItems([...order.items]);
    setShowForm(true);
  };

  const renderOrderDetail = (order: Order) => (
    <div className="bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0 w-full">
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
                          className="px-2.5 py-1 border border-slate-700 bg-slate-900 text-white rounded-lg text-[10px] font-semibold uppercase w-24 outline-none focus:ring-2 ring-slate-500"
                          placeholder="NF..."
                        />
                        <button
                          onClick={() => {
                            const trimmed = editingInvoiceValue.trim();
                            if (trimmed !== order.invoiceNumber) {
                              updateStatus(order.id, order.status, { invoiceNumber: trimmed });
                              toast.success("Nota Fiscal atualizada!");
                            }
                            setEditingInvoiceOrderId(null);
                          }}
                          className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase shadow-md hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
                         aria-label="Salvar">
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingInvoiceOrderId(null)}
                          className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase hover:bg-slate-600 transition-colors"
                         aria-label="Cancelar">
                          Cancelar
                        </button>
                      </div>
                   ) : (
                     (order.invoiceNumber || order.status !== OrderStatus.AWAITING_INVOICE) && (
                       <div className="flex items-center gap-2 group">
                         <span className={`${order.invoiceNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-700 text-slate-400'} px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-widest`}>
                           {order.invoiceNumber ? `NF: ${order.invoiceNumber}` : 'SEM NF'}
                         </span>
                         {order.status !== OrderStatus.COMPLETED && (
                           <button
                             onClick={() => {
                               setEditingInvoiceOrderId(order.id);
                               setEditingInvoiceValue(order.invoiceNumber || '');
                             }}
                             className={`${order.invoiceNumber ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} text-slate-400 hover:text-slate-200 transition-opacity`}
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
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Negociação</span><span className="text-xs font-semibold text-white truncate block">{order.negotiationNumber || '---'}</span></div>
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Entrega</span><span className="text-xs font-semibold text-white truncate block">{order.deliveryDate || '---'}</span></div>
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Transporte</span><span className="text-xs font-semibold text-white uppercase truncate block">{order.carrier}</span></div>
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Representante</span><span className="text-xs font-semibold text-white uppercase truncate block">{order.representative}</span></div>
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Peso</span><span className="text-xs font-semibold text-white uppercase truncate block">{order.weight ? `${order.weight}kg` : '---'}</span></div>
                <div><span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Volumes</span><span className="text-xs font-semibold text-white uppercase truncate block">{order.volume || '---'}</span></div>
             </div>
             {order.observation && (
                <div className="pt-4 border-t border-slate-700/50">
                   <span className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Observação do Pedido</span>
                   <span className="text-xs font-semibold text-white block whitespace-pre-wrap">{order.observation}</span>
                </div>
             )}
          </div>
       </div>
       <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 md:p-8 space-y-4">
             <table className="w-full text-left border-collapse">
               <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-700">
                 <tr>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Tipo</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Item / Descrição</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                   <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Números de Série</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                  {groupedItems(order.items).map((group, idx) => (
                    <tr key={idx} className="admin-order-detail-row hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           {group.type === 'SERVO' ? <Package size={14} className="text-slate-400"/> : group.type === 'KIT' ? <Box size={14} className="text-slate-400"/> : group.type === 'REPAIR' ? <Wrench size={14} className="text-slate-400"/> : <Settings2 size={14} className="text-slate-400"/>}
                           <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest">{group.type === 'SERVO' ? 'SERVO' : group.type === 'KIT' ? 'KIT' : group.type === 'REPAIR' ? 'REPARO' : 'PEÇA'}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="space-y-1">
                           <div className="flex items-center gap-2">
                             <span className="font-bold text-white text-[13px] uppercase italic text-left leading-tight">
                               {group.type === 'KIT' ? `KIT ${group.kit}` : group.model}
                               {group.type === 'SERVO' && (
                                 <span className="text-slate-400 font-semibold ml-2">
                                   | {group.orientation} | <span className="text-white">KIT: {group.kit}</span>
                                 </span>
                               )}
                             </span>
                           </div>
                           {(group.type === 'SERVO' || group.type === 'KIT') && group.kit !== 'SEM KIT' && (
                             <button 
                               onClick={() => setViewingKitImage(group.kit)} 
                               className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-300 transition-colors pt-0.5"
                               title="Visualizar foto do kit"
                              aria-label="Visualizar foto do kit">
                               <Eye size={14} /> <span className="underline decoration-slate-400/30 underline-offset-2">FOTO</span>
                             </button>
                           )}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 text-[13px] font-bold">
                           {group.count}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-wrap gap-1">
                            {(group.items || []).filter(i => i.guaranteeNumber).map(item => (
                              <span key={item.id} className="font-mono text-[8px] font-semibold px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-white italic">A{item.guaranteeNumber}</span>
                            ))}
                            {(group.items || []).filter(i => i.guaranteeNumber).length === 0 && <span className="text-[10px] text-slate-600 italic">Nenhuma série vinculada</span>}
                         </div>
                      </td>
                    </tr>
                  ))}
               </tbody>
             </table>
             <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2">
                <span className={`px-4 py-1.5 text-xs font-semibold rounded-full border uppercase ${getStatusColor(order.status)}`}>{getStatusLabel(order.status, order.requiresInvoice)}</span>
                {order.status === OrderStatus.AWAITING_INVOICE && (
                  <div className="flex gap-2">
                    <input value={invoiceNumberInput} onChange={e => setInvoiceNumberInput(e.target.value)} placeholder="NF..." className="px-3 py-1.5 border border-slate-700 bg-slate-900 text-white rounded-lg text-[9px] font-semibold w-20 outline-none" />
                    <button onClick={() => {
                      if(!invoiceNumberInput) {
                        toast.error("NF Faltante", { description: "Informe o número da nota fiscal." });
                        return;
                      }
                      updateStatus(order.id, OrderStatus.READY, { invoiceNumber: invoiceNumberInput });
                      setInvoiceNumberInput('');
                      setSelectedOrderId(null);
                    }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-[8px] font-semibold uppercase shadow-md active:scale-95 hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all" aria-label="Lançar">Lançar</button>
                  </div>
                )}
             </div>
             <div className="flex items-center gap-2">
               {(order.status === OrderStatus.PENDING || order.status === OrderStatus.AWAITING_EXPEDITION) && (
                 <button 
                   onClick={() => openEditOrder(order)}
                   className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all group shadow-sm"
                  aria-label="Editar Itens">
                   <Pencil size={16} />
                   <span className="text-[10px] font-semibold uppercase tracking-widest">Editar Itens</span>
                 </button>
               )}
               {!order.invoiceNumber && order.status !== OrderStatus.COMPLETED ? (
                 <button 
                   onClick={() => { 
                     if(confirm("ATENÇÃO: Deseja realmente excluir este pedido permanentemente? Esta ação não pode ser desfeita.")) {
                       deleteOrder(order.id);
                       setSelectedOrderId(null);
                     }
                   }} 
                   className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all group shadow-sm"
                  aria-label="Excluir Pedido">
                   <Trash2 size={16} className="group-hover:animate-bounce" />
                   <span className="text-[10px] font-semibold uppercase tracking-widest">Excluir Pedido</span>
                 </button>
               ) : (
                 <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-slate-400 rounded-xl border border-slate-700 cursor-not-allowed opacity-60">
                   <AlertTriangle size={14} />
                   <span className="text-xs font-semibold uppercase tracking-widest">Bloqueado para Exclusão (NF Emitida)</span>
                 </div>
               )}
             </div>
          </div>
       </div>
       </div>
    </div>
  );
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title="Administração"
        tabs={[
          { id: 'orders', label: 'Pedidos', icon: <LayoutDashboard size={18}/> },
          { id: 'customers', label: 'Clientes', icon: <Users size={18}/> },
          { id: 'inventory', label: 'Estoque', icon: <Warehouse size={18}/> },
          { id: 'history', label: 'Histórico', icon: <History size={18}/> },
          { id: 'system', label: 'Segurança', icon: <ShieldCheck size={18}/> }
        ]}
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id as any);
          setSelectedOrderId(null);
        }}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-70' : ''}`}>
        <div className="w-full p-3 md:p-6 space-y-8 pb-12">
          {/* Header com Navegação Principal e Busca */}
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between no-print">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-3 bg-slate-800 text-[#010308] rounded-xl hover:bg-slate-700 hover:text-[#010308] transition-colors border border-slate-700 shadow-sm"
               aria-label="Botão">
                <Menu size={20} />
              </button>
              <div className="space-y-1">
                <h2 className="text-3xl font-semibold text-white tracking-tight">Painel Administrativo</h2>
                <p className="text-xs text-slate-400">Gestão de Pedidos e Fluxo Industrial</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center w-full lg:w-auto">
              <div className="bg-slate-800 p-3 px-5 rounded-xl border border-slate-700 flex items-center gap-3 shadow-sm w-full md:w-[280px] focus-within:border-slate-500 transition-colors">
                 <Search className="text-slate-300" size={18} />
                 <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="PESQUISAR..." className="flex-1 bg-transparent border-none outline-none font-semibold text-[10px] uppercase placeholder:text-slate-300 text-white" />
              </div>
              <button 
                onClick={() => setIsCompactMode(!isCompactMode)}
                className="p-3 bg-slate-800 text-[#010308] rounded-full hover:bg-slate-700 hover:text-[#010308] transition-colors border border-slate-700 shadow-sm"
                title={isCompactMode ? "Mostrar Cards" : "Ocultar Cards"}
               aria-label="Botão">
                {isCompactMode ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

      {activeTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Dashboard de Indicadores - Bento Style */}
          {!isCompactMode && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                 <div 
                    onClick={() => { setActiveTab('orders'); setStatusFilter('ALL'); }}
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-white transition-all relative overflow-hidden cursor-pointer active:scale-95"
                 >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-slate-700 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-white mb-4 relative z-10"><TrendingUp size={18}/></div>
                    <div className="relative z-10">
                       <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Novos Pedidos</span>
                       <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.newToday}</span>
                    </div>
                 </div>
                 <div 
                    onClick={() => { setActiveTab('orders'); setStatusFilter('PLANNED_TODAY'); }}
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-blue-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
                 >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                    <div className="w-10 h-10 bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-500 mb-4 relative z-10"><Calendar size={18}/></div>
                    <div className="relative z-10">
                       <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Planejados P/ Hoje</span>
                       <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.plannedToday}</span>
                    </div>
                 </div>
                 <div 
                   onClick={() => { setActiveTab('orders'); setStatusFilter(OrderStatus.AWAITING_INVOICE); }}
                     className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-orange-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
                  >
                     <div className="absolute top-0 right-0 w-20 h-20 bg-orange-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                     <div className="w-10 h-10 bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-500 mb-4 relative z-10"><FileText size={18}/></div>
                     <div className="relative z-10">
                        <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Aguardando NF</span>
                        <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.awaitingInvoice}</span>
                     </div>
                  </div>
                  <div 
                    onClick={() => { setActiveTab('orders'); setStatusFilter(OrderStatus.READY); }}
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-emerald-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                    <div className="w-10 h-10 bg-emerald-900/20 rounded-lg flex items-center justify-center text-emerald-500 mb-4 relative z-10"><Package size={18}/></div>
                    <div className="relative z-10">
                       <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Aguardando Saída</span>
                       <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.awaitingReady}</span>
                    </div>
                  </div>
                  <div 
                     onClick={() => setActiveTab('inventory')}
                     className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-indigo-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
                  >
                     <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                     <div className="w-10 h-10 bg-indigo-900/20 rounded-lg flex items-center justify-center text-indigo-500 mb-4 relative z-10"><Box size={18}/></div>
                     <div className="relative z-10">
                        <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Estoque Servos</span>
                        <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.stockTotal}</span>
                     </div>
                  </div>
                 <div 
                    onClick={() => setActiveTab('history')}
                    className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between group hover:border-violet-400 transition-all relative overflow-hidden cursor-pointer active:scale-95"
                 >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-violet-900/20 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                    <div className="w-10 h-10 bg-violet-900/20 rounded-lg flex items-center justify-center text-violet-400 mb-4 relative z-10"><Truck size={18}/></div>
                    <div className="relative z-10">
                       <span className="block text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-1">Despachados Hoje</span>
                       <span className="block text-2xl font-semibold text-white tracking-tighter">{metrics.dispatchedToday}</span>
                    </div>
                 </div>
            </div>
          )}

          <div className="space-y-6">
             <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={openNewOrder} className="flex-1 md:flex-none bg-slate-900 text-white rounded-xl px-8 py-4 flex items-center justify-center gap-3 hover:bg-slate-700 transition-all shadow-xl active:scale-95 group" aria-label="Novo Pedido">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform"/> <span className="text-[10px] font-semibold uppercase tracking-widest">Novo Pedido</span>
                  </button>
                </div>

                {/* Sub-filtros de Status */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 shadow-inner overflow-x-auto gap-1 w-full md:w-auto">
                   {metrics.anomalous > 0 && (
                     <button 
                       onClick={() => setStatusFilter('ANOMALOUS' as any)}
                       className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[7px] font-semibold uppercase transition-all whitespace-nowrap animate-pulse ${statusFilter === 'ANOMALOUS' ? 'bg-red-600 text-white shadow-lg' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'}`}
                      aria-label="Botão">
                        <AlertTriangle size={10}/> Erro Status ({metrics.anomalous})
                     </button>
                   )}
                   {[
                     { id: 'ALL', label: 'Todos', icon: <Filter size={10}/> },
                     { id: OrderStatus.PENDING, label: 'Montagem', icon: <Settings2 size={10}/> },
                     { id: OrderStatus.AWAITING_EXPEDITION, label: 'Expedição', icon: <Package size={10}/> },
                     { id: 'PLANNED_TODAY', label: 'Planejados', icon: <Calendar size={10}/> },
                     { id: OrderStatus.AWAITING_INVOICE, label: 'Faturamento', icon: <FileText size={10}/> },
                     { id: OrderStatus.READY, label: 'Prontos', icon: <CheckCircle2 size={10}/> }
                   ].map(f => (
                     <button key={f.id} onClick={() => setStatusFilter(f.id as any)} className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[7px] font-semibold uppercase transition-all whitespace-nowrap ${statusFilter === f.id ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`} aria-label="Botão">
                        {f.icon} {f.label}
                     </button>
                   ))}
                </div>
             </div>

             <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm" style={{minHeight: '184px'}}>
                <div className="overflow-x-auto" style={{minHeight: '184px'}}>
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Criado em</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4 hidden md:table-cell">Cidade</th>
                        <th className="p-4 hidden md:table-cell">Transportadora</th>
                        <th className="p-4">Itens</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 hidden sm:table-cell">NF</th>
                        <th className="p-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredOrders.sort((a,b) => b.createdAt - a.createdAt).map(order => (
                        <tr 
                           key={order.id} 
                           onClick={() => setSelectedOrderId(order.id)} 
                           style={{ height: '77.328px' }}
                           className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${selectedOrderId === order.id ? 'bg-slate-700' : ''} ${order.isSelectedForToday || isOrderFullySeparated(order) ? 'bg-blue-900/10' : ''}`}
                        >
                          <td className="p-4 text-xs text-slate-300 whitespace-nowrap">{safeFormatDate(order.createdAt)}</td>
                          <td className="p-4 font-semibold text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {(order.isSelectedForToday || isOrderFullySeparated(order)) && <Calendar size={14} className={`shrink-0 ${isOrderFullySeparated(order) ? 'text-blue-400' : 'text-blue-500'}`} title={isOrderFullySeparated(order) ? "Totalmente Separado" : "Planejado para Hoje"} />}
                              <div className="flex flex-col">
                                <span className="truncate max-w-[200px] block text-xs" title={order.customerName}>{order.customerName}</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest">{order.negotiationNumber}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{order.city}</span></div></td>
                          <td className="p-4 text-xs text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><Truck size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{order.carrier}</span></div></td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-semibold text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-md">
                                {(order.items || []).length} un
                              </span>
                               {getMissingItemsCount(order) > 0 && <span className="text-[10px] font-semibold text-amber-400">({getMissingItemsCount(order)} falt.)</span>}
                               {order.weight && <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">{order.weight}KG</span>}
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                             <div className="flex items-center gap-2">
                               <span className={`px-2 py-1 text-[10px] font-semibold rounded-md border uppercase ${getStatusColor(order.status)}`}>
                                 {getStatusLabel(order.status, order.requiresInvoice)}
                               </span>
                               {(!order.status || !Object.values(OrderStatus).includes(order.status as any)) && (
                                 <select 
                                   onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                                   className="bg-slate-900 border border-red-500/50 text-red-500 text-[10px] rounded px-1 py-0.5 outline-none font-bold"
                                   defaultValue=""
                                 >
                                   <option value="" disabled>Corrigir...</option>
                                   <option value={OrderStatus.PENDING}>Aguardando Montagem</option>
                                   <option value={OrderStatus.AWAITING_EXPEDITION}>Aguardando Expedição</option>
                                   <option value={OrderStatus.AWAITING_INVOICE}>Aguardando NF</option>
                                   <option value={OrderStatus.READY}>Aguardando Saída</option>
                                 </select>
                               )}
                             </div>
                          </td>
                          <td className="p-4 hidden sm:table-cell">
                             {order.invoiceNumber ? (
                               <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-1 rounded-md">NF {order.invoiceNumber}</span>
                             ) : order.requiresInvoice === false ? (
                               <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-1 rounded-md">SEM NF</span>
                             ) : (
                               <span className="text-slate-600">-</span>
                             )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (window.confirm('Deseja realmente excluir este pedido?')) {
                                   deleteOrder(order.id);
                                   toast.success('Pedido excluído com sucesso');
                                 }
                               }}
                               className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-lg transition-colors"
                              aria-label="Botão">
                               <Trash2 size={14} />
                             </button>
                          </td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-20 text-center opacity-40">
                             <Search size={48} className="mx-auto mb-4 text-slate-500" />
                             <p className="text-sm font-semibold">Nenhum pedido encontrado</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>

          {selectedOrder && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderId(null)} />
              <div className="relative w-full max-w-4xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                 {renderOrderDetail(selectedOrder)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           {/* Seletor de Representantes */}
           <div className="flex flex-wrap gap-3 no-print bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <button 
                onClick={() => setSelectedRepresentative('ALL')}
                className={`px-6 py-3 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${selectedRepresentative === 'ALL' ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50'}`}
               aria-label="Botão">
                <Users size={14}/> Todos ({uniqueCustomers.length})
              </button>
              {Array.from(new Set(uniqueCustomers.map(c => c.representative))).sort().map(rep => {
                const count = uniqueCustomers.filter(c => c.representative === rep).length;
                return (
                  <button 
                    key={rep}
                    onClick={() => setSelectedRepresentative(rep)}
                    className={`px-6 py-3 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${selectedRepresentative === rep ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-100'}`}
                   aria-label="Botão">
                    <UserCircle size={14}/> {rep} ({count})
                  </button>
                );
              })}
           </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Cidade</th>
                        <th className="p-4">Representante</th>
                        <th className="p-4">Pedidos</th>
                        <th className="p-4">Itens</th>
                        <th className="p-4">Modelo Favorito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredCustomersList
                        .filter(c => selectedRepresentative === 'ALL' || c.representative === selectedRepresentative)
                        .map((c: any) => (
                        <tr 
                          key={c.id} 
                          className="hover:bg-slate-700/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSearchQuery(c.name);
                            setActiveTab('history');
                          }}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-500">
                                <UserCircle size={18}/>
                              </div>
                              <span className="font-semibold text-white truncate max-w-[200px]" title={c.name}>{c.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-300">{c.city}</td>
                          <td className="p-4">
                             <span className="text-[10px] font-semibold text-slate-300 bg-slate-900/50 border border-slate-700 px-2 py-0.5 rounded-md uppercase">{c.representative}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-semibold text-white">{c.behavior.totalOrders}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-semibold text-white">{c.behavior.totalItems}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-semibold text-slate-400 truncate block max-w-[150px]">{c.behavior.favoriteModel}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
             {filteredCustomersList.filter(c => selectedRepresentative === 'ALL' || c.representative === selectedRepresentative).length === 0 && (
              <div className="col-span-full py-20 text-center border-4 border-dashed rounded-xl opacity-20">
                 <Users size={48} className="mx-auto mb-4" />
                 <p className="text-xl font-semibold uppercase">Nenhum cliente para este representante</p>
              </div>
            )}
         </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button onClick={() => setInventorySubTab('servos')} className={`px-6 py-3 rounded-xl font-semibold uppercase text-[10px] tracking-widest transition-all ${inventorySubTab === 'servos' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} aria-label="Servos em Estoque">Servos em Estoque</button>
            <button onClick={() => setInventorySubTab('kits')} className={`px-6 py-3 rounded-xl font-semibold uppercase text-[10px] tracking-widest transition-all ${inventorySubTab === 'kits' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-white'}`} aria-label="Kits em Estoque">Kits em Estoque</button>
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
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-900/50 border border-slate-700 px-2 py-0.5 rounded-md uppercase">{group.orientation}</span>
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
                        </tr>
                      ))}
                      {groupedKits.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-20 text-center opacity-40">
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
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredHistory.map(o => (
                        <tr 
                          key={o.id} 
                          onClick={() => setSelectedOrderId(o.id)} 
                          className={`hover:bg-slate-700/50 cursor-pointer transition-colors ${selectedOrderId === o.id ? 'bg-slate-700' : ''}`}
                        >
                          <td className="p-4 text-xs text-slate-300 whitespace-nowrap">{safeFormatDate(o.dispatchedAt)}</td>
                          <td className="p-4 font-semibold text-white whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="truncate max-w-[200px] block" title={o.customerName}>{o.customerName}</span>
                              <span className="text-[9px] text-slate-500 uppercase tracking-widest">{o.negotiationNumber}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-300 hidden md:table-cell"><div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{o.city}</span></div></td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">CONCLUÍDO</span>
                          </td>
                          <td className="p-4 hidden sm:table-cell whitespace-nowrap">
                            {o.invoiceNumber ? <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-1 rounded-md">NF {o.invoiceNumber}</span> : <span className="text-slate-600">-</span>}
                          </td>
                          <td className="p-4 text-right">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (window.confirm('Deseja realmente excluir este pedido do histórico?')) {
                                   deleteOrder(o.id);
                                   toast.success('Pedido excluído com sucesso');
                                 }
                               }}
                               className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-800 rounded-lg transition-colors inline-block"
                               title="Excluir Pedido"
                              aria-label="Excluir Pedido">
                               <Trash2 size={14} />
                             </button>
                          </td>
                        </tr>
                      ))}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-20 text-center opacity-40">
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

       {selectedOrder && (activeTab === 'orders' || activeTab === 'history') && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrderId(null)} />
           <div className="relative w-full max-w-4xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
              {renderOrderDetail(selectedOrder)}
           </div>
         </div>
       )}

       {activeTab === 'system' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="max-w-xl mx-auto">
              <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-xl space-y-8">
                 <div className="space-y-2">
                     <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck size={18} className="text-slate-400" /> Segurança
                     </h3>
                     <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Senha Administrativa</label>
                     <div className="flex gap-4">
                       <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder="Nova senha..." className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-sm outline-none focus:ring-2 ring-slate-500 placeholder:text-slate-600" />
                       <button onClick={handleUpdatePasswords} className="p-4 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-all shadow-lg active:scale-95" aria-label="Atualizar"><RefreshCcw size={20}/></button>
                     </div>
                 </div>
              </div>
           </div>
        </div>
       )}

       {showForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetOrderForm} />
          <div className="relative bg-slate-800 w-full max-w-4xl rounded-xl shadow-2xl p-10 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto border border-slate-700">
             <div className="flex justify-between items-center text-white">
                <h3 className="text-2xl font-semibold uppercase italic tracking-tighter">{editingOrderId ? 'Editar Pedido' : 'Novo Pedido'}</h3>
                <button onClick={resetOrderForm} className="p-2 hover:bg-slate-700 rounded-xl transition-colors" aria-label="Botão"><X /></button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                   <input list="customer-list" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="CLIENTE..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
                   <datalist id="customer-list">
                     {uniqueCustomers.map(c => <option key={c.id} value={c.name} />)}
                   </datalist>
                </div>
                <div className="relative">
                  <input list="city-uf-list" value={city} onChange={e => setCity(safeToUpper(e.target.value))} onBlur={e => setCity(normalizeCityUfInput(e.target.value))} placeholder="CIDADE/UF..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
                  <datalist id="city-uf-list">
                    {cityUfOptions.map(cityOption => <option key={cityOption} value={cityOption} />)}
                  </datalist>
                </div>
                <input value={negotiationNumber} onChange={e => setNegotiationNumber(e.target.value)} placeholder="NEGOCIAÇÃO..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
                <select value={representative} onChange={e => setRepresentative(e.target.value)} className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500">
                  {REPRESENTATIVES.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                </select>
                {representative === 'OUTROS' && (
                  <input value={customRepresentative} onChange={e => setCustomRepresentative(e.target.value)} placeholder="NOME DO REPRESENTANTE..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500 animate-in slide-in-from-top-2" />
                )}
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Data de criação</label>
                  <input type="date" value={orderCreatedDate} onChange={e => setOrderCreatedDate(e.target.value)} className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Entrega</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
                </div>
                <select value={carrier} onChange={e => setCarrier(e.target.value)} className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500">
                  {CARRIERS.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
                {carrier === 'OUTROS' && (
                  <input value={customCarrier} onChange={e => setCustomCarrier(e.target.value)} placeholder="NOME DA TRANSPORTADORA..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500 animate-in slide-in-from-top-2" />
                )}
                <div className="flex items-center gap-4 px-5 py-3 bg-slate-900 border border-slate-700 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Nota Fiscal?</span>
                  <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button type="button" onClick={() => setRequiresInvoice(true)} className={`px-4 py-2 rounded-lg text-[8px] font-semibold uppercase transition-all ${requiresInvoice ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`} aria-label="Sim">Sim</button>
                    <button type="button" onClick={() => setRequiresInvoice(false)} className={`px-4 py-2 rounded-lg text-[8px] font-semibold uppercase transition-all ${!requiresInvoice ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`} aria-label="Não">Não</button>
                  </div>
                </div>
                <input value={observation} onChange={e => setObservation(e.target.value)} placeholder="OBSERVAÇÃO (OPCIONAL)..." className="w-full px-5 py-3 bg-slate-900 text-white border border-slate-700 rounded-xl font-semibold text-sm uppercase outline-none focus:ring-2 ring-slate-500" />
             </div>

             <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                <div className="flex gap-2 mb-4">
                   {['SERVO', 'KIT', 'REPAIR', 'SPARE_PART'].map(type => (
                     <button key={type} onClick={() => setSelectedType(type as any)} className={`px-4 py-2 rounded-xl text-[8px] font-semibold uppercase tracking-widest transition-all ${selectedType === type ? 'bg-slate-700 text-white shadow-lg' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'}`} aria-label="Botão">
                       {type === 'SERVO' ? 'SERVO' : type === 'KIT' ? 'SÓ KIT' : type === 'REPAIR' ? 'JOGO REPARO' : 'PEÇA AVULSA'}
                     </button>
                   ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                   <div className="lg:col-span-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Modelo / Descrição</label>
                      {selectedType === 'SPARE_PART' ? (
                        <div className="grid grid-cols-3 gap-2">
                          <input value={partCode} onChange={e => { setPartCode(safeToUpper(e.target.value)); if(!partRegistry[safeToUpper(e.target.value)]) setPartDescription(''); }} placeholder="CÓDIGO..." className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500" />
                          <input value={partDescription} onChange={e => setPartDescription(safeToUpper(e.target.value))} placeholder="DESCRIÇÃO..." className="col-span-2 w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500" />
                        </div>
                      ) : selectedType === 'SERVO' ? (
                        <div className="grid grid-cols-3 gap-2">
                          <input value={partCode} onChange={e => setPartCode(safeToUpper(e.target.value))} placeholder="CÓDIGO..." className="col-span-3 w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500" />
                          <div className="col-span-3">
                            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500">
                                {SERVO_BASE_MODELS.map(m => <option key={m} value={m} className="bg-slate-800">{m}</option>)}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500">
                           {(selectedType === 'SERVO' || selectedType === 'KIT' ? SERVO_BASE_MODELS : REPAIR_MODELS).map(m => <option key={m} value={m} className="bg-slate-800">{m}</option>)}
                        </select>
                      )}
                   </div>

                   {(selectedType === 'SERVO' || selectedType === 'KIT') && (
                     <>
                        <div>
                          <div className="flex justify-between items-center ml-2 mb-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Kit de Instalação</label>
                            {selectedKit !== 'SEM KIT' && (
                              <button onClick={() => setViewingKitImage(selectedKit)} className="text-slate-400 hover:text-slate-200 flex items-center gap-1" aria-label="Ver">
                                <Eye size={10} /><span className="text-[7px] font-semibold uppercase">Ver</span>
                              </button>
                            )}
                          </div>
                          <select value={selectedKit} onChange={e => setSelectedKit(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500">
                             <option value="SEM KIT" className="bg-slate-800">SEM KIT</option>
                             {SERVO_KITS[selectedModel]?.map(k => <option key={k} value={k} className="bg-slate-800">{k}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Orientação</label>
                          <select value={selectedOrientation} onChange={e => setSelectedOrientation(e.target.value as ServoOrientation)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-xs uppercase outline-none focus:border-slate-500">
                             <option value="NORMAL" className="bg-slate-800">NORMAL</option>
                             <option value="INVERTIDO_015_VF" className="bg-slate-800">INVERTIDO 015/VF</option>
                             <option value="INVERTIDO_028" className="bg-slate-800">INVERTIDO 028</option>
                             <option value="DESLOCADO" className="bg-slate-800">DESLOCADO</option>
                             <option value="REBAIXADO" className="bg-slate-800">REBAIXADO</option>
                             <option value="CORPO_PRINCIPAL" className="bg-slate-800">SÓ O CORPO PRINCIPAL</option>
                          </select>
                        </div>
                     </>
                   )}
                </div>

                <div className="flex gap-2 items-end mt-4">
                   <div className="w-20">
                     <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest ml-2 mb-1 block text-center">Qtde</label>
                     <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value) || 1)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-semibold text-center outline-none focus:border-slate-500" />
                   </div>
                   <button onClick={addItemToForm} className="flex-1 bg-slate-700 text-white py-3 rounded-xl font-semibold uppercase text-[10px] hover:bg-slate-600 active:scale-95 transition-all shadow-md" aria-label="Adicionar Item ao Pedido">Adicionar Item ao Pedido</button>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 min-h-[40px] border-t border-slate-700 mt-4">
                   {groupedItems(formItems).map((g, i) => (
                     <div key={i} className="px-4 py-2 bg-slate-800 rounded-xl text-[9px] font-semibold uppercase shadow-sm border border-slate-700 text-white flex items-center gap-3 animate-in zoom-in-95">
                        <span className="italic">
                          {g.count}x {g.type === 'KIT' ? `KIT ${g.kit}` : g.model} {g.type === 'SERVO' ? `(${g.kit} / ${g.orientation.substring(0,3)})` : `[${g.type === 'REPAIR' ? 'REPARO' : 'PEÇA'}]`}
                        </span>
                        <button onClick={() => setFormItems(formItems.filter(item => !(
                          item.type === g.type &&
                          item.model === g.model && 
                          (item.installationKit || 'SEM KIT') === g.kit && 
                          (item.orientation || '---') === g.orientation
                        )))} className="text-red-400 hover:text-red-300" aria-label="Botão"><X size={14}/></button>
                     </div>
                   ))}
                   {formItems.length === 0 && <p className="text-[8px] font-semibold text-slate-500 uppercase italic w-full text-center py-2">Lista de itens vazia...</p>}
                </div>
             </div>
             <button onClick={handleSaveOrder} className="w-full bg-slate-700 text-white py-4 rounded-xl font-semibold uppercase text-xs tracking-widest shadow-2xl hover:bg-slate-600 transition-all active:scale-[0.98]" aria-label="Botão">{editingOrderId ? 'Salvar Alterações' : 'Confirmar e Cadastrar Pedido'}</button>
          </div>
        </div>
      )}

      {viewingKitImage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300" role="dialog" aria-modal="true">
           <div className="absolute inset-0 cursor-zoom-out" onClick={() => { setViewingKitImage(null); setZoomScale(1); }} />
           
           <div className="relative w-[95vw] h-[95vh] flex flex-col items-center justify-center overflow-hidden">
              {/* Header Flutuante */}
              <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
                 <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto">
                    <h4 className="font-semibold uppercase italic tracking-tighter text-white text-lg leading-none">
                      Referência do Kit
                    </h4>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">
                      ID: {viewingKitImage}
                    </p>
                 </div>
                 <button 
                   onClick={() => { setViewingKitImage(null); setZoomScale(1); }} 
                   className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all pointer-events-auto"
                  aria-label="Botão">
                   <X size={24} />
                 </button>
              </div>

              {/* Controles de Zoom */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
                 <button onClick={() => setZoomScale(s => Math.min(s + 0.5, 4))} className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all" aria-label="Botão"><Plus size={20}/></button>
                 <button onClick={() => setZoomScale(1)} className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all text-[10px] font-semibold" aria-label="1x">1x</button>
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
                      <p className="text-sm font-semibold uppercase mt-6 tracking-widest">Nenhuma imagem cadastrada</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;
