import { toast } from 'sonner';
import { AppUser, Kit, Order, OrderStatus } from '../types';
import { normalizeKitName } from '../constants';
import { safeToUpper } from '../lib/utils';
import { supabase } from '../supabase';
import { cleanData } from './useOrderManagement';

interface UseExpeditionActionsParams {
  kits: Kit[];
  loggedInUser: AppUser | null;
  orders: Order[];
}

export function useExpeditionActions({ kits, loggedInUser, orders }: UseExpeditionActionsParams) {
  const onUpdateStatus = async (id: string, status: OrderStatus, extra?: any) => {
    const orderToUpdate = orders.find(order => order.id === id);
    if (!orderToUpdate) return;

    await supabase.from('orders').update({
      data: cleanData({ ...orderToUpdate, ...extra, status })
    }).eq('id', id);
  };

  const onMarkGroupCollected = async (id: string, itemIds: string[]) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para marcar itens.' });
      return;
    }

    const order = orders.find(item => item.id === id);
    if (!order) return;

    const items = (order.items || []).map(item =>
      itemIds.includes(item.id) ? { ...item, isCollected: !item.isCollected } : item
    );

    let newStatus = order.status;
    const allServosAssigned = (items || []).filter(item => item.type === 'SERVO').every(item => !!item.guaranteeNumber);
    if (allServosAssigned && order.status === OrderStatus.PENDING) {
      newStatus = OrderStatus.AWAITING_EXPEDITION;
    }

    await supabase.from('orders').update({
      data: cleanData({ ...order, items, status: newStatus })
    }).eq('id', id);
  };

  const onCompleteExpedition = async (id: string, weight: string, volume: string) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para completar a expedição.' });
      return;
    }

    const order = orders.find(item => item.id === id);
    if (!order) return;

    if (order.status !== OrderStatus.AWAITING_EXPEDITION && order.status !== OrderStatus.READY) {
      toast.warning('Ação Inválida', {
        description: 'Este pedido já sofreu alteração de status por outro usuário.'
      });
      return;
    }

    const stockUpdates: { id: string; newQuantity: number }[] = [];
    const itemsWithKits = (order.items || []).filter(item =>
      (item.type === 'SERVO' || item.type === 'KIT') &&
      item.installationKit &&
      item.installationKit !== 'SEM KIT'
    );

    const kitCounts = new Map<string, number>();
    for (const item of itemsWithKits) {
      const subKits = normalizeKitName(item.installationKit!).split('/').map(subKit => subKit.trim());
      for (const subKit of subKits) {
        const normalized = safeToUpper(normalizeKitName(subKit));
        kitCounts.set(normalized, (kitCounts.get(normalized) || 0) + 1);
      }
    }

    for (const [kitName, quantityNeeded] of kitCounts.entries()) {
      const kitNamePrefix = kitName.startsWith('KIT') ? kitName : `KIT ${kitName}`;
      const matchingKits = kits.filter(kit =>
        safeToUpper(normalizeKitName(kit.name)) === safeToUpper(kitNamePrefix) ||
        safeToUpper(normalizeKitName(kit.name)) === safeToUpper(kitName)
      );

      let remainingToDeduct = quantityNeeded;
      for (const kit of matchingKits) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(kit.quantity, remainingToDeduct);
        stockUpdates.push({ id: kit.id, newQuantity: kit.quantity - deductAmount });
        remainingToDeduct -= deductAmount;
      }
    }

    for (const update of stockUpdates) {
      const targetKit = kits.find(kit => kit.id === update.id);
      if (targetKit) {
        await supabase.from('kits').update({
          data: cleanData({ ...targetKit, quantity: update.newQuantity })
        }).eq('id', update.id);
      }
    }

    const status = order.status === OrderStatus.READY
      ? OrderStatus.COMPLETED
      : (order.requiresInvoice === false ? OrderStatus.READY : OrderStatus.AWAITING_INVOICE);

    await supabase.from('orders').update({
      data: cleanData({
        ...order,
        status,
        weight,
        volume,
        dispatchedAt: status === OrderStatus.COMPLETED ? Date.now() : undefined
      })
    }).eq('id', id);
  };

  return {
    onUpdateStatus,
    onMarkGroupCollected,
    onCompleteExpedition
  };
}
