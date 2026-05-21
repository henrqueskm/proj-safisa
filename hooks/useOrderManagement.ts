import React, { useEffect } from 'react';
import { supabase } from '../supabase';
import { Order, OrderStatus, AssembledUnit, AppUser, AuditLog } from '../types';
import { normalizeModelName, normalizeKitName } from '../constants';
import { generateId, safeToUpper } from '../lib/utils';
import { toast } from 'sonner';

const getGuaranteeLookupKey = (value: unknown) => safeToUpper(String(value ?? '').trim()).replace(/^A/, '');

export const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  try {
    const cache = new Set();
    const stringified = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return;
        cache.add(value);
      }
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'function' || key.startsWith('_')) return undefined;
      if (value && value.nodeType && value.nodeName) return undefined;
      return value;
    });
    return JSON.parse(stringified);
  } catch (e) {
    console.error("Erro ao limpar dados:", e);
    return typeof obj === 'object' ? {} : obj;
  }
};

export function useOrderManagement(
  orders: Order[],
  assembledUnits: AssembledUnit[],
  customers: any[],
  kits: any[],
  loggedInUserRef: React.MutableRefObject<AppUser | null>,
  isSyncing: boolean
) {
  const addAuditLog = async (action: string, details: string, targetId?: string, targetType?: AuditLog['targetType']) => {
    // Audit logs are disabled for performance reasons
  };

  useEffect(() => {
    if (isSyncing || orders.length === 0) return;
    const checkAndPromote = async () => {
      const activeOrders = orders
        .filter((o: any) => 
          o.status === OrderStatus.PENDING || 
          (o.status === OrderStatus.AWAITING_EXPEDITION && (o.items || []).some((i: any) => i.type === 'SERVO' && !i.guaranteeNumber))
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      
      if (activeOrders.length === 0) return;
      let availableStock = [...assembledUnits.filter(u => !u.isAssigned)];
      
      for (const order of activeOrders) {
        const unassignedServos = (order.items || []).filter(i => i.type === 'SERVO' && !i.guaranteeNumber);
        if (unassignedServos.length === 0) {
          if (order.status === OrderStatus.PENDING && (order.items || []).length > 0) {
             await supabase.from('orders').update({ data: cleanData({ ...order, status: OrderStatus.AWAITING_EXPEDITION }) }).eq('id', order.id);
          }
          continue;
        }

        let orderCanBeFullfilled = true;
        const tempStock = [...availableStock];
        for (const item of unassignedServos) {
          const itemOrientation = item.orientation || 'NORMAL';
          const stockMatchIndex = tempStock.findIndex(u => 
            normalizeModelName(u.model) === normalizeModelName(item.model) && (u.orientation || 'NORMAL') === itemOrientation
          );
          if (stockMatchIndex !== -1) {
            tempStock.splice(stockMatchIndex, 1);
          } else {
            orderCanBeFullfilled = false;
            break;
          }
        }
        if (orderCanBeFullfilled) {
          availableStock = tempStock;
          if (order.status === OrderStatus.PENDING) {
             await supabase.from('orders').update({ data: cleanData({ ...order, status: OrderStatus.AWAITING_EXPEDITION }) }).eq('id', order.id);
          }
        } else {
          if (order.status === OrderStatus.AWAITING_EXPEDITION) {
             await supabase.from('orders').update({ data: cleanData({ ...order, status: OrderStatus.PENDING }) }).eq('id', order.id);
          }
        }
      }
    };
    const debounceTimer = setTimeout(checkAndPromote, 1500);
    return () => clearTimeout(debounceTimer);
  }, [orders, assembledUnits, isSyncing]);

  const reconcileInventory = async () => {
    const { data: allOrdersData } = await supabase.from('orders').select('data');
    if (!allOrdersData) return;

    const assignedGuarantees = new Set<string>();
    allOrdersData.forEach(o => {
      const order = o.data;
      if (order && order.items) {
        (order.items || []).forEach((item: any) => {
          if (item.guaranteeNumber) {
            assignedGuarantees.add(getGuaranteeLookupKey(item.guaranteeNumber));
          }
        });
      }
    });

    const updates: Promise<any>[] = [];
    assembledUnits.forEach(unit => {
      const shouldBeAssigned = assignedGuarantees.has(getGuaranteeLookupKey(unit.guaranteeNumber));
      if (unit.isAssigned !== shouldBeAssigned) {
         updates.push(supabase.from('assembledunits').update({ data: cleanData({ ...unit, isAssigned: shouldBeAssigned }) }).eq('id', unit.id).then() as Promise<any>);
      }
    });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  };

  useEffect(() => {
    if (isSyncing || orders.length === 0 || assembledUnits.length === 0) return;
    const reconcileTimer = setTimeout(reconcileInventory, 3000);
    return () => clearTimeout(reconcileTimer);
  }, [orders, assembledUnits, isSyncing]);


  const addOrder = async (order: Order) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para cadastrar pedidos." });
      return;
    }
    await supabase.from('orders').upsert({ id: order.id, data: cleanData(order) });
    const custData = {
      name: safeToUpper(order.customerName),
      city: safeToUpper(order.city),
      carrier: safeToUpper(order.carrier),
      representative: safeToUpper(order.representative),
      lastPurchaseAt: Date.now()
    };
    const existing = customers.find(c => c.name === custData.name);
    if (existing) {
       await supabase.from('customers').update({ data: cleanData({ ...existing, ...custData }) }).eq('id', existing.id);
    } else {
       await supabase.from('customers').insert({ id: generateId(), data: cleanData(custData) });
    }
  };

  const deleteOrder = async (id: string) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para excluir pedidos." });
      return;
    }
    const order = orders.find(o => o.id === id);
    if (order) {
      const unitUpdates = (order.items || [])
        .filter(item => item.guaranteeNumber)
        .map(item => {
          const unit = assembledUnits.find(u => getGuaranteeLookupKey(u.guaranteeNumber) === getGuaranteeLookupKey(item.guaranteeNumber));
          if (unit) return supabase.from('assembledunits').update({ data: cleanData({ ...unit, isAssigned: false }) }).eq('id', unit.id).then() as Promise<any>;
          return null;
        })
        .filter(p => p !== null) as Promise<any>[];
      if (unitUpdates.length > 0) await Promise.all(unitUpdates);
    }
    await supabase.from('orders').delete().eq('id', id);
  };

  const deleteUnit = async (id: string) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para excluir unidades." });
      return;
    }
    const unit = assembledUnits.find(u => u.id === id);
    if (unit) {
      if (unit.isAssigned) {
        const order = orders.find((o: any) => (o.items || []).some((i: any) => getGuaranteeLookupKey(i.guaranteeNumber) === getGuaranteeLookupKey(unit.guaranteeNumber)));
        if (order) {
          const updatedItems = (order.items || []).map(i => 
            getGuaranteeLookupKey(i.guaranteeNumber) === getGuaranteeLookupKey(unit.guaranteeNumber) ? { ...i, guaranteeNumber: null } : i
          );
          await supabase.from('orders').update({ data: cleanData({ ...order, items: updatedItems }) }).eq('id', order.id);
        }
      }
    }
    await supabase.from('assembledunits').delete().eq('id', id);
  };

  const deleteKitGroup = async (model: string, name: string) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para excluir kits." });
      return;
    }
    const kitsToDelete = kits.filter(k => k.model === model && k.name === name);
    const deletePromises = kitsToDelete.map(k => supabase.from('kits').delete().eq('id', k.id));
    await Promise.all(deletePromises);
    toast.success(`Kits ${name} (${model}) removidos do estoque.`);
  };

  const onAssignBatch = async (orderId: string, assigns: { itemId: string, guaranteeNumber: string | null }[]) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para vincular garantias." });
      return;
    }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    for (const a of assigns) {
      const currentItem = (order.items || []).find(i => i.id === a.itemId);
      const currentGuarantee = currentItem?.guaranteeNumber;
      if (currentGuarantee && currentGuarantee !== a.guaranteeNumber) {
        const oldUnit = assembledUnits.find(u => getGuaranteeLookupKey(u.guaranteeNumber) === getGuaranteeLookupKey(currentGuarantee));
        if (oldUnit) await supabase.from('assembledunits').update({ data: cleanData({ ...oldUnit, isAssigned: false }) }).eq('id', oldUnit.id);
      }
      if (a.guaranteeNumber) {
        const newUnit = assembledUnits.find(u => getGuaranteeLookupKey(u.guaranteeNumber) === getGuaranteeLookupKey(a.guaranteeNumber));
        if (newUnit) await supabase.from('assembledunits').update({ data: cleanData({ ...newUnit, isAssigned: true }) }).eq('id', newUnit.id);
      }
    }
    const updatedItems = (order.items || []).map(item => {
      const assignment = assigns.find(a => a.itemId === item.id);
      return assignment ? { ...item, guaranteeNumber: assignment.guaranteeNumber || undefined } : item;
    });

    const isFullySeparated = updatedItems.every(item => {
      const isServoOk = item.type === 'SERVO' ? !!item.guaranteeNumber : true;
      const isCollectedOk = (item.type === 'REPAIR' || item.type === 'SPARE_PART') ? !!item.isCollected : true;
      const isKitOk = (item.type === 'SERVO' || item.type === 'KIT') && item.installationKit && item.installationKit !== 'SEM KIT' ? !!item.isKitConfirmed : true;
      return isServoOk && isCollectedOk && isKitOk;
    });

    let newStatus = order.status;
    const allServosAssigned = updatedItems.filter(i => i.type === 'SERVO').every(i => !!i.guaranteeNumber);
    if (allServosAssigned && order.status === OrderStatus.PENDING) {
      newStatus = OrderStatus.AWAITING_EXPEDITION;
    }

    await supabase.from('orders').update({ data: cleanData({ ...order, items: updatedItems, status: newStatus }) }).eq('id', orderId);
  };

  const onToggleGroupKit = async (id: string, itemIds: string[]) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para confirmar kits." });
      return;
    }
    const order = orders.find(o => o.id === id); if (!order) return;
    const allChecked = itemIds.every(iId => (order.items || []).find(i => i.id === iId)?.isKitConfirmed);
    const checking = !allChecked;

    const targetItem = (order.items || []).find(i => itemIds.includes(i.id));
    if (!targetItem || !targetItem.installationKit || targetItem.installationKit === 'SEM KIT') return;

    let modifiedItems = [...order.items];
    const subKits = normalizeKitName(targetItem.installationKit).split('/').map(s => s.trim());
    
    // Array of adjustments to pass to the RPC: { code: string, quantity: number } (positive means add to stock, negative means deduct)
    const kitAdjustments: { code: string, quantity: number, model: string }[] = [];

    if (checking) {
      const unconfirmedItemIds = itemIds.filter(iId => !(order.items || []).find(i => i.id === iId)?.isKitConfirmed);
      const itemsToConfirmSet = new Set(unconfirmedItemIds);

      for (const sub of subKits) {
        const kitNamePrefix = safeToUpper(sub).startsWith('KIT') ? sub : `KIT ${sub}`;
        const code = safeToUpper(normalizeKitName(kitNamePrefix));
        kitAdjustments.push({ code, quantity: -unconfirmedItemIds.length, model: targetItem.model });
      }
      
      modifiedItems = modifiedItems.map(i => itemsToConfirmSet.has(i.id) ? { ...i, isKitConfirmed: true } : i);
      toast.success("Kit Conferido", { description: "Kits confirmados com sucesso." });
    } else {
       const confirmedItemIds = itemIds.filter(iId => (order.items || []).find(i => i.id === iId)?.isKitConfirmed);
       if (confirmedItemIds.length > 0) {
         for (const sub of subKits) {
           const kitNamePrefix = safeToUpper(sub).startsWith('KIT') ? sub : `KIT ${sub}`;
           const code = safeToUpper(normalizeKitName(kitNamePrefix));
           kitAdjustments.push({ code, quantity: confirmedItemIds.length, model: targetItem.model });
         }
       }
       
       const confirmedItemIdsSet = new Set(confirmedItemIds);
       modifiedItems = modifiedItems.map(i => confirmedItemIdsSet.has(i.id) ? { ...i, isKitConfirmed: false } : i);
       toast.success("Kit Desmarcado", { description: "Kits retornados ao estoque." });
    }

    let newStatus = order.status;
    const allServosAssigned = modifiedItems.filter(i => i.type === 'SERVO').every(i => !!i.guaranteeNumber);
    if (order.status === OrderStatus.PENDING) {
      if (allServosAssigned) {
        newStatus = OrderStatus.AWAITING_EXPEDITION;
      }
    }

    try {
      // 1. Update order status and items
      const { error: orderError } = await supabase.from('orders')
        .update({ data: cleanData({ ...order, items: modifiedItems, status: newStatus }) })
        .eq('id', id);
      
      if (orderError) throw orderError;

      // 2. Process kit adjustments
      for (const adj of kitAdjustments) {
        if (adj.quantity > 0) {
          const newKit = {
              id: generateId(),
              data: {
                name: adj.code,
                quantity: adj.quantity,
                model: adj.model,
                updatedBy: loggedInUserRef.current.id,
                updatedByName: loggedInUserRef.current.name,
                observation: 'Ajuste de separação'
              }
          };
          const { error: insertError } = await supabase.from('kits').insert(newKit);
          if (insertError) throw insertError;
        } else if (adj.quantity < 0) {
          let remainingDeduction = Math.abs(adj.quantity);
          const { data: existingKitsData, error: kitError } = await supabase.from('kits').select('*');
          if (kitError) throw kitError;
          
          const matchingKits = (existingKitsData || []).filter(k => {
            const kName = (k.data?.name || '').toUpperCase();
            const target1 = adj.code.toUpperCase();
            const target2 = `KIT ${target1}`.toUpperCase();
            return (kName === target1 || kName === target2) && (k.data?.quantity || 0) > 0;
          });

          for (const kit of matchingKits) {
            if (remainingDeduction <= 0) break;
            const kitQty = kit.data.quantity;
            if (kitQty >= remainingDeduction) {
               const { error: updateError } = await supabase.from('kits').update({ data: { ...kit.data, quantity: kitQty - remainingDeduction } }).eq('id', kit.id);
               if (updateError) throw updateError;
               remainingDeduction = 0;
            } else {
               const { error: delError } = await supabase.from('kits').delete().eq('id', kit.id);
               if (delError) throw delError;
               remainingDeduction -= kitQty;
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Erro Transacional", { description: "Falha ao processar a baixa de kits no servidor: " + error.message });
    }
  };

  const onAdjustKitStock = async (params: { code: string, quantity: number, model?: string, observation?: string }) => {
    if (!loggedInUserRef.current) {
      toast.error("Ação Bloqueada", { description: "Você precisa estar logado para ajustar estoque." });
      return;
    }

    try {
      if (params.quantity > 0) {
        const id = generateId();
        const newKit = {
            id,
            data: {
              name: params.code,
              quantity: params.quantity,
              model: params.model || 'Geral',
              updatedBy: loggedInUserRef.current.id,
              updatedByName: loggedInUserRef.current.name,
              observation: params.observation || ''
            }
        };
        const { error } = await supabase.from('kits').insert(newKit);
        if (error) throw error;
      } else if (params.quantity < 0) {
        let remainingDeduction = Math.abs(params.quantity);
        
        const { data: existingKitsData, error: kitError } = await supabase.from('kits').select('*');
        if (kitError) throw kitError;
        
        const matchingKits = (existingKitsData || []).filter(k => {
          const kName = (k.data?.name || '').toUpperCase();
          const target1 = params.code.toUpperCase();
          const target2 = `KIT ${target1}`.toUpperCase();
          return (kName === target1 || kName === target2) && (k.data?.quantity || 0) > 0;
        });
        
        for (const kit of matchingKits) {
          if (remainingDeduction <= 0) break;
          
          const kitQty = kit.data.quantity;
          if (kitQty >= remainingDeduction) {
             const { error: updateError } = await supabase.from('kits').update({ data: { ...kit.data, quantity: kitQty - remainingDeduction } }).eq('id', kit.id);
             if (updateError) throw updateError;
             remainingDeduction = 0;
          } else {
             const { error: delError } = await supabase.from('kits').delete().eq('id', kit.id);
             if (delError) throw delError;
             remainingDeduction -= kitQty;
          }
        }
        
        if (remainingDeduction > 0) {
           toast.error("Aviso de Limite", { description: `Não foi possível deduzir todas as ${Math.abs(params.quantity)} unidades, faltaram ${remainingDeduction}.` });
        }
      }

      toast.success("Estoque Atualizado", { 
        description: params.quantity > 0 
          ? `${params.quantity} unidades adicionadas ao kit ${params.code}.` 
          : `${Math.abs(params.quantity)} unidades removidas do kit ${params.code}.` 
      });
    } catch (error: any) {
      toast.error("Erro no Ajuste", { description: error.message });
      throw error;
    }
  };

  const handleExportBackup = async () => {
    try {
      const collectionsToBackup = [
        'orders', 'assembledunits', 'kits', 'kitdata', 'servomodeldata', 
        'customers', 'kitimages', 'users', 'auditlogs', 'messages', 'config'
      ];
      const backupData: Record<string, any> = {};
      for (const colName of collectionsToBackup) {
        const { data } = await supabase.from(colName).select('*');
        backupData[colName] = (data || []).map((d: any) => ({ id: d.id, ...d.data }));
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `safisa_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success("Backup Concluído", { description: "O arquivo foi salvo no seu computador." });
    } catch (error) {
      console.error("Erro ao fazer backup:", error);
      toast.error("Erro no Backup", { description: "Não foi possível exportar os dados." });
    }
  };

  const handleImportBackup = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            let backupData = JSON.parse(text);
            
            if (backupData.__collections__) {
               backupData = { ...backupData, ...backupData.__collections__ };
               delete backupData.__collections__;
            }

            const keys = Object.keys(backupData);
            let summary: Record<string, number> = {};
            
            let totalToImport = 0;
            for (const colName of keys) {
              const items = backupData[colName];
              if (Array.isArray(items)) totalToImport += items.length;
              else if (typeof items === 'object' && items !== null) totalToImport += Object.keys(items).length;
            }

            const toastId = toast.loading(`Importando ${totalToImport} registros. Por favor, aguarde e não feche a página...`);
            let importedCount = 0;

            for (let colName of keys) {
              const targetTable = colName.toLowerCase();
              const items = backupData[colName];
              let count = 0;
              
              if (Array.isArray(items)) {
                for (const item of items) {
                  try {
                    const id = item.id || item.Id || item.ID || generateId();
                    const data = { ...item };
                    delete data.id; delete data.Id; delete data.ID;
                    await supabase.from(targetTable).upsert({ id, data });
                    count++;
                    importedCount++;
                    if (importedCount % 50 === 0) {
                       toast.loading(`Importando... ${importedCount} de ${totalToImport}`, { id: toastId });
                    }
                  } catch (e) { console.error(`Error importing ${colName} item`, e); }
                }
              } else if (typeof items === 'object' && items !== null) {
                const docIds = Object.keys(items);
                for (const docId of docIds) {
                  try {
                    const data = { ...items[docId] };
                    delete data.id; delete data.Id; delete data.ID;
                    await supabase.from(targetTable).upsert({ id: docId, data });
                    count++;
                    importedCount++;
                    if (importedCount % 50 === 0) {
                       toast.loading(`Importando... ${importedCount} de ${totalToImport}`, { id: toastId });
                    }
                  } catch (e) { console.error(`Error importing ${colName} docId: ${docId}`, e); }
                }
              }
              summary[targetTable] = count;
            }
            const totalItems = Object.values(summary).reduce((a, b) => a + b, 0);
            
            toast.success("Importação Concluída", { id: toastId, description: `Foram importados ${totalItems} registros com sucesso! Recarregue a página.` });

          }
        } catch (error: any) {
          console.error("Erro no processamento do backup:", error);
          toast.error("Processamento Interrompido", { description: error.message || "Verifique o arquivo e a conexão." });
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Erro ao importar backup:", error);
      toast.error("Erro na Importação", { description: "Não foi possível importar os dados. Verifique o arquivo." });
    }
  };

  return {
    addOrder,
    deleteOrder,
    deleteUnit,
    deleteKitGroup,
    onAssignBatch,
    onToggleGroupKit,
    onAdjustKitStock,
    reconcileInventory,
    handleExportBackup,
    handleImportBackup,
    addAuditLog
  };
}
