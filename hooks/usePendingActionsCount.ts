import { useMemo } from 'react';
import { Order, OrderStatus, UserRole } from '../types';

export function usePendingActionsCount(activeRole: UserRole | null, orders: Order[]) {
  return useMemo(() => {
    if (!activeRole) return 0;

    switch (activeRole) {
      case UserRole.ADMIN:
        return orders.filter(order => order.status === OrderStatus.AWAITING_INVOICE).length;
      case UserRole.ASSEMBLY:
        return orders.filter(order =>
          order.status === OrderStatus.PENDING &&
          order.isSelectedForToday &&
          (order.items || []).some(item => item.type === 'SERVO' && !item.guaranteeNumber)
        ).length;
      case UserRole.EXPEDITION:
        return orders.filter(order =>
          order.status === OrderStatus.AWAITING_EXPEDITION ||
          order.status === OrderStatus.READY
        ).length;
      default:
        return 0;
    }
  }, [activeRole, orders]);
}
