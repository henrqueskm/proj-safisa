import { safeFormatDate, safeToUpper } from '../lib/utils';

import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { AssembledUnit, Order, OrderStatus, ServoOrientation, Kit } from '../types';
import { SERVO_BASE_MODELS, getMissingItemsCount, ORIENTATION_LABELS, ORIENTATION_FULL_NAMES, normalizeModelName } from '../constants';
import { Sidebar } from './Sidebar';
import { Layers, CheckSquare, Square, Plus, ClipboardList, Box, Search, History, User, Calendar, Printer, X, Pencil, Settings, Bell, FileSpreadsheet, Upload, Package, Eye, EyeOff, Menu, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '../hooks/useAppContext';

interface AssemblyViewProps {
  units: AssembledUnit[];
  orders: Order[];
  kits: Kit[];
  manualQuantities: Record<string, Record<string, string>>;
  onAddBatch: (units: AssembledUnit[]) => void;
  onUpdateUnit: (id: string, data: Partial<AssembledUnit>) => void;
  currentSequence: number;
  onToggleOrderToday: (id: string, val: boolean) => void | Promise<void>;
  onToggleGroupKit: (id: string, itemIds: string[]) => void;
  onReturnToStock: (data: { guaranteeNumber: string; model?: string; orientation?: ServoOrientation; assembler?: string }) => Promise<void> | void;
  passwords: Record<string, string>;
  updateConfig: (d: any) => void;
  assemblers: string[];
}

const FIXED_SPREADSHEET_SEQUENCE = [
  "VF-040|NORMAL",
  "MC-040|NORMAL",
  "MC-040|REBAIXADO",
  "MBF-015|NORMAL",
  "MBF-015|DESLOCADO",
  "MBF-015|INVERTIDO_028",
  "BR-015|NORMAL",
  "BR-040|NORMAL",
  "BR-040|INVERTIDO_015_VF",
  "BR-040|INVERTIDO_028",
  "MBF-025|NORMAL",
  "MBF-025|INVERTIDO_015_VF",
  "MBF-032|NORMAL",
  "MBF-032|INVERTIDO_028",
  "CJ-015|NORMAL",
  "MBF-040|NORMAL",
  "MBF-040|INVERTIDO_028",
  "AL-10|NORMAL",
  "AL-10|INVERTIDO_028",
  "SAF-040|NORMAL"
];

const escapePrintHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getDateFilterValue = (dateVal: unknown) => {
  if (!dateVal) return '';

  if (typeof dateVal === 'string') {
    const value = dateVal.trim();
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;

    const brDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brDateMatch) return `${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`;
  }

  return safeFormatDate(dateVal, 'iso');
};

const getGuaranteeLookupKey = (value: unknown) => safeToUpper(String(value ?? '').trim()).replace(/^A/, '');

const printCleanHtml = (title: string, body: string, pageSize: 'portrait' | 'landscape' = 'landscape') => {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const doc = printWindow?.document;
  if (!printWindow || !doc) {
    frame.remove();
    return false;
  }

  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapePrintHtml(title)}</title>
        <style>
          @page { size: A4 ${pageSize}; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
          header { border-bottom: 2px solid #000; margin-bottom: 12px; padding-bottom: 8px; }
          h1 { margin: 0 0 4px; font-size: 18px; text-transform: uppercase; font-style: italic; letter-spacing: .02em; }
          .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #000; padding: 6px; text-align: center; vertical-align: middle; }
          th { background: #e5e5e5; font-weight: 800; text-transform: uppercase; }
          td { font-weight: 700; }
          .left { text-align: left; }
          .muted { color: #555; font-size: 10px; font-weight: 600; }
          .section-row td { background: #f1f1f1; text-align: left; font-weight: 900; text-transform: uppercase; }
          .empty { padding: 28px; text-align: center; font-weight: 800; text-transform: uppercase; color: #555; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `);
  doc.close();

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 150);

  return true;
};

const AssemblyView: React.FC<AssemblyViewProps> = ({ units, orders, kits, manualQuantities, onAddBatch, onUpdateUnit, currentSequence, onToggleOrderToday, onToggleGroupKit, onReturnToStock, passwords, updateConfig, assemblers }) => {
  const { loadCompletedOrders, setLoadCompletedOrders } = useAppContext();
  const [activeTab, setActiveTab] = useState<'planning' | 'production' | 'history' | 'returns' | 'spreadsheet'>('production');
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<AssembledUnit | null>(null);
  const [isStockProduction, setIsStockProduction] = useState(false);
  const [model, setModel] = useState(SERVO_BASE_MODELS[0]);
  const [orientation, setOrientation] = useState<ServoOrientation>('NORMAL');
  const [assembler, setAssembler] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [searchHistory, setSearchHistory] = useState('');
  const deferredSearchHistory = useDeferredValue(searchHistory);
  const [reportDate, setReportDate] = useState(safeFormatDate(Date.now(), 'iso'));
  const [showTabs, setShowTabs] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showQueueByOrder, setShowQueueByOrder] = useState(false);
  const [planningOverrides, setPlanningOverrides] = useState<Record<string, boolean>>({});
  const [returnSerial, setReturnSerial] = useState('');
  const [returnModel, setReturnModel] = useState(SERVO_BASE_MODELS[0]);
  const [returnOrientation, setReturnOrientation] = useState<ServoOrientation>('NORMAL');
  const [returnAssembler, setReturnAssembler] = useState('');
  const [isReturningToStock, setIsReturningToStock] = useState(false);

  useEffect(() => {
    if ((activeTab === 'history' || activeTab === 'returns') && setLoadCompletedOrders && !loadCompletedOrders) {
      setLoadCompletedOrders(true);
    }
  }, [activeTab, loadCompletedOrders, setLoadCompletedOrders]);

  useEffect(() => {
    setPlanningOverrides(current => {
      let changed = false;
      const next = { ...current };

      orders.forEach(order => {
        if (next[order.id] !== undefined && !!order.isSelectedForToday === next[order.id]) {
          delete next[order.id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [orders]);

  React.useEffect(() => {
    let needsUpdate = false;
    const normalized: Record<string, Record<string, string>> = {};
    Object.entries(manualQuantities || {}).forEach(([k, v]: [string, Record<string, string>]) => {
      const [m, o] = k.split('|');
      const normKey = `${normalizeModelName(m)}|${o}`;
      if (k !== normKey) {
        needsUpdate = true;
      }
      normalized[normKey] = { ...(normalized[normKey] || {}), ...(v || {}) };
    });
    if (needsUpdate) {
      updateConfig({ manualQuantities: normalized });
    }
  }, [manualQuantities, updateConfig]);

  const handleManualQtyChange = (model: string, orientation: string, field: string, value: string) => {
    const key = `${normalizeModelName(model)}|${orientation}`;
    const updated = {
      ...manualQuantities,
      [key]: {
        ...(manualQuantities[key] || {}),
        [field]: value
      }
    };
    updateConfig({ manualQuantities: updated });
  };

  const planningOrders = useMemo(() => {
    return orders.map(order => {
      const override = planningOverrides[order.id];
      return override === undefined ? order : { ...order, isSelectedForToday: override };
    });
  }, [orders, planningOverrides]);

  const selectedOrders = useMemo(() => planningOrders.filter(o => (o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION) && o.isSelectedForToday), [planningOrders]);
  const pendingOrders = useMemo(() => planningOrders.filter(o => (o.status === OrderStatus.PENDING || o.status === OrderStatus.AWAITING_EXPEDITION) && !o.isSelectedForToday), [planningOrders]);

  const handleToggleOrderToday = (id: string, val: boolean) => {
    setPlanningOverrides(current => ({ ...current, [id]: val }));

    Promise.resolve(onToggleOrderToday(id, val)).catch(() => {
      setPlanningOverrides(current => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      toast.error("Nao foi possivel atualizar o planejamento.");
    });
  };

  const productionQueue = useMemo(() => {
    const queue: Record<string, { model: string; orientation: ServoOrientation; needed: number; assembled: number; linked: number }> = {};
    selectedOrders.forEach(order => {
      (order.items || []).filter(i => i.type === 'SERVO').forEach(item => {
        const orient = item.orientation || 'NORMAL';
        const normModel = normalizeModelName(item.model);
        const key = `${normModel}_${orient}`;
        if (!queue[key]) queue[key] = { model: normModel, orientation: orient, needed: 0, assembled: 0, linked: 0 };
        
        if (item.guaranteeNumber) {
          queue[key].linked += 1;
        } else {
          queue[key].needed += 1;
        }
      });
    });
    units.filter(u => !u.isAssigned).forEach(u => {
      const orient = u.orientation || 'NORMAL';
      const normModel = normalizeModelName(u.model);
      const key = `${normModel}_${orient}`;
      if (queue[key]) queue[key].assembled += 1;
    });
    // Filter out items that have 0 needed (even if they have linked items) so we don't clutter the queue with fully linked items
    // Wait, if we filter them out, they won't be identified. Let's keep them if needed > 0 or linked > 0
    return Object.entries(queue).filter(([_, stats]) => stats.needed > 0 || stats.linked > 0).sort((a, b) => b[1].needed - a[1].needed);
  }, [selectedOrders, units]);

  const productionQueueByOrder = useMemo(() => {
    return selectedOrders
      .map(order => {
        const groups: Record<string, { model: string; orientation: ServoOrientation; quantity: number }> = {};

        (order.items || [])
          .filter(item => item.type === 'SERVO' && !item.guaranteeNumber)
          .forEach(item => {
            const orientation = item.orientation || 'NORMAL';
            const modelName = normalizeModelName(item.model);
            const key = `${modelName}|${orientation}`;
            if (!groups[key]) {
              groups[key] = { model: modelName, orientation, quantity: 0 };
            }
            groups[key].quantity += 1;
          });

        return {
          order,
          items: Object.values(groups).sort((a, b) => a.model.localeCompare(b.model) || a.orientation.localeCompare(b.orientation)),
          totalNeeded: Object.values(groups).reduce((sum, item) => sum + item.quantity, 0)
        };
      })
      .filter(group => group.totalNeeded > 0)
      .sort((a, b) => a.order.createdAt - b.order.createdAt);
  }, [selectedOrders]);

  const filteredHistory = useMemo(() => {
    const q = safeToUpper(deferredSearchHistory);
    return units
      .filter(u => {
        const matchesQuery = u.guaranteeNumber.includes(q) || 
                             safeToUpper(u.model).includes(q) || 
                             safeToUpper(u.assembler).includes(q);
        const matchesDate = getDateFilterValue(u.assemblyDate) === reportDate;
        
        // Se houver busca, ignora o filtro de data para encontrar o número em qualquer dia
        return q ? matchesQuery : matchesDate;
      })
      .sort((a, b) => parseInt(b.guaranteeNumber) - parseInt(a.guaranteeNumber));
  }, [units, deferredSearchHistory, reportDate]);

  const guaranteeCustomerMap = useMemo(() => {
    const map = new Map<string, string>();

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!item.guaranteeNumber) return;
        const key = getGuaranteeLookupKey(item.guaranteeNumber);
        if (key && !map.has(key)) {
          map.set(key, order.customerName);
        }
      });
    });

    return map;
  }, [orders]);

  const getGuaranteeCustomerName = (guaranteeNumber: string) =>
    guaranteeCustomerMap.get(getGuaranteeLookupKey(guaranteeNumber)) || '';

  const returnLookup = useMemo(() => {
    const key = getGuaranteeLookupKey(returnSerial);
    if (!key) return null;

    const unit = units.find(u => getGuaranteeLookupKey(u.guaranteeNumber) === key) || null;
    let linkedOrder: Order | null = null;
    let linkedItem: any = null;

    for (const order of orders) {
      const item = (order.items || []).find(i => getGuaranteeLookupKey(i.guaranteeNumber) === key);
      if (item) {
        linkedOrder = order;
        linkedItem = item;
        break;
      }
    }

    return { key, unit, linkedOrder, linkedItem };
  }, [returnSerial, units, orders]);

  const handleReturnToStock = async () => {
    const guaranteeNumber = getGuaranteeLookupKey(returnSerial);
    if (!guaranteeNumber) {
      toast.error("Informe o numero de garantia.");
      return;
    }

    if (!returnLookup?.unit && !returnAssembler) {
      toast.error("Informe o montador/responsavel para cadastrar a garantia no estoque.");
      return;
    }

    const customerName = returnLookup?.linkedOrder?.customerName;
    const message = customerName
      ? `Retornar a serie A${guaranteeNumber} ao estoque e desvincular do pedido de ${customerName}?`
      : `Retornar a serie A${guaranteeNumber} ao estoque?`;

    if (!window.confirm(message)) return;

    try {
      setIsReturningToStock(true);
      await onReturnToStock({
        guaranteeNumber,
        model: returnLookup?.unit?.model || returnModel,
        orientation: returnLookup?.unit?.orientation || returnOrientation,
        assembler: returnLookup?.unit?.assembler || returnAssembler
      });
      toast.success(`Serie A${guaranteeNumber} retornada ao estoque.`);
      setReturnSerial('');
      setReturnAssembler('');
    } catch {
      toast.error("Nao foi possivel retornar a serie ao estoque.");
    } finally {
      setIsReturningToStock(false);
    }
  };

  const handleOpenForm = (m?: string, o?: ServoOrientation) => {
    if (m && o) {
      setModel(m);
      setOrientation(o);
      setIsStockProduction(false);
    } else {
      setModel(SERVO_BASE_MODELS[0]);
      setOrientation('NORMAL');
      setIsStockProduction(true);
    }
    setShowForm(true);
  };

  const spreadsheetTable = useMemo(() => {
    const pendingOrdersList = orders
      .filter(o => o.status === OrderStatus.PENDING)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    const rows = FIXED_SPREADSHEET_SEQUENCE.map(key => {
      const [model, orientation] = key.split('|');
      const orderQuantities = pendingOrdersList.map(order => {
        return (order.items || []).filter(i => i.type === 'SERVO' && normalizeModelName(i.model) === model && (i.orientation || 'NORMAL') === orientation && !i.guaranteeNumber).length;
      });
      const stockCount = units.filter(u => !u.isAssigned && normalizeModelName(u.model) === model && (u.orientation || 'NORMAL') === orientation).length;
      const total = orderQuantities.reduce((a, b) => a + b, 0);
      return { model, orientation, orderQuantities, stockCount, total };
    });

    const columnTotals = pendingOrdersList.map((_, idx) => rows.reduce((sum, row) => sum + row.orderQuantities[idx], 0));
    const totalStock = rows.reduce((sum, row) => sum + row.stockCount, 0);
    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

    return {
      headers: pendingOrdersList.map(o => ({
        name: o.customerName,
        date: o.createdAt ? safeFormatDate(o.createdAt) : 'N/D'
      })),
      rows,
      columnTotals,
      totalStock,
      grandTotal
    };
  }, [orders, units]);

  const todayAssemblyUnits = useMemo(
    () => units.filter(u => getDateFilterValue(u.assemblyDate) === getDateFilterValue(Date.now())),
    [units]
  );

  const renderPrintHeader = (title: string, leftMeta: string, rightMeta: string) => `
    <header>
      <h1>${escapePrintHtml(title)}</h1>
      <div class="meta">
        <span>${escapePrintHtml(leftMeta)}</span>
        <span>${escapePrintHtml(rightMeta)}</span>
      </div>
    </header>
  `;

  const handlePrintProductionQueue = () => {
    const issueDate = safeFormatDate(Date.now());
    const title = showQueueByOrder ? 'SAFISA - FILA DE PRODUCAO POR PEDIDO' : 'SAFISA - FILA DE PRODUCAO DIARIA';
    const header = renderPrintHeader(title, `Data de emissao: ${issueDate}`, `Total de pedidos: ${selectedOrders.length}`);

    const table = showQueueByOrder
      ? `
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Modelo de Servo</th>
              <th>Orientacao</th>
              <th>Necess.</th>
              <th>OK ( )</th>
              <th>Anotacoes</th>
            </tr>
          </thead>
          <tbody>
            ${productionQueueByOrder.length === 0 ? `
              <tr><td class="empty" colspan="6">Nenhum servo pendente por pedido</td></tr>
            ` : productionQueueByOrder.map(({ order, items, totalNeeded }) => `
              <tr class="section-row">
                <td colspan="6">${escapePrintHtml(order.customerName)} - ${escapePrintHtml(safeFormatDate(order.createdAt) || 'Sem data')} - Total: ${totalNeeded}</td>
              </tr>
              ${items.map(item => `
                <tr>
                  <td class="left">${escapePrintHtml(order.customerName)}</td>
                  <td class="left">${escapePrintHtml(item.model)}</td>
                  <td>${escapePrintHtml(ORIENTATION_FULL_NAMES[item.orientation])}</td>
                  <td>${item.quantity}</td>
                  <td>[ &nbsp; ]</td>
                  <td></td>
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      `
      : `
        <table>
          <thead>
            <tr>
              <th>Modelo de Servo</th>
              <th>Orientacao</th>
              <th>Necess.</th>
              <th>Montado</th>
              <th>OK ( )</th>
              <th>Anotacoes</th>
            </tr>
          </thead>
          <tbody>
            ${productionQueue.filter(([_, stats]) => stats.needed > 0).length === 0 ? `
              <tr><td class="empty" colspan="6">Sem demanda programada</td></tr>
            ` : productionQueue.filter(([_, stats]) => stats.needed > 0).map(([key, stats]) => `
              <tr>
                <td class="left">
                  ${escapePrintHtml(stats.model)}
                  ${stats.linked > 0 ? `<div class="muted">${stats.linked} ja vinculado(s)</div>` : ''}
                </td>
                <td>${escapePrintHtml(ORIENTATION_FULL_NAMES[stats.orientation])}</td>
                <td>${stats.needed}</td>
                <td>${stats.assembled}</td>
                <td>[ &nbsp; ]</td>
                <td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

    if (!printCleanHtml(title, `${header}${table}`, 'landscape')) {
      toast.error('Nao foi possivel abrir a impressao.');
    }
  };

  const handlePrintAssemblyHistory = (items = filteredHistory, title = 'RELATORIO DE PRODUCAO SAFISA', meta?: string) => {
    const label = meta || (searchHistory ? `Busca: ${safeToUpper(searchHistory)} (todas as datas)` : `Data: ${reportDate ? safeFormatDate(reportDate + 'T00:00:00') : ''}`);
    const header = renderPrintHeader(title, label, `Total: ${items.length} unidades`);
    const table = `
      <table>
        <thead>
          <tr>
            <th>Garantia</th>
            <th>Data</th>
            <th>Modelo</th>
            <th>Orientacao</th>
            <th>Montador</th>
            <th>Cliente</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `
            <tr><td class="empty" colspan="6">Nenhum registro nesta data / filtro</td></tr>
          ` : items.map(u => `
            <tr>
              <td>A${escapePrintHtml(u.guaranteeNumber)}</td>
              <td>${escapePrintHtml(safeFormatDate(u.assemblyDate))}</td>
              <td class="left">${escapePrintHtml(u.model)}</td>
              <td>${escapePrintHtml(ORIENTATION_FULL_NAMES[u.orientation || 'NORMAL'])}</td>
              <td>${escapePrintHtml(u.assembler)}</td>
              <td class="left">${escapePrintHtml(getGuaranteeCustomerName(u.guaranteeNumber))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    if (!printCleanHtml(title, `${header}${table}`, 'portrait')) {
      toast.error('Nao foi possivel abrir a impressao.');
    }
  };

  const handlePrintTodayAssembly = () => {
    const sortedToday = [...todayAssemblyUnits].sort((a,b) => parseInt(b.guaranteeNumber) - parseInt(a.guaranteeNumber));
    handlePrintAssemblyHistory(sortedToday, 'SAFISA - MONTAGENS DE HOJE', `Data: ${safeFormatDate(Date.now())}`);
  };

  const handlePrintSpreadsheet = () => {
    const title = 'SAFISA - PLANILHA DE PRODUCAO';
    const header = renderPrintHeader(title, `Data de emissao: ${safeFormatDate(Date.now())}`, `Total geral: ${spreadsheetTable.grandTotal}`);
    const fields = [
      ['semimontados', 'Semimont.'],
      ['corpos', 'Corpos'],
      ['zinco', 'Zinco'],
      ['usinagem', 'Usinagem'],
      ['matPrima', 'Mat.Prima']
    ];
    const table = `
      <table>
        <thead>
          <tr>
            <th>Modelo</th>
            <th>Orientacao</th>
            <th>Total</th>
            ${spreadsheetTable.headers.map(header => `<th>${escapePrintHtml(header.name)}</th>`).join('')}
            <th>Estoque</th>
            ${fields.map(([_, label]) => `<th>${escapePrintHtml(label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${spreadsheetTable.rows.map(row => {
            const rowKey = `${row.model}|${row.orientation}`;
            return `
              <tr>
                <td class="left">${escapePrintHtml(row.model.replace(/\s*\([^)]*\)\s*/g, ''))}</td>
                <td>${escapePrintHtml(ORIENTATION_FULL_NAMES[row.orientation])}</td>
                <td>${row.total || ''}</td>
                ${row.orderQuantities.map(qty => `<td>${qty || ''}</td>`).join('')}
                <td>${row.stockCount || ''}</td>
                ${fields.map(([field]) => `<td>${escapePrintHtml(manualQuantities[rowKey]?.[field] || '')}</td>`).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th class="left" colspan="2">Total Geral</th>
            <th>${spreadsheetTable.grandTotal || ''}</th>
            ${spreadsheetTable.columnTotals.map(total => `<th>${total || ''}</th>`).join('')}
            <th>${spreadsheetTable.totalStock || ''}</th>
            ${fields.map(([field]) => {
              const total = spreadsheetTable.rows.reduce((sum, row) => {
                const val = manualQuantities[`${row.model}|${row.orientation}`]?.[field];
                return sum + (parseInt(val) || 0);
              }, 0);
              return `<th>${total || ''}</th>`;
            }).join('')}
          </tr>
        </tfoot>
      </table>
    `;

    if (!printCleanHtml(title, `${header}${table}`, 'landscape')) {
      toast.error('Nao foi possivel abrir a impressao.');
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <style>{`
        @media print {
          @page { size: landscape; }
          .print-header { display: block !important; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table th, .print-table td { border: 1px solid #000 !important; padding: 8px; text-align: center !important; font-size: 12px; color: #000 !important; }
          .print-table th.print-thick-border, .print-table td.print-thick-border { border-left: 3px solid #000 !important; }
          .print-table th { background-color: #e5e5e5 !important; font-weight: bold !important; }
          .print-table td { font-weight: bold !important; }
          .no-print { display: none !important; }
          body { font-size: 12px; color: black; background: white; }
          .card-production { border: 1px solid black !important; break-inside: avoid; }
        }
      `}</style>

      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title="Montagem"
        tabs={[
          { id: 'production', label: 'Produção', icon: <Layers size={18} /> },
          { id: 'planning', label: 'Planejamento', icon: <ClipboardList size={18} /> },
          { id: 'history', label: 'Histórico', icon: <History size={18} /> },
          { id: 'returns', label: 'Retorno', icon: <RotateCcw size={18} /> },
          { id: 'spreadsheet', label: 'Planilha', icon: <FileSpreadsheet size={18} /> }
        ]}
        activeTab={activeTab}
        onTabChange={(id) => {
          setActiveTab(id as any);
        }}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-70' : ''}`}>
        <div className="w-full p-3 md:p-6 space-y-8 pb-12">
          {/* Header com Navegação Principal e Busca */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between no-print bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors border border-slate-600 shadow-sm"
               aria-label="Botão">
                <Menu size={20} />
              </button>
              <h2 className="text-3xl font-semibold text-white tracking-tight">
                Montagem - {
                  [
                    { id: 'production', label: 'Produção' },
                    { id: 'planning', label: 'Planejamento' },
                    { id: 'history', label: 'Histórico' },
                    { id: 'returns', label: 'Retorno' },
                    { id: 'spreadsheet', label: 'Planilha' }
                  ].find(t => t.id === activeTab)?.label
                }
              </h2>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 shadow-inner">
              <div className="flex flex-col items-end leading-none">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Proxima serie</span>
                <span className="font-mono text-2xl font-black text-white italic tracking-tight">A{currentSequence + 1}</span>
              </div>
            </div>
          </div>

      {activeTab === 'planning' && (
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="space-y-4">
              <div className="flex justify-between items-center ml-2">
                 <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">Prioridade de Hoje ({selectedOrders.length})</h3>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                 <table className="w-full text-left border-collapse">
                   <tbody className="divide-y divide-slate-700/50">
                     {selectedOrders.map(o => (
                       <tr key={o.id} onClick={() => handleToggleOrderToday(o.id, false)} className="hover:bg-slate-700/50 cursor-pointer transition-colors group">
                          <td className="p-4 w-full">
                            <div className="flex justify-between items-center">
                              <div>
                                 <span className="font-semibold text-white uppercase text-sm group-hover:text-slate-200 transition-colors">{o.customerName}</span>
                                 <div className="flex items-center gap-2 mt-1">
                                   <span className="text-xs text-slate-400">{o.city}</span>
                                   <span className="text-xs font-semibold text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded-md">
                                     {(o.items || []).length} un
                                   </span>
                                   {getMissingItemsCount(o) > 0 && <span className="text-[10px] font-semibold text-amber-400">({getMissingItemsCount(o)} falt.)</span>}
                                 </div>
                              </div>
                              <CheckSquare className="text-slate-400 shrink-0" size={24} />
                            </div>
                          </td>
                       </tr>
                     ))}
                     {selectedOrders.length === 0 && (
                        <tr>
                          <td className="p-8 text-center text-slate-500 text-sm">Nenhum pedido marcado como prioridade para hoje</td>
                        </tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
           <div className="space-y-4">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-2">Carteira Pendente ({pendingOrders.length})</h3>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden shadow-sm">
                 <table className="w-full text-left border-collapse opacity-70 hover:opacity-100 transition-opacity">
                   <tbody className="divide-y divide-slate-700/50">
                     {pendingOrders.map(o => (
                       <tr key={o.id} onClick={() => handleToggleOrderToday(o.id, true)} className="hover:bg-slate-700/50 cursor-pointer transition-colors">
                          <td className="p-4 w-full">
                             <div className="flex justify-between items-center">
                               <div>
                                  <span className="font-semibold text-slate-300 uppercase text-sm">{o.customerName}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-400">{o.city}</span>
                                    <span className="text-xs font-semibold text-slate-300 bg-slate-700 px-2 py-0.5 rounded-md">
                                      {(o.items || []).length} un
                                    </span>
                                    {getMissingItemsCount(o) > 0 && <span className="text-[10px] font-semibold text-slate-400">({getMissingItemsCount(o)} falt.)</span>}
                                  </div>
                               </div>
                               <Square className="text-slate-500 shrink-0" size={24} />
                             </div>
                          </td>
                       </tr>
                     ))}
                     {pendingOrders.length === 0 && (
                        <tr>
                          <td className="p-8 text-center text-slate-500 text-sm">Não há pedidos pendentes</td>
                        </tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'production' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-1 space-y-4 no-print">
              <button 
                onClick={() => handleOpenForm()} 
                className="stock-production-button w-full bg-slate-950/50 border-2 border-dashed border-slate-700 p-6 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-all group"
               aria-label="Produzir para Estoque">
                <Plus size={24} className="mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Produzir para Estoque</span>
              </button>

              <div className="pt-4 space-y-4">
                <div className="flex justify-between items-center gap-3 ml-2">
                   <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     {showQueueByOrder ? 'Fila por Pedido' : 'Fila de Produção'}
                   </h3>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => setShowQueueByOrder(value => !value)}
                       className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                       aria-label={showQueueByOrder ? 'Mostrar fila geral' : 'Expandir fila por pedido'}
                       title={showQueueByOrder ? 'Mostrar fila geral' : 'Expandir fila por pedido'}
                     >
                       {showQueueByOrder ? <EyeOff size={14} /> : <Eye size={14} />}
                       {showQueueByOrder ? 'Geral' : 'Pedidos'}
                     </button>
                     <button onClick={handlePrintProductionQueue} title="Imprimir Fila de Produção" className="p-2 bg-white rounded-xl border hover:bg-slate-50 transition-colors" aria-label="Imprimir Fila de Produção"><Printer size={16}/></button>
                   </div>
                </div>
                {showQueueByOrder ? (
                  productionQueueByOrder.length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-700 rounded-xl text-center opacity-40">
                       <ClipboardList size={32} className="mx-auto mb-2 text-slate-500" />
                       <p className="text-[10px] font-semibold uppercase text-slate-500">Nenhum servo pendente por pedido</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {productionQueueByOrder.map(({ order, items, totalNeeded }) => (
                        <div key={order.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white uppercase truncate">{order.customerName}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] font-semibold uppercase text-slate-500">
                                  <span>{safeFormatDate(order.createdAt) || 'Sem data'}</span>
                                  <span>{order.carrier || 'Sem transportadora'}</span>
                                </div>
                              </div>
                              <span className="shrink-0 bg-slate-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black">
                                {totalNeeded}
                              </span>
                            </div>
                          </div>
                          <div className="divide-y divide-slate-700/50">
                            {items.map(item => (
                              <div key={`${order.id}-${item.model}-${item.orientation}`} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-700/30 transition-colors">
                                <div className="min-w-0">
                                  <span className="block text-xs font-semibold text-white uppercase truncate">{item.model}</span>
                                  <span className="block text-[9px] text-slate-500 font-medium uppercase">{ORIENTATION_LABELS[item.orientation]}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-black text-slate-300 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">{item.quantity} un</span>
                                  <button
                                    onClick={() => handleOpenForm(item.model, item.orientation)}
                                    className="p-2 bg-slate-900 border border-slate-700 text-slate-400 rounded-lg hover:text-white hover:border-slate-500 transition-all"
                                    aria-label="Produzir servo do pedido"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : productionQueue.length === 0 ? (
                  <div className="p-10 border border-dashed border-slate-700 rounded-xl text-center opacity-40">
                     <ClipboardList size={32} className="mx-auto mb-2 text-slate-500" />
                     <p className="text-[10px] font-semibold uppercase text-slate-500">Sem demanda programada</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 border-b border-slate-700 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                            <th className="p-3">Servo</th>
                            <th className="p-3 text-center">Progresso</th>
                            <th className="p-3 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {productionQueue.map(([key, stats]) => (
                            <tr key={key} className="hover:bg-slate-700/30 transition-colors">
                              <td className="p-3">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-white">{stats.model}</span>
                                  <span className="text-[9px] text-slate-500 font-medium uppercase">{ORIENTATION_LABELS[stats.orientation]}</span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {stats.needed > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-semibold text-white">{stats.assembled}/{stats.needed}</span>
                                    <div className="w-12 h-1 bg-slate-900 rounded-full overflow-hidden">
                                      <div className="h-full bg-slate-500" style={{ width: `${Math.min(100, (stats.assembled/stats.needed)*100)}%` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <CheckSquare className="text-emerald-500 mx-auto" size={14} />
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleOpenForm(stats.model, stats.orientation)}
                                  className="p-2 bg-slate-900 border border-slate-700 text-slate-400 rounded-lg hover:text-white hover:border-slate-500 transition-all"
                                 aria-label="Botão">
                                  <Plus size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
           </div>

           {/* Layout de Impressão da Fila de Produção (Escondido na tela) */}
           <div className="hidden print-only print:block w-full">
              <div className="print-header">
                <h1 className="text-xl font-bold uppercase italic">SAFISA - FILA DE PRODUÇÃO DIÁRIA</h1>
                <p className="text-[10px] font-bold uppercase">DATA DE EMISSÃO: {safeFormatDate(Date.now())}</p>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th className="w-1/2 text-center">MODELO DE SERVO</th>
                    <th className="w-20 text-center">ORI.</th>
                    <th className="w-20 text-center">NECESS.</th>
                    <th className="w-20 text-center">OK ( )</th>
                    <th className="text-center">ANOTAÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {productionQueue.filter(([_, stats]) => stats.needed > 0).map(([key, stats]) => (
                    <tr key={key}>
                      <td className="font-bold text-center">
                        {stats.model}
                        {stats.linked > 0 && <span className="block text-[10px] text-gray-600 font-normal">({stats.linked} já vinculado)</span>}
                      </td>
                      <td className="text-center">{ORIENTATION_FULL_NAMES[stats.orientation]}</td>
                      <td className="text-center font-bold">{stats.needed}</td>
                      <td className="text-center">[ &nbsp; ]</td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
           
           <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm no-print">
                <div className="bg-slate-900 px-8 py-5 border-b border-slate-700 font-semibold text-[10px] text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <div className="flex items-center gap-2"><Box size={14} /> Montagens Hoje</div>
                  <button onClick={handlePrintTodayAssembly} className="text-slate-400 hover:text-white transition-colors" aria-label="Imprimir"><Printer size={16}/></button>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-slate-700 text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
                        <th className="px-8 py-3 w-32">Garantia</th>
                        <th className="px-4 py-3">Modelo</th>
                        <th className="px-4 py-3">Montador</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {[...todayAssemblyUnits].sort((a,b) => parseInt(b.guaranteeNumber) - parseInt(a.guaranteeNumber)).map(u => (
                        <tr key={u.id} className="hover:bg-slate-900 transition-colors group">
                           <td className="px-8 py-4">
                              <span className="font-mono font-semibold text-white text-base italic tracking-tighter">A{u.guaranteeNumber}</span>
                           </td>
                           <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-300 uppercase leading-none">{u.model}</span>
                                 <span className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">{u.orientation ? ORIENTATION_FULL_NAMES[u.orientation] : 'NORMAL'}</span>
                              </div>
                           </td>
                           <td className="px-4 py-4">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase">{u.assembler}</span>
                           </td>
                           <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditingUnit(u)}
                                  className="p-2 text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded-lg transition-all"
                                  title="Editar Modelo/Orientação"
                                 aria-label="Editar Modelo/Orientação">
                                  <Pencil size={14} />
                                </button>
                                <div className={`w-2 h-2 rounded-full ml-1 ${u.isAssigned ? 'bg-slate-700' : 'bg-emerald-400 animate-pulse'}`}></div>
                              </div>
                           </td>
                        </tr>
                      ))}
                      {todayAssemblyUnits.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center opacity-20">
                            <Layers size={40} className="mx-auto mb-2 text-slate-500" />
                            <p className="text-[10px] font-semibold uppercase">Nenhum registro hoje</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        </div>
      )}

       {showForm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-slate-800 p-10 rounded-xl shadow-2xl w-full max-w-2xl space-y-8 animate-in zoom-in-95">
             <div className="flex justify-between items-center text-white">
                <h3 className="text-xl font-bold uppercase italic tracking-tighter flex items-center gap-2">
                  <Layers size={20} /> {isStockProduction ? 'Produção para Estoque' : 'Registro de Produção'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400" aria-label="Botão"><X size={20}/></button>
             </div>
             
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Modelo</label>
                   {isStockProduction ? (
                     <select value={model} onChange={e => setModel(e.target.value)} className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-semibold text-sm uppercase outline-none focus:border-white">
                        {SERVO_BASE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                   ) : (
                     <input readOnly value={model} className="w-full px-5 py-3 bg-slate-700 text-white rounded-xl font-semibold text-sm uppercase" />
                   )}
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Montador</label>
                   <select value={assembler} onChange={e => setAssembler(e.target.value)} className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-semibold text-sm outline-none focus:border-white">
                      <option value="">ESCOLHER...</option>
                      {assemblers.map(a => <option key={a} value={a}>{a}</option>)}
                   </select>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Orientação</label>
                   {isStockProduction ? (
                     <select value={orientation} onChange={e => setOrientation(e.target.value as ServoOrientation)} className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-semibold text-sm uppercase outline-none focus:border-white">
                        {Object.entries(ORIENTATION_FULL_NAMES).map(([key, value]) => (
                          <option key={key} value={key}>{value}</option>
                        ))}
                     </select>
                   ) : (
                     <input readOnly value={ORIENTATION_FULL_NAMES[orientation]} className="w-full px-5 py-3 bg-slate-700 text-white rounded-xl font-semibold text-sm uppercase" />
                   )}
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Início Sequência</label>
                   <input readOnly value={currentSequence + 1} className="w-full px-5 py-3 bg-slate-700 text-white rounded-xl font-semibold font-mono text-lg" />
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Quantidade a Registrar</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-semibold font-mono text-lg outline-none focus:border-white" />
             </div>

             <div className="flex gap-4 pt-4">
                <button onClick={() => {
                  const parsedQuantity = typeof quantity === 'number' ? quantity : (parseInt(quantity) || 1);
                  const unitsToAdd = [];
                  for(let i=0; i<parsedQuantity; i++) {
                    const newGuaranteeNumber = (currentSequence+1+i).toString();
                    
                    if (units.some(u => String(u.guaranteeNumber) === newGuaranteeNumber)) {
                      toast.error(`O número de série A${newGuaranteeNumber} já existe! Verifique a sequência atual.`);
                      return;
                    }

                    unitsToAdd.push({ 
                      id: Math.random().toString(), 
                      model, 
                      orientation, 
                      guaranteeNumber: newGuaranteeNumber, 
                      assembler, 
                      assemblyDate: new Date().toISOString(), 
                      isAssigned: false 
                    });
                  }
                  
                  // Update manual quantities (semimontados and corpos)
                  const key = `${model}|${orientation}`;
                  const isMBF040 = model.startsWith('MBF-040');
                  const fallbackCorposKey = isMBF040 ? `MBF-025|${orientation}` : key;
                  
                  let currentSemimontados = parseInt(manualQuantities[key]?.semimontados || '0') || 0;

                  let remainder = 0;
                  if (currentSemimontados >= parsedQuantity) {
                    currentSemimontados -= parsedQuantity;
                  } else {
                    remainder = parsedQuantity - currentSemimontados;
                    currentSemimontados = 0;
                  }

                  const updatedQuantities = { ...manualQuantities };

                  updatedQuantities[key] = {
                    ...(updatedQuantities[key] || {}),
                    semimontados: currentSemimontados.toString()
                  };

                  if (remainder > 0) {
                    let fallbackCorpos = parseInt(updatedQuantities[fallbackCorposKey]?.corpos || '0') || 0;
                    
                    if (fallbackCorpos >= remainder) {
                      fallbackCorpos -= remainder;
                      remainder = 0;
                    } else {
                      remainder -= fallbackCorpos;
                      fallbackCorpos = 0;
                    }

                    updatedQuantities[fallbackCorposKey] = {
                      ...(updatedQuantities[fallbackCorposKey] || {}),
                      corpos: fallbackCorpos.toString()
                    };

                    // Se ainda houver remainder, descontar de outras orientações do mesmo modelo
                    if (remainder > 0) {
                      const targetModel = isMBF040 ? 'MBF-025' : model;
                      const otherKeys = Object.keys(updatedQuantities).filter(k => 
                        k.startsWith(`${targetModel}|`) && k !== fallbackCorposKey
                      );
                      
                      for (const otherKey of otherKeys) {
                        if (remainder <= 0) break;
                        
                        let otherCorpos = parseInt(updatedQuantities[otherKey]?.corpos || '0') || 0;
                        if (otherCorpos > 0) {
                          if (otherCorpos >= remainder) {
                            otherCorpos -= remainder;
                            remainder = 0;
                          } else {
                            remainder -= otherCorpos;
                            otherCorpos = 0;
                          }
                          updatedQuantities[otherKey] = {
                            ...(updatedQuantities[otherKey] || {}),
                            corpos: otherCorpos.toString()
                          };
                        }
                      }
                    }
                  }
                  
                  updateConfig({ manualQuantities: updatedQuantities });
                  onAddBatch(unitsToAdd); 
                  setShowForm(false);
                }} disabled={!assembler} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all" aria-label="Finalizar Lote">Finalizar Lote</button>
                <button onClick={() => setShowForm(false)} className="px-8 text-[10px] font-black uppercase text-slate-400 hover:text-white" aria-label="Cancelar">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-500">
           {/* Filtros e Cabeçalho do Relatório */}
           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center gap-4 shadow-sm no-print">
              <div className="flex-1 flex items-center gap-3 w-full px-2">
                <Search className="text-slate-400" size={18} />
                <input 
                  value={searchHistory} 
                  onChange={e => setSearchHistory(e.target.value)} 
                  placeholder="BUSCAR SÉRIE, MODELO OU MONTADOR..." 
                  className="flex-1 bg-transparent border-none outline-none font-black uppercase text-xs text-white" 
                />
              </div>
              <div className="h-8 w-[1px] bg-slate-700 hidden md:block"></div>
              <div className="flex items-center gap-4 w-full md:w-auto px-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <input 
                    type="date" 
                    value={reportDate} 
                    onChange={e => setReportDate(e.target.value)} 
                    className="bg-slate-700 text-white border-none outline-none font-black text-xs uppercase px-3 py-1.5 rounded-xl focus:ring-1 ring-slate-500"
                  />
                </div>
                <button onClick={() => handlePrintAssemblyHistory()} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all shadow-md" aria-label="Imprimir">
                   <Printer size={14} /> Imprimir
                </button>
              </div>
           </div>

           {/* Cabeçalho para Impressão do Relatório */}
           <div className="hidden print-only print:block w-full">
              <div className="print-header">
                <h1 className="text-xl font-black uppercase italic">RELATÓRIO DE PRODUÇÃO SAFISA</h1>
                <div className="flex justify-between mt-2">
                  <p className="text-[10px] font-bold uppercase">
                    {searchHistory ? `BUSCA: ${safeToUpper(searchHistory)}` : `FILTRO: ${reportDate ? safeFormatDate(reportDate + 'T00:00:00') : ''}`}
                  </p>
                  <p className="text-[10px] font-bold uppercase">TOTAL: {filteredHistory.length} UNIDADES</p>
                </div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>SÉRIE</th>
                    <th>MODELO</th>
                    <th>ORIENTAÇÃO</th>
                    <th>MONTADOR</th>
                    <th>CLIENTE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(u => (
                    <tr key={u.id}>
                      <td className="font-mono font-bold">A{u.guaranteeNumber}</td>
                      <td>{u.model}</td>
                      <td>{ORIENTATION_FULL_NAMES[u.orientation || 'NORMAL']}</td>
                      <td>{u.assembler}</td>
                      <td>{getGuaranteeCustomerName(u.guaranteeNumber)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>

           <div className="flex flex-col gap-3 no-print">
              <div className="flex justify-between items-center ml-2 mb-1">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Encontrados: {filteredHistory.length} unidades</span>
                 <span className="text-[9px] font-black text-slate-300 uppercase">
                   {searchHistory ? 'Busca Ativa (Todas as Datas)' : `Referência: ${reportDate}`}
                 </span>
              </div>
              {filteredHistory.map(u => (
                <div key={u.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-sm flex items-center justify-between group hover:border-white transition-all">
                   <div className="flex items-center gap-6 flex-1">
                      <div className="flex flex-col min-w-[100px]">
                          <span className="text-xs font-black text-slate-500 uppercase">GARANTIA</span>
                         <span className="font-mono font-black text-white text-lg italic tracking-tighter">A{u.guaranteeNumber}</span>
                      </div>
                      <div className="flex flex-col flex-1">
                         <div className="flex items-center gap-2">
                            <h4 className="font-black text-white text-sm uppercase italic leading-tight">{u.model}</h4>
                            <span className="text-xs font-black text-white uppercase px-1.5 py-0.5 bg-slate-600 rounded">{ORIENTATION_FULL_NAMES[u.orientation || 'NORMAL']}</span>
                         </div>
                         <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><User size={10}/> {u.assembler}</span>
                            <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><Calendar size={10}/> {safeFormatDate(u.assemblyDate)}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingUnit(u)}
                          className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-xl transition-all"
                          title="Editar Modelo/Orientação"
                         aria-label="Editar Modelo/Orientação">
                          <Pencil size={14} />
                        </button>
                      </div>
                      <div className="text-right">
                         <span className="text-xs font-black text-slate-500 uppercase block">STATUS</span>
                         <span className={`text-[9px] font-black uppercase ${u.isAssigned ? 'text-slate-500' : 'text-emerald-400'}`}>
                           {u.isAssigned ? 'VINCULADO' : 'EM ESTOQUE'}
                         </span>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${u.isAssigned ? 'bg-slate-700' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`}></div>
                   </div>
                </div>
              ))}

              {filteredHistory.length === 0 && (
                <div className="py-20 text-center opacity-20 border-4 border-dashed rounded-xl border-slate-700 text-white">
                   <History size={48} className="mx-auto mb-2" />
                   <p className="text-[10px] font-black uppercase tracking-tighter">Nenhum registro nesta data / filtro</p>
                </div>
              )}
           </div>
        </div>
      )}
      {activeTab === 'returns' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-8 py-5 border-b border-slate-700 flex items-center gap-3">
              <RotateCcw size={18} className="text-slate-400" />
              <div>
                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Retorno ao Estoque</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Desvincula a garantia do pedido e deixa a serie disponivel em estoque.</p>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numero de garantia</label>
                  <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-slate-500">
                    <Search size={18} className="text-slate-500" />
                    <input
                      value={returnSerial}
                      onChange={e => setReturnSerial(e.target.value)}
                      placeholder="DIGITE A61001 OU 61001"
                      className="flex-1 bg-transparent outline-none border-none text-white font-mono font-black text-lg uppercase placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <button
                  onClick={handleReturnToStock}
                  disabled={isReturningToStock || !getGuaranteeLookupKey(returnSerial)}
                  className="h-[52px] px-6 bg-slate-900 text-white rounded-xl border border-slate-700 font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} />
                  {isReturningToStock ? 'Retornando...' : 'Retornar ao Estoque'}
                </button>
              </div>

              {returnLookup && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Garantia</span>
                    <p className="font-mono text-2xl font-black text-white italic">A{returnLookup.key}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {returnLookup.unit ? 'Registro encontrado na montagem' : 'Sem registro na montagem'}
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Vinculo atual</span>
                    <p className="text-sm font-black text-white uppercase">
                      {returnLookup.linkedOrder?.customerName || 'Sem pedido vinculado'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {returnLookup.linkedOrder ? `${returnLookup.linkedOrder.city || 'Sem cidade'} | ${safeFormatDate(returnLookup.linkedOrder.createdAt)}` : 'A serie sera mantida/cadastrada em estoque'}
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Destino</span>
                    <p className="text-sm font-black text-emerald-400 uppercase">Estoque disponivel</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      {returnLookup.unit?.isAssigned ? 'Sera marcado como nao vinculado' : 'Ja consta como livre ou sera criado'}
                    </p>
                  </div>
                </div>
              )}

              {returnLookup && !returnLookup.unit && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic">Cadastrar garantia retornada</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Esse numero nao existe no estoque. Informe os dados para criar o registro.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Modelo</label>
                      <select value={returnModel} onChange={e => setReturnModel(e.target.value)} className="w-full px-4 py-3 border border-slate-700 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase outline-none">
                        {SERVO_BASE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Orientacao</label>
                      <select value={returnOrientation} onChange={e => setReturnOrientation(e.target.value as ServoOrientation)} className="w-full px-4 py-3 border border-slate-700 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase outline-none">
                        {Object.entries(ORIENTATION_FULL_NAMES).map(([key, value]) => (
                          <option key={key} value={key}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Responsavel</label>
                      <select value={returnAssembler} onChange={e => setReturnAssembler(e.target.value)} className="w-full px-4 py-3 border border-slate-700 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase outline-none">
                        <option value="">ESCOLHER...</option>
                        {assemblers.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {!returnLookup && (
                <div className="py-16 text-center border-2 border-dashed border-slate-700 rounded-xl opacity-50">
                  <Package size={42} className="mx-auto mb-3 text-slate-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Informe uma garantia para consultar o retorno</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {activeTab === 'spreadsheet' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-xl space-y-8 print:bg-transparent print:border-none print:p-0 print:shadow-none">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                  <FileSpreadsheet size={28} className="text-slate-400" /> Planilha de Produção
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-md">
                  Acompanhamento automático de pedidos pendentes e estoque disponível.
                </p>
              </div>
              
              <button onClick={handlePrintSpreadsheet} className="flex items-center gap-3 px-8 py-4 bg-slate-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-600 transition-all active:scale-95" aria-label="Imprimir Planilha">
                <Printer size={18} /> Imprimir Planilha
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 print-table-container">
              <table className="w-full text-left border-collapse print-table">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-slate-900/80 backdrop-blur-md">
                    <th className="sticky left-0 z-40 bg-slate-900/80 backdrop-blur-md px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-800/50 whitespace-nowrap shadow-[2px_0_5px_rgba(0,0,0,0.3)] print:static print:bg-transparent print:shadow-none print:border-slate-300">
                      <div className="flex flex-col">
                        <span>Modelo</span>
                        <span className="text-xs text-slate-500 mt-1 print:text-black">{safeFormatDate(Date.now())}</span>
                      </div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-emerald-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Total</div>
                    </th>
                    {spreadsheetTable.headers.map((header, i) => (
                      <th key={i} className="px-1 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 text-center align-middle min-w-[30px] max-w-[40px] leading-tight [writing-mode:vertical-rl] rotate-180">
                        <div className="flex items-center justify-start w-full h-full">
                          <span className="line-clamp-3 text-left ml-0 mr-[-20px]">{header.name}</span>
                        </div>
                      </th>
                    ))}
                    <th className="print-thick-border px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 border-l-[3px] border-l-slate-600 print:border-slate-300 print:border-l-[3px] print:border-l-slate-600 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Estoque</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Semimont.</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Corpos</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Zinco</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Usinagem</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-slate-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Mat.Prima</div>
                    </th>
                    <th className="px-2 py-8 text-[10px] print:text-base font-black text-orange-400 print:text-black uppercase tracking-widest border border-slate-800/50 print:border-slate-300 whitespace-nowrap text-center [writing-mode:vertical-rl] rotate-180">
                      <div className="flex items-center justify-center w-full">Inf.Produção</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 print:divide-slate-300">
                  {(() => {
                    const modelTotals: Record<string, number> = {};
                    spreadsheetTable.rows.forEach(row => {
                      const rowKey = `${row.model}|${row.orientation}`;
                      const semimont = parseInt(manualQuantities[rowKey]?.semimontados || '0') || 0;
                      const corpos = parseInt(manualQuantities[rowKey]?.corpos || '0') || 0;
                      const zinco = parseInt(manualQuantities[rowKey]?.zinco || '0') || 0;
                      const rowInfProducao = (row.stockCount + semimont + corpos + zinco) - row.total;
                      
                      // Group MBF-025 and MBF-040 together
                      let groupKey = row.model;
                      if (groupKey.startsWith('MBF-025') || groupKey.startsWith('MBF-040')) {
                        groupKey = 'MBF-025_040_GROUP';
                      } else if (groupKey.startsWith('MC-040')) {
                        // MC-040 should be separated by orientation
                        groupKey = `${row.model}_${row.orientation}`;
                      }

                      if (!modelTotals[groupKey]) modelTotals[groupKey] = 0;
                      modelTotals[groupKey] += rowInfProducao;
                    });

                    return spreadsheetTable.rows.map((row, i) => {
                      const rowKey = `${row.model}|${row.orientation}`;
                      const semimont = parseInt(manualQuantities[rowKey]?.semimontados || '0') || 0;
                      const corpos = parseInt(manualQuantities[rowKey]?.corpos || '0') || 0;
                      const zinco = parseInt(manualQuantities[rowKey]?.zinco || '0') || 0;
                      
                      let infProducaoKey = row.model;
                      let isFirstInModel = spreadsheetTable.rows.findIndex(r => r.model === row.model) === i;

                      // Special handling for MBF-025 / MBF-040 group
                      if (row.model.startsWith('MBF-025') || row.model.startsWith('MBF-040')) {
                        infProducaoKey = 'MBF-025_040_GROUP';
                        // Only show on the very first row of MBF-025
                        const firstMBF025Index = spreadsheetTable.rows.findIndex(r => r.model.startsWith('MBF-025'));
                        isFirstInModel = i === firstMBF025Index;
                      } else if (row.model.startsWith('MC-040')) {
                        // MC-040 should be separated by orientation
                        infProducaoKey = `${row.model}_${row.orientation}`;
                        isFirstInModel = true; // Show on every row for MC-040
                      }

                      const infProducao = modelTotals[infProducaoKey];

                      return (
                        <tr key={i} className="group hover:bg-slate-700/50 transition-colors">
                          <td className="sticky left-0 z-10 bg-slate-800 group-hover:bg-slate-700 px-6 py-4 font-black text-white whitespace-nowrap border border-slate-800/50 print:border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.3)] print:static print:bg-transparent print:shadow-none transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-sm print:text-lg print:font-black">{row.model.replace(/\s*\([^)]*\)\s*/g, '')}</span>
                              <span className="text-sm print:text-lg text-white uppercase font-bold print:font-black print:text-black">{ORIENTATION_FULL_NAMES[row.orientation]}</span>
                            </div>
                          </td>
                          <td className={`px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none font-black text-center whitespace-nowrap border border-slate-800/50 print:border-slate-300 ${row.total > 0 ? 'text-emerald-400 print:text-black' : 'text-slate-600'}`}>
                            {row.total > 0 ? row.total : <span className="no-print">0</span>}
                          </td>
                          {row.orderQuantities.map((qty, j) => (
                            <td key={j} className={`px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none font-bold print:font-black text-center whitespace-nowrap border border-slate-800/50 print:border-slate-300 ${qty > 0 ? 'text-white print:text-black' : 'text-slate-600'}`}>
                              {qty > 0 ? qty : <span className="no-print">0</span>}
                            </td>
                          ))}
                          <td className={`print-thick-border px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none font-black text-center border border-slate-800/50 border-l-[3px] border-l-slate-600 print:border-slate-300 print:border-l-[3px] print:border-l-slate-600 whitespace-nowrap ${row.stockCount > 0 ? 'text-slate-200 print:text-black' : 'text-slate-600'}`}>
                            {row.stockCount > 0 ? row.stockCount : <span className="no-print">0</span>}
                          </td>
                          {['semimontados', 'corpos', 'zinco', 'usinagem', 'matPrima'].map(field => {
                            const val = manualQuantities[rowKey]?.[field] || '';
                            const numVal = parseInt(val) || 0;
                            return (
                              <td key={field} className="px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-center border border-slate-800/50 print:border-slate-300 text-slate-500">
                                <input 
                                  type="text" 
                                  value={val} 
                                  onChange={(e) => handleManualQtyChange(row.model, row.orientation, field, e.target.value)}
                                  className="w-10 bg-transparent text-center border-b border-slate-700 focus:border-slate-500 outline-none no-print text-white font-bold"
                                  placeholder="-"
                                />
                                <span className="hidden print:inline text-black font-black">
                                  {numVal > 0 ? val : ''}
                                </span>
                              </td>
                            );
                          })}
                          <td className={`px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none font-black text-center border border-slate-800/50 print:border-slate-300 whitespace-nowrap ${isFirstInModel ? (infProducao < 0 ? 'text-red-400 print:text-black' : 'text-orange-400 print:text-black') : 'text-slate-800/20'}`}>
                            {isFirstInModel ? (infProducao !== 0 ? infProducao : <span className="no-print">0</span>) : <span className="no-print">-</span>}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/50 font-black">
                    <td className="sticky left-0 z-10 bg-slate-900 px-6 py-4 text-[10px] uppercase text-slate-400 tracking-widest border border-slate-800/50 print:border-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.3)] print:static print:bg-transparent print:shadow-none">Total Geral</td>
                    <td className="px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-emerald-400 print:text-black text-center font-black border border-slate-800/50 print:border-slate-300">
                      {spreadsheetTable.grandTotal > 0 ? spreadsheetTable.grandTotal : <span className="no-print">0</span>}
                    </td>
                    {spreadsheetTable.columnTotals.map((total, i) => (
                      <td key={i} className="px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-white print:text-black text-center font-black border border-slate-800/50 print:border-slate-300">
                        {total > 0 ? total : <span className="no-print">0</span>}
                      </td>
                    ))}
                    <td className="print-thick-border px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-slate-400 print:text-black text-center font-black border border-slate-800/50 border-l-[3px] border-l-slate-600 print:border-slate-300 print:border-l-[3px] print:border-l-slate-600">
                      {spreadsheetTable.totalStock > 0 ? spreadsheetTable.totalStock : <span className="no-print">0</span>}
                    </td>
                    {['semimontados', 'corpos', 'zinco', 'usinagem', 'matPrima'].map(field => {
                      const total = spreadsheetTable.rows.reduce((sum, row) => {
                        const val = manualQuantities[`${row.model}|${row.orientation}`]?.[field];
                        return sum + (parseInt(val) || 0);
                      }, 0);
                      return (
                        <td key={field} className="px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-slate-400 print:text-black text-center font-black border border-slate-800/50 print:border-slate-300">
                          {total > 0 ? total : <span className="no-print">-</span>}
                        </td>
                      );
                    })}
                    <td className="px-1 py-4 print:p-0 text-sm print:text-4xl print:leading-none text-orange-400 print:text-black text-center font-black border border-slate-800/50 print:border-slate-300">
                      {(() => {
                        const totalInfProducao = spreadsheetTable.rows.reduce((sum, row) => {
                          const rowKey = `${row.model}|${row.orientation}`;
                          const semimont = parseInt(manualQuantities[rowKey]?.semimontados || '0') || 0;
                          const corpos = parseInt(manualQuantities[rowKey]?.corpos || '0') || 0;
                          const zinco = parseInt(manualQuantities[rowKey]?.zinco || '0') || 0;
                          return sum + ((row.stockCount + semimont + corpos + zinco) - row.total);
                        }, 0);
                        return totalInfProducao !== 0 ? totalInfProducao : <span className="no-print">0</span>;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {spreadsheetTable.rows.length === 0 && (
              <div className="py-20 text-center border-4 border-dashed border-slate-700 rounded-xl opacity-40">
                <Package size={48} className="mx-auto mb-4 text-slate-500" />
                <p className="text-sm font-black uppercase text-slate-400 tracking-widest">Sem demanda ativa</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editingUnit && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setEditingUnit(null)} />
          <div className="relative bg-slate-800 p-10 rounded-xl shadow-2xl w-full max-w-md space-y-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center text-white">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Editar Série A{editingUnit.guaranteeNumber}</h3>
              <button onClick={() => setEditingUnit(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400" aria-label="Botão"><X size={20}/></button>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Modelo</label>
                <select 
                  value={editingUnit.model} 
                  onChange={e => setEditingUnit({...editingUnit, model: e.target.value})} 
                  className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-bold text-sm uppercase outline-none focus:border-white"
                >
                  {SERVO_BASE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Orientação</label>
                <select 
                  value={editingUnit.orientation || 'NORMAL'} 
                  onChange={e => setEditingUnit({...editingUnit, orientation: e.target.value as ServoOrientation})} 
                  className="w-full px-5 py-3 border-2 border-slate-700 bg-slate-800 text-white rounded-xl font-bold text-sm uppercase outline-none focus:border-white"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="INVERTIDO_015_VF">INVERTIDO 015/VF</option>
                  <option value="INVERTIDO_028">INVERTIDO 028</option>
                  <option value="DESLOCADO">DESLOCADO</option>
                  <option value="REBAIXADO">REBAIXADO</option>
                  <option value="CORPO_PRINCIPAL">SÓ O CORPO PRINCIPAL</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    onUpdateUnit(editingUnit.id, { model: editingUnit.model, orientation: editingUnit.orientation });
                    setEditingUnit(null);
                  }} 
                  className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
                 aria-label="Salvar Alterações">
                  Salvar Alterações
                </button>
                <button onClick={() => setEditingUnit(null)} className="px-8 text-[10px] font-black uppercase text-slate-400 hover:text-white" aria-label="Cancelar">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default AssemblyView;
