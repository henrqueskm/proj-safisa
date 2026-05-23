import React from 'react';
import ExpeditionView from '../ExpeditionView';
import {
  AssembledUnit,
  Kit,
  KitData,
  KitImage,
  Order,
  OrderStatus,
  ServoModelData
} from '../../types';

interface ExpeditionSectorProps {
  availableUnits: AssembledUnit[];
  kitData: KitData[];
  kitImages: KitImage[];
  kits: Kit[];
  orders: Order[];
  passwords: Record<string, string>;
  printers: string[];
  safisaIcon: string | null;
  selectedPrinter: string;
  servoModelData: ServoModelData[];
  setSelectedPrinter: (printer: string) => void;
  setShowSummaryCards: (show: boolean) => void;
  setShowTabs: (show: boolean) => void;
  showSummaryCards: boolean;
  showTabs: boolean;
  updateConfig: (data: any) => Promise<void> | void;
  onAdjustKitStock: (params: { code: string; quantity: number; model?: string; observation?: string }) => Promise<void>;
  onAssignBatch: (orderId: string, assigns: { itemId: string; guaranteeNumber: string | null }[]) => Promise<void> | void;
  onCompleteExpedition: (orderId: string, weight: string, volume: string) => Promise<void> | void;
  onDeleteKitGroup: (model: string, name: string) => Promise<void> | void;
  onMarkGroupCollected: (orderId: string, itemIds: string[]) => Promise<void> | void;
  onToggleGroupKit: (orderId: string, itemIds: string[]) => Promise<void> | void;
  onUpdateStatus: (id: string, status: OrderStatus, extra?: any) => Promise<void> | void;
}

const ExpeditionSector: React.FC<ExpeditionSectorProps> = ({
  availableUnits,
  kitData,
  kitImages,
  kits,
  orders,
  passwords,
  printers,
  safisaIcon,
  selectedPrinter,
  servoModelData,
  setSelectedPrinter,
  setShowSummaryCards,
  setShowTabs,
  showSummaryCards,
  showTabs,
  updateConfig,
  onAdjustKitStock,
  onAssignBatch,
  onCompleteExpedition,
  onDeleteKitGroup,
  onMarkGroupCollected,
  onToggleGroupKit,
  onUpdateStatus
}) => {
  return (
    <ExpeditionView
      orders={orders}
      availableUnits={availableUnits}
      kits={kits}
      kitData={kitData}
      servoModelData={servoModelData}
      kitImages={kitImages}
      safisaIcon={safisaIcon}
      onAssignBatch={onAssignBatch}
      onDeleteKitGroup={onDeleteKitGroup}
      onUpdateStatus={onUpdateStatus}
      onMarkGroupCollected={onMarkGroupCollected}
      onCompleteExpedition={onCompleteExpedition}
      onToggleGroupKit={onToggleGroupKit}
      onAdjustKitStock={onAdjustKitStock}
      passwords={passwords}
      updateConfig={updateConfig}
      printers={printers}
      selectedPrinter={selectedPrinter}
      setSelectedPrinter={setSelectedPrinter}
      showTabs={showTabs}
      setShowTabs={setShowTabs}
      showSummaryCards={showSummaryCards}
      setShowSummaryCards={setShowSummaryCards}
    />
  );
};

export default ExpeditionSector;
