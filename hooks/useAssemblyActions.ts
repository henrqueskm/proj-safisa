import { toast } from 'sonner';
import { AppUser, AssembledUnit, Order, ServoOrientation } from '../types';
import { supabase } from '../supabase';
import { generateId, safeToUpper } from '../lib/utils';
import { cleanData } from './useOrderManagement';

const getGuaranteeLookupKey = (value: unknown) => safeToUpper(String(value ?? '').trim()).replace(/^A/, '');

interface UseAssemblyActionsParams {
  assembledUnits: AssembledUnit[];
  currentSequence: number;
  loggedInUser: AppUser | null;
  orders: Order[];
  setSequence: (value: number) => Promise<void>;
}

export function useAssemblyActions({
  assembledUnits,
  currentSequence,
  loggedInUser,
  orders,
  setSequence
}: UseAssemblyActionsParams) {
  const onAddBatch = async (units: AssembledUnit[]) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para registrar lotes.' });
      return;
    }

    if (units.length === 0) return;

    const promises = units.map(unit => supabase.from('assembledunits').upsert({ id: unit.id, data: cleanData(unit) }));
    await Promise.all(promises);

    const lastNumber = Math.max(...units.map(unit => Number(unit.guaranteeNumber)));
    if (lastNumber > currentSequence) {
      await setSequence(lastNumber);
    }
  };

  const onUpdateUnit = async (id: string, data: Partial<AssembledUnit>) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para atualizar unidades.' });
      return;
    }

    const currentUnit = assembledUnits.find(unit => unit.id === id);
    if (!currentUnit) {
      toast.error('Série não encontrada', { description: 'Atualize a tela e tente novamente.' });
      return;
    }

    await supabase.from('assembledunits').update({
      data: cleanData({ ...currentUnit, ...data })
    }).eq('id', id);
  };

  const onToggleOrderToday = async (id: string, value: boolean) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para alterar o planejamento.' });
      return;
    }

    const orderToUpdate = orders.find(order => order.id === id);
    if (!orderToUpdate) return;

    await supabase.from('orders').update({
      data: cleanData({ ...orderToUpdate, isSelectedForToday: value })
    }).eq('id', id);
  };

  const onReturnToStock = async (data: {
    guaranteeNumber: string;
    model?: string;
    orientation?: ServoOrientation;
    assembler?: string;
  }) => {
    if (!loggedInUser) {
      toast.error('Ação Bloqueada', { description: 'Você precisa estar logado para retornar séries ao estoque.' });
      return;
    }

    const guaranteeKey = getGuaranteeLookupKey(data.guaranteeNumber);
    if (!guaranteeKey) return;

    const linkedOrder = orders.find(order =>
      (order.items || []).some(item => getGuaranteeLookupKey(item.guaranteeNumber) === guaranteeKey)
    );

    if (linkedOrder) {
      const updatedItems = (linkedOrder.items || []).map(item =>
        getGuaranteeLookupKey(item.guaranteeNumber) === guaranteeKey
          ? { ...item, guaranteeNumber: undefined }
          : item
      );

      await supabase.from('orders').update({
        data: cleanData({ ...linkedOrder, items: updatedItems })
      }).eq('id', linkedOrder.id);
    }

    const existingUnit = assembledUnits.find(unit => getGuaranteeLookupKey(unit.guaranteeNumber) === guaranteeKey);
    if (existingUnit) {
      await supabase.from('assembledunits').update({
        data: cleanData({ ...existingUnit, isAssigned: false })
      }).eq('id', existingUnit.id);
      return;
    }

    const unitId = generateId();
    await supabase.from('assembledunits').upsert({
      id: unitId,
      data: cleanData({
        id: unitId,
        model: data.model || 'RETORNO',
        orientation: data.orientation || 'NORMAL',
        guaranteeNumber: guaranteeKey,
        assembler: data.assembler || 'RETORNO',
        assemblyDate: new Date().toISOString(),
        isAssigned: false
      })
    });
  };

  return {
    onAddBatch,
    onUpdateUnit,
    onToggleOrderToday,
    onReturnToStock
  };
}
