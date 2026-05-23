import React from 'react';
import AssemblyView from '../AssemblyView';
import { AssembledUnit, Kit, Order, ServoOrientation } from '../../types';

interface AssemblySectorProps {
  assemblers: string[];
  currentSequence: number;
  kits: Kit[];
  manualQuantities: Record<string, Record<string, string>>;
  orders: Order[];
  passwords: Record<string, string>;
  units: AssembledUnit[];
  updateConfig: (data: any) => Promise<void> | void;
  onAddBatch: (units: AssembledUnit[]) => Promise<void> | void;
  onReturnToStock: (data: {
    guaranteeNumber: string;
    model?: string;
    orientation?: ServoOrientation;
    assembler?: string;
  }) => Promise<void> | void;
  onToggleGroupKit: (id: string, itemIds: string[]) => Promise<void> | void;
  onToggleOrderToday: (id: string, value: boolean) => Promise<void> | void;
  onUpdateUnit: (id: string, data: Partial<AssembledUnit>) => Promise<void> | void;
}

const AssemblySector: React.FC<AssemblySectorProps> = ({
  assemblers,
  currentSequence,
  kits,
  manualQuantities,
  orders,
  passwords,
  units,
  updateConfig,
  onAddBatch,
  onReturnToStock,
  onToggleGroupKit,
  onToggleOrderToday,
  onUpdateUnit
}) => {
  return (
    <AssemblyView
      assemblers={assemblers}
      units={units}
      orders={orders}
      kits={kits}
      manualQuantities={manualQuantities}
      onAddBatch={onAddBatch}
      onUpdateUnit={onUpdateUnit}
      currentSequence={currentSequence}
      onToggleOrderToday={onToggleOrderToday}
      onToggleGroupKit={onToggleGroupKit}
      onReturnToStock={onReturnToStock}
      passwords={passwords}
      updateConfig={updateConfig}
    />
  );
};

export default AssemblySector;
