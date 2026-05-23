import React from 'react';
import AdminView from '../AdminView';
import {
  AssembledUnit,
  AuditLog,
  Customer,
  Kit,
  KitData,
  KitImage,
  Order,
  OrderStatus,
  ServoModelData
} from '../../types';

interface AdminSectorProps {
  addOrder: (order: Order) => Promise<void> | void;
  assembledUnits: AssembledUnit[];
  auditLogs: AuditLog[];
  currentSequence: number;
  customers: Customer[];
  deleteOrder: (id: string) => Promise<void> | void;
  kitData: KitData[];
  kitImages: KitImage[];
  kits: Kit[];
  orders: Order[];
  partRegistry: Record<string, any>;
  passwords: Record<string, string>;
  safisaIcon: string | null;
  servoModelData: ServoModelData[];
  setSequence: (value: number) => Promise<void> | void;
  updateConfig: (data: any) => Promise<void> | void;
  updateStatus: (id: string, status: OrderStatus, extra?: any) => Promise<void> | void;
  onDeleteKitData: (id: string) => Promise<void> | void;
  onDeleteKitImage: (id: string) => Promise<void> | void;
  onDeleteServoModelData: (id: string) => Promise<void> | void;
  onReconcile: () => Promise<void>;
  onSaveKitData: (kitData: KitData) => Promise<void> | void;
  onSaveKitImage: (id: string, file: File) => Promise<void> | void;
  onSaveServoModelData: (servoModelData: ServoModelData) => Promise<void> | void;
}

const AdminSector: React.FC<AdminSectorProps> = ({
  addOrder,
  assembledUnits,
  auditLogs,
  currentSequence,
  customers,
  deleteOrder,
  kitData,
  kitImages,
  kits,
  orders,
  partRegistry,
  passwords,
  safisaIcon,
  servoModelData,
  setSequence,
  updateConfig,
  updateStatus,
  onDeleteKitData,
  onDeleteKitImage,
  onDeleteServoModelData,
  onReconcile,
  onSaveKitData,
  onSaveKitImage,
  onSaveServoModelData
}) => {
  return (
    <AdminView
      orders={orders}
      assembledUnits={assembledUnits}
      kits={kits}
      kitData={kitData}
      servoModelData={servoModelData}
      customers={customers}
      kitImages={kitImages}
      partRegistry={partRegistry}
      safisaIcon={safisaIcon}
      auditLogs={auditLogs}
      addOrder={addOrder}
      deleteOrder={deleteOrder}
      updateStatus={updateStatus}
      currentSequence={currentSequence}
      passwords={passwords}
      updateConfig={updateConfig}
      setSequence={setSequence}
      onSaveKitImage={onSaveKitImage}
      onDeleteKitImage={onDeleteKitImage}
      onReconcile={onReconcile}
      onSaveKitData={onSaveKitData}
      onDeleteKitData={onDeleteKitData}
      onSaveServoModelData={onSaveServoModelData}
      onDeleteServoModelData={onDeleteServoModelData}
    />
  );
};

export default AdminSector;
