import { toast } from 'sonner';
import { AppUser, Order, OrderStatus } from '../types';
import { supabase } from '../supabase';
import { cleanData } from './useOrderManagement';

interface UseAdminActionsParams {
  orders: Order[];
  loggedInUser: AppUser | null;
}

export function useAdminActions({ orders, loggedInUser }: UseAdminActionsParams) {
  const updateStatus = async (id: string, status: OrderStatus, extra?: any) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para alterar o status.' });
      return;
    }

    const order = orders.find(item => item.id === id);
    if (!order) return;

    await supabase.from('orders').update({
      data: cleanData({ ...order, ...extra, status })
    }).eq('id', id);
  };

  return {
    updateStatus
  };
}
