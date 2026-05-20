import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Order, AssembledUnit, Kit, KitData, ServoModelData, Customer, KitImage, AuditLog, ChatMessage, AppUser, UserRole } from '../types';
import { toast } from 'sonner';
import { Bell, Package } from 'lucide-react';
import { safeFormatDate } from '../lib/utils';

const isOrderEdited = (oldOrder: Order, newOrder: Order) => {
  if (
    oldOrder.customerName !== newOrder.customerName ||
    oldOrder.city !== newOrder.city ||
    oldOrder.negotiationNumber !== newOrder.negotiationNumber ||
    oldOrder.deliveryDate !== newOrder.deliveryDate ||
    oldOrder.carrier !== newOrder.carrier ||
    oldOrder.representative !== newOrder.representative ||
    oldOrder.notes !== newOrder.notes
  ) {
    return true;
  }
  if ((oldOrder.items?.length || 0) !== (newOrder.items?.length || 0)) return true;
  const cleanItems = (items: any[]) => (items || []).map(item => ({
    id: item.id,
    model: item.model,
    type: item.type,
    orientation: item.orientation,
    installationKit: item.installationKit
  }));
  return JSON.stringify(cleanItems(oldOrder.items)) !== JSON.stringify(cleanItems(newOrder.items));
};

export function useFirebaseData(
  loggedInUserRef: React.MutableRefObject<AppUser | null>,
  activeRoleRef: React.MutableRefObject<UserRole | null>,
  isChatOpenRef: React.MutableRefObject<boolean>,
  setIsChatOpen: (isOpen: boolean) => void,
  showSystemNotification: (title: string, body: string, tag?: string) => void
) {
  const [isSyncing, setIsSyncing] = useState(true);
  const initialLoadRef = useRef(true);
  const previousOrdersRef = useRef<Record<string, Order>>({});
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [assembledUnits, setAssembledUnits] = useState<AssembledUnit[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [kitData, setKitData] = useState<KitData[]>([]);
  const [servoModelData, setServoModelData] = useState<ServoModelData[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [kitImages, setKitImages] = useState<KitImage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [auditLogLimit, setAuditLogLimit] = useState(50);
  const [loadCompletedOrders, setLoadCompletedOrders] = useState(false);
  const [partRegistry, setPartRegistry] = useState<Record<string, any>>({});
  const [safisaIcon, setSafisaIcon] = useState<string | null>(null);
  const [currentSequence, setCurrentSequence] = useState<number>(61000);
  const [passwords, setPasswords] = useState<Record<UserRole, string>>({
    [UserRole.ADMIN]: '123',
    [UserRole.ASSEMBLY]: '123',
    [UserRole.EXPEDITION]: '123',
    [UserRole.SYSTEM_SETTINGS]: '123'
  });
  const [manualQuantities, setManualQuantities] = useState<Record<string, Record<string, string>>>({});
  const [globalAssemblers, setGlobalAssemblers] = useState<string[]>([]);
  const [globalRepresentatives, setGlobalRepresentatives] = useState<string[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
       const [
         {data: uData}, {data: oData}, {data: auData}, {data: kData}, 
         {data: kdData}, {data: smData}, {data: cData}, {data: iData}, 
         {data: alData}, {data: mData}, {data: cfgData}
       ] = await Promise.all([
         supabase.from('users').select('*'),
         supabase.from('orders').select('*'),
         supabase.from('assembledunits').select('*'),
         supabase.from('kits').select('*'),
         supabase.from('kitdata').select('*'),
         supabase.from('servomodeldata').select('*'),
         supabase.from('customers').select('*'),
         supabase.from('kitimages').select('*'),
         supabase.from('auditlogs').select('*').order('timestamp', { ascending: false }).limit(auditLogLimit),
         supabase.from('messages').select('*').order('timestamp', { ascending: true }),
         supabase.from('config').select('*').eq('id', 'global')
       ]);

       if (uData) setUsers(uData.map((d: any) => ({ ...d.data, id: d.id })));
       if (auData) setAssembledUnits(auData.map((d: any) => ({ ...d.data, id: d.id })));
       if (kData) setKits(kData.map((d: any) => ({ ...d.data, id: d.id })));
       if (kdData) setKitData(kdData.map((d: any) => ({ ...d.data, id: d.id })));
       if (smData) setServoModelData(smData.map((d: any) => ({ ...d.data, id: d.id })));
       if (cData) setCustomers(cData.map((d: any) => ({ ...d.data, id: d.id })));
       if (iData) setKitImages(iData.map((d: any) => ({ ...d.data, id: d.id })));
       if (alData) setAuditLogs(alData.map((d: any) => ({ ...d.data, id: d.id })));
       if (mData) setMessages(mData.map((d: any) => ({ ...d.data, id: d.id })));
       
       if (cfgData && cfgData[0]) {
         const data = cfgData[0].data;
         if (data.currentSequence !== undefined) setCurrentSequence(Number(data.currentSequence));
         if (data.passwords !== undefined) setPasswords(data.passwords);
         if (data.partRegistry !== undefined) setPartRegistry(data.partRegistry);
         if (data.safisaIcon !== undefined) setSafisaIcon(data.safisaIcon);
         if (data.manualQuantities !== undefined) setManualQuantities(data.manualQuantities);
         if (data.assemblers !== undefined) setGlobalAssemblers(data.assemblers);
         if (data.representatives !== undefined) setGlobalRepresentatives(data.representatives);
       }

       if (oData) {
         let fetchedOrders = oData.map((d: any) => ({ ...d.data, id: d.id }));
         fetchedOrders.forEach(o => { previousOrdersRef.current[o.id] = o; });
         if (!loadCompletedOrders) {
           const today = safeFormatDate(Date.now(), 'iso');
           fetchedOrders = fetchedOrders.filter(o =>
             o.status !== 'COMPLETED' ||
             (o.dispatchedAt && safeFormatDate(o.dispatchedAt, 'iso') === today)
           );
         }
         setOrders(fetchedOrders);
       }
       setIsSyncing(false);
       initialLoadRef.current = false;
    };

    fetchAll();
    
    // MySQL não possui o realtime do Supabase neste app.
    // Mantemos a UI sincronizada consultando a API periodicamente.
    const syncInterval = window.setInterval(fetchAll, Number(import.meta.env.VITE_MYSQL_POLL_INTERVAL || 5000));

    return () => {
      window.clearInterval(syncInterval);
    };
  }, [auditLogLimit, loadCompletedOrders]);

  return {
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
  };
}
