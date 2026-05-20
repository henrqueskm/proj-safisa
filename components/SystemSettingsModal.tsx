import { generateId, safeFormatDate, safeToUpper } from '../lib/utils';
import React, { useState, useMemo } from "react";
import {
  Settings,
  RefreshCcw,
  ImageIcon,
  Camera,
  X,
  Trash,
  Barcode,
  Link as LinkIcon,
  Copy,
  User,
  Edit2,
  FileText,
  Download,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  ServoModelData,
  KitData,
  KitImage,
  AppUser,
  UserRole,
  AuditLog,
} from "../types";
import { SERVO_BASE_MODELS, SERVO_KITS, ROLE_DATA } from "../constants";

interface SystemSettingsModalProps {
  onClose: () => void;
  onReconcile: () => Promise<void>;
  safisaIcon: string | null;
  updateConfig: (d: any) => void;
  servoModelData: ServoModelData[];
  onSaveServoModelData: (s: ServoModelData) => void;
  onDeleteServoModelData: (id: string) => void;
  kitData: KitData[];
  onSaveKitData: (k: KitData) => void;
  kitImages: KitImage[];
  onSaveKitImage: (id: string, file: File) => Promise<void> | void;
  onDeleteKitImage: (id: string) => void;
  users: AppUser[];
  onSaveUser: (u: AppUser) => Promise<boolean | void> | void;
  onDeleteUser: (id: string) => void;
  representatives: string[];
  auditLogs: AuditLog[];
  onLoadMoreAuditLogs?: () => void;
  onExportBackup: () => Promise<void>;
  onImportBackup?: (file: File) => Promise<void>;
  globalAssemblers?: string[];
  globalRepresentatives?: string[];
}

const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  onClose,
  onReconcile,
  safisaIcon,
  updateConfig,
  servoModelData,
  onSaveServoModelData,
  onDeleteServoModelData,
  kitData,
  onSaveKitData,
  kitImages,
  onSaveKitImage,
  onDeleteKitImage,
  users,
  onSaveUser,
  onDeleteUser,
  representatives,
  auditLogs,
  onLoadMoreAuditLogs,
  onExportBackup,
  onImportBackup,
  globalAssemblers = [],
  globalRepresentatives = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    "maintenance" | "logo" | "endpoints" | "barcodes_no_kit" | "barcodes_kit" | "kit_images" | "users" | "personnel" | "audit_logs"
  >("maintenance");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [newAssembler, setNewAssembler] = useState("");
  const [newRepresentative, setNewRepresentative] = useState("");

  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_ITEMS_PER_PAGE = 10;

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (log) =>
        log.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.details.toLowerCase().includes(auditSearch.toLowerCase()),
    );
  }, [auditLogs, auditSearch]);

  const totalAuditPages = Math.ceil(
    filteredAuditLogs.length / AUDIT_ITEMS_PER_PAGE,
  );
  const currentAuditLogs = filteredAuditLogs.slice(
    (auditPage - 1) * AUDIT_ITEMS_PER_PAGE,
    auditPage * AUDIT_ITEMS_PER_PAGE,
  );

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    kitId: string,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.promise(
        async () => {
          await onSaveKitImage(kitId, file);
        },
        {
          loading: "Enviando imagem...",
          success: () => `Imagem do KIT ${kitId} atualizada!`,
          error: "Erro ao enviar imagem",
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 w-full max-w-6xl h-[85vh] flex overflow-hidden rounded-xl shadow-2xl border border-slate-700 animate-in zoom-in-95">
        <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
           <div className="p-6 border-b border-slate-800 space-y-2">
             <h2 className="text-xl font-semibold uppercase italic tracking-tighter text-white flex items-center gap-2">
               <Settings className="text-slate-400" size={20} />
               Sistema
             </h2>
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
               Configurações Globais
             </p>
           </div>
           
           <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
             <button onClick={() => setActiveTab('maintenance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'maintenance' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Manutenção & Backup">
               <RefreshCcw size={16}/> Manutenção & Backup
             </button>
             <button onClick={() => setActiveTab('logo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'logo' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Logo Safisa">
               <ImageIcon size={16}/> Logo Safisa
             </button>
             <button onClick={() => setActiveTab('endpoints')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'endpoints' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="API Endpoints">
               <LinkIcon size={16}/> API Endpoints
             </button>
             <button onClick={() => setActiveTab('barcodes_no_kit')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'barcodes_no_kit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="SEM KIT">
               <Barcode size={16}/> SEM KIT
             </button>
             <button onClick={() => setActiveTab('barcodes_kit')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'barcodes_kit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="COM KIT">
               <Barcode size={16}/> COM KIT
             </button>
             <button onClick={() => setActiveTab('kit_images')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'kit_images' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Fotos dos Kits">
               <ImageIcon size={16}/> Fotos dos Kits
             </button>
             <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Usuários">
               <User size={16}/> Usuários
             </button>
             <button onClick={() => setActiveTab('personnel')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'personnel' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Pessoal">
               <User size={16}/> Pessoal
             </button>
             <button onClick={() => setActiveTab('audit_logs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${activeTab === 'audit_logs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`} aria-label="Logs de Auditoria">
               <FileText size={16}/> Logs de Auditoria
             </button>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shadow-sm z-50"
           aria-label="Fechar">
            <X size={24} />
          </button>

          {activeTab === "maintenance" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-xl space-y-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                    <RefreshCcw size={18} className="text-slate-400" />{" "}
                    Manutenção
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Sincroniza o status de "Vinculado" das unidades com base nos
                    pedidos atuais. Use se notar servos no estoque que já
                    deveriam estar em pedidos.
                  </p>
                  <button
                    onClick={async () => {
                      const t = toast.loading("Sincronizando estoque...");
                      await onReconcile();
                      toast.dismiss(t);
                      toast.success("Estoque Reconciliado", {
                        description:
                          "O status de vinculação foi atualizado com sucesso.",
                      });
                    }}
                    className="w-full py-4 bg-slate-900/30 text-slate-400 rounded-xl font-semibold uppercase text-[10px] tracking-widest hover:bg-slate-700 hover:text-white transition-all shadow-sm active:scale-95"
                   aria-label="Botão">
                    Reconciliar Estoque Manualmente
                  </button>
                </div>

                <div className="space-y-2 pt-6 border-t border-slate-700">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Download size={18} className="text-emerald-500" /> Backup
                    de Dados
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Faça o download de todos os dados do sistema (pedidos,
                    estoque, usuários, logs) para o seu computador. Recomendado
                    fazer diariamente.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={async () => {
                        const t = toast.loading("Gerando arquivo de backup...");
                        await onExportBackup();
                        toast.dismiss(t);
                      }}
                      className="w-full py-4 bg-emerald-900/30 text-emerald-400 rounded-xl font-semibold uppercase text-[10px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                     aria-label="Fazer Backup Completo">
                      <Download size={16} /> Fazer Backup Completo
                    </button>
                    {onImportBackup && (
                      <label className="w-full py-4 bg-blue-900/30 text-blue-400 rounded-xl font-semibold uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                        <Upload size={16} /> Importar Backup (.json)
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const t = toast.loading("Importando backup...");
                              await onImportBackup(file);
                              toast.dismiss(t);
                              // Limpa o input
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
            
          {activeTab === "logo" && (
             <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Logo Safisa (Etiquetas)</h2>
               <div className="bg-slate-800 p-10 rounded-xl border border-slate-700 shadow-xl space-y-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon size={18} className="text-slate-400" /> Logo
                    Safisa (Etiquetas)
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Faça o upload do ícone da Safisa para ser impresso nas
                    etiquetas. Recomendado: Imagem em preto e branco, formato
                    quadrado.
                  </p>

                  <div className="flex items-center gap-6 mt-4">
                    <div className="w-24 h-24 bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {safisaIcon ? (
                        <img
                          src={safisaIcon}
                          alt="Safisa Logo"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <label className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2">
                        <Camera size={16} /> Selecionar Imagem
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const base64 = ev.target?.result as string;
                                updateConfig({ safisaIcon: base64 });
                                toast.success("Logo Atualizado", {
                                  description:
                                    "O ícone da Safisa foi salvo com sucesso.",
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {safisaIcon && (
                        <button
                          onClick={() => {
                            updateConfig({ safisaIcon: null });
                            toast.success("Logo Removido", {
                              description: "O ícone da Safisa foi removido.",
                            });
                          }}
                          className="w-full py-3 bg-red-900/20 text-red-400 rounded-xl font-semibold uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                         aria-label="Remover Logo">
                          Remover Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
            
          {activeTab === "endpoints" && (
             <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Integração de Estoque (API Endpoints)</h2>
               <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-sm space-y-6">
                 <p className="text-xs font-medium text-slate-400">
                   Utilize os links abaixo para integrar o sistema de estoque
                  externo com o Safisa Pro.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      name: "Kits Despachados (Baixa de Estoque)",
                      path: "/api/inventory/dispatched-kits",
                      method: "GET",
                    },
                    {
                      name: "Unidades Montadas (Servos)",
                      path: "/api/inventory/units",
                      method: "GET",
                    },
                    {
                      name: "Kits em Estoque",
                      path: "/api/inventory/kits",
                      method: "GET",
                    },
                  ].map((endpoint, idx) => {
                    const fullUrl = `${window.location.origin}${endpoint.path}`;
                    return (
                      <div
                        key={idx}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-slate-700 text-slate-300 text-[9px] font-black rounded-md uppercase tracking-wider">
                              {endpoint.method}
                            </span>
                            <span className="text-sm font-bold text-white">
                              {endpoint.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono break-all">
                            {fullUrl}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(fullUrl);
                            toast.success("Link copiado!", {
                              description:
                                "A URL do endpoint foi copiada para a área de transferência.",
                            });
                          }}
                          className="shrink-0 p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold uppercase"
                         aria-label="Copiar Link">
                          <Copy size={16} /> Copiar Link
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {activeTab === "barcodes_no_kit" && (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Códigos de Barras (Para Etiquetas SEM KIT)</h2>
              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-sm space-y-6">
                {SERVO_BASE_MODELS.map((model) => {
                  const data = servoModelData.find(
                    (s) => s.model === model,
                  ) || { id: model, model: model, barcode: "" };
                  return (
                    <div
                      key={model}
                      className="flex flex-col md:flex-row gap-4 items-center bg-slate-900 p-4 rounded-2xl border border-slate-700"
                    >
                      <div className="w-full md:w-1/3">
                        <span className="font-black text-white text-sm uppercase italic">
                          {model}
                        </span>
                      </div>
                      <div className="w-full md:w-2/3">
                        <div className="relative">
                          <Barcode
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                            size={16}
                          />
                          <input
                            type="text"
                            placeholder="Código de Barras do Modelo"
                            defaultValue={data.barcode}
                            onBlur={async (e) => {
                              if (e.target.value !== data.barcode) {
                                await onSaveServoModelData({
                                  ...data,
                                  barcode: e.target.value,
                                });
                                toast.success(
                                  `Código de barras do modelo ${model} salvo!`,
                                );
                              }
                            }}
                            className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-black text-xs uppercase outline-none focus:border-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {activeTab === "barcodes_kit" && (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Dados dos Kits (Código de Barras e Aplicação)</h2>
              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-sm space-y-6">
                {Array.from(new Set(Object.values(SERVO_KITS).flat()))
                  .sort()
                  .map((kit) => {
                    const data = kitData.find((k) => k.id === kit) || {
                      id: kit,
                      name: kit,
                      barcode: "",
                      application: "",
                    };
                    return (
                      <div
                        key={kit}
                        className="flex flex-col md:flex-row gap-4 items-center bg-slate-900 p-4 rounded-2xl border border-slate-700"
                      >
                        <div className="w-full md:w-1/4">
                          <span className="font-black text-white text-sm uppercase italic">
                            KIT {kit}
                          </span>
                        </div>
                        <div className="w-full md:w-1/3">
                          <input
                            type="text"
                            placeholder="Código de Barras"
                            defaultValue={data.barcode}
                            onBlur={async (e) => {
                              if (e.target.value !== data.barcode) {
                                await onSaveKitData({
                                  ...data,
                                  barcode: e.target.value,
                                });
                                toast.success("Código de barras salvo!");
                              }
                            }}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-black text-xs uppercase outline-none focus:border-slate-500"
                          />
                        </div>
                        <div className="w-full md:w-1/3">
                          <input
                            type="text"
                            placeholder="Aplicação"
                            defaultValue={data.application}
                            onBlur={async (e) => {
                              if (e.target.value !== data.application) {
                                await onSaveKitData({
                                  ...data,
                                  application: e.target.value,
                                });
                                toast.success("Aplicação salva!");
                              }
                            }}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl font-black text-xs uppercase outline-none focus:border-slate-500"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            )}

            {activeTab === "kit_images" && (
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-6">Galeria de Referência (Kits)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from(new Set(Object.values(SERVO_KITS).flat()))
                  .sort()
                  .map((kit) => {
                    const kitId = kit;
                    const image = kitImages.find((img) => img.id === kitId);
                    return (
                      <div
                        key={kitId}
                        className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col items-center text-center shadow-sm relative group"
                      >
                        <div className="w-full aspect-square bg-slate-50 rounded-2xl mb-3 flex flex-col items-center justify-center overflow-hidden border border-slate-100">
                          {image ? (
                            <img
                              src={image.data}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon size={24} className="text-slate-200" />
                          )}
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                            <label className="bg-slate-700 text-white p-2 rounded-xl cursor-pointer hover:bg-slate-600 transition-all shadow-lg">
                              <Camera size={18} />
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, kitId)}
                              />
                            </label>
                            {image && (
                              <button
                                onClick={() => onDeleteKitImage(kitId)}
                                className="bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 transition-all shadow-lg"
                               aria-label="Botão">
                                <Trash size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="font-black text-xs italic">
                          KIT {kit}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === "personnel" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Equipe de Chão de Fábrica</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gerenciamento de Montadores e Representantes</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Montadores */}
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6 flex flex-col h-[600px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-orange-700/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                  
                  <div className="relative">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                        <Settings className="text-orange-400" size={16} />
                      </div>
                      Montadores
                    </h3>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">
                      Técnicos responsáveis pela etapa de montagem
                    </p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0 relative">
                    <input
                      type="text"
                      className="flex-1 py-3.5 px-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600 uppercase"
                      placeholder="Nome do Novo Montador..."
                      value={newAssembler}
                      onChange={(e) => setNewAssembler(safeToUpper(e.target.value))}
                    />
                    <button
                      onClick={() => {
                        if (newAssembler && !globalAssemblers?.includes(newAssembler)) {
                          updateConfig({ assemblers: [...(globalAssemblers || []), newAssembler] });
                          setNewAssembler("");
                        }
                      }}
                      className="px-6 py-3.5 bg-orange-600/90 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-orange-500 transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95"
                     aria-label="Adicionar">
                      Adicionar
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 relative">
                    {(!globalAssemblers || globalAssemblers.length === 0) && (
                      <div className="border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center py-12 text-slate-500">
                        <Settings size={28} className="mb-2 opacity-40" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum Montador</p>
                      </div>
                    )}
                    {globalAssemblers?.map((assembler) => (
                      <div
                        key={assembler}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-orange-500/50 transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                            <span className="text-[10px] font-black text-slate-400">{assembler.charAt(0)}</span>
                          </div>
                          <span className="font-bold text-white text-sm tracking-wide">{assembler}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja remover ${assembler}?`)) {
                              updateConfig({ assemblers: globalAssemblers.filter((a) => a !== assembler) });
                            }
                          }}
                          className="p-2.5 text-slate-500 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                         aria-label="Botão">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Representantes */}
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6 flex flex-col h-[600px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-emerald-700/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                  
                  <div className="relative">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <User className="text-emerald-400" size={16} />
                      </div>
                      Representantes
                    </h3>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-2">
                      Titulares de relacionamento e faturamento
                    </p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0 relative">
                    <input
                      type="text"
                      className="flex-1 py-3.5 px-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600 uppercase"
                      placeholder="Nome do Representante..."
                      value={newRepresentative}
                      onChange={(e) => setNewRepresentative(safeToUpper(e.target.value))}
                    />
                    <button
                      onClick={() => {
                        if (newRepresentative && !globalRepresentatives?.includes(newRepresentative)) {
                          updateConfig({ representatives: [...(globalRepresentatives || []), newRepresentative] });
                          setNewRepresentative("");
                        }
                      }}
                      className="px-6 py-3.5 bg-emerald-600/90 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95"
                     aria-label="Adicionar">
                      Adicionar
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 relative">
                    {(!globalRepresentatives || globalRepresentatives.length === 0) && (
                      <div className="border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center py-12 text-slate-500">
                        <User size={28} className="mb-2 opacity-40" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum Representante</p>
                      </div>
                    )}
                    {globalRepresentatives?.map((rep) => (
                      <div
                        key={rep}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-emerald-500/50 transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                            <span className="text-[10px] font-black text-slate-400">{rep.charAt(0)}</span>
                          </div>
                          <span className="font-bold text-white text-sm tracking-wide">{rep}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja remover ${rep}?`)) {
                              updateConfig({ representatives: globalRepresentatives.filter((a) => a !== rep) });
                            }
                          }}
                          className="p-2.5 text-slate-500 hover:text-white hover:bg-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                         aria-label="Botão">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Usuários & Acessos</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gerencie logins e permissões do sistema</p>
              </div>
            </div>

            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-slate-700/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="space-y-8 relative">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                    <User size={18} className="text-blue-400" /> {editingUser ? "Editar Usuário" : "Novo Cadastro"}
                  </h3>
                </div>

                <form
                  key={editingUser?.id || "new"}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const username = formData.get("username") as string;

                    if (
                      !editingUser &&
                      users.some((u) => u.username === username)
                    ) {
                      toast.error("Erro", {
                        description: "Já existe um usuário com esse login.",
                      });
                      return;
                    }

                    const permissions: UserRole[] = [];
                    if (formData.get("perm_admin"))
                      permissions.push(UserRole.ADMIN);
                    if (formData.get("perm_assembly"))
                      permissions.push(UserRole.ASSEMBLY);
                    if (formData.get("perm_expedition"))
                      permissions.push(UserRole.EXPEDITION);
                    if (formData.get("perm_system_settings"))
                      permissions.push(UserRole.SYSTEM_SETTINGS);

                    const userData: AppUser = {
                      id: editingUser?.id || generateId(),
                      name: formData.get("name") as string,
                      username,
                      passwordHash: formData.get("password") as string,
                      permissions,
                      linkedRepresentative:
                        (formData.get("linkedRepresentative") as string) ||
                        undefined,
                    };
                    const target = e.currentTarget;
                    const ok = await onSaveUser(userData);
                    if (ok === false) return;
                    target.reset();
                    setEditingUser(null);
                    toast.success(
                      editingUser ? "Usuário Atualizado" : "Usuário Cadastrado",
                      {
                        description: `${userData.name} foi ${editingUser ? "atualizado" : "adicionado"}.`,
                      },
                    );
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nome Completo
                    </p>
                    <input
                      required
                      name="name"
                      type="text"
                      defaultValue={editingUser?.name || ""}
                      placeholder="Ex: João da Silva"
                      className="w-full py-3 px-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Usuário (Login)
                    </p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono">@</span>
                      <input
                        required
                        name="username"
                        type="text"
                        defaultValue={editingUser?.username || ""}
                        placeholder="joaodasilva"
                        className="w-full py-3 pl-9 pr-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold font-mono text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 lowercase"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Senha de Acesso
                    </p>
                    <input
                      required
                      name="password"
                      type="password"
                      defaultValue={editingUser?.passwordHash || ""}
                      placeholder="••••••••"
                      className="w-full py-3 px-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Vincular Representante (Opcional)
                    </p>
                    <select
                      name="linkedRepresentative"
                      defaultValue={editingUser?.linkedRepresentative || ""}
                      className="w-full py-3 px-5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-slate-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="text-slate-500">
                        Nenhum (Ideal para Montadores/Admins)
                      </option>
                      {representatives.map((rep) => (
                        <option key={rep} value={rep} className="text-white">
                          {rep}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3 md:col-span-2 border border-slate-700 bg-slate-900/50 p-6 rounded-2xl mt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      Permissões de Acesso (Papéis):
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <label className="group flex items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 transition-all">
                        <input
                          type="checkbox"
                          name="perm_admin"
                          defaultChecked={editingUser?.permissions.includes(UserRole.ADMIN)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 transition-all"
                        />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest group-hover:text-blue-400 transition-colors">
                          Admin
                        </span>
                      </label>
                      <label className="group flex items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer hover:border-orange-500 transition-all">
                        <input
                          type="checkbox"
                          name="perm_assembly"
                          defaultChecked={editingUser?.permissions.includes(UserRole.ASSEMBLY)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900 transition-all"
                        />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest group-hover:text-orange-400 transition-colors">
                          Montagem
                        </span>
                      </label>
                      <label className="group flex items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer hover:border-emerald-500 transition-all">
                        <input
                          type="checkbox"
                          name="perm_expedition"
                          defaultChecked={editingUser?.permissions.includes(UserRole.EXPEDITION)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 transition-all"
                        />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                          Expedição
                        </span>
                      </label>
                      <label className="group flex items-center gap-3 p-4 bg-slate-900 border border-slate-700 rounded-xl cursor-pointer hover:border-purple-500 transition-all">
                        <input
                          type="checkbox"
                          name="perm_system_settings"
                          defaultChecked={editingUser?.permissions.includes(UserRole.SYSTEM_SETTINGS)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-slate-900 transition-all"
                        />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest group-hover:text-purple-400 transition-colors">
                          Ajustes
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                    {editingUser ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingUser(null)}
                          className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-700 hover:text-white transition-all shadow-sm"
                         aria-label="Cancelar Edição">
                          Cancelar Edição
                        </button>
                        <button
                          type="submit"
                          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-lg active:scale-95 shadow-blue-900/20"
                         aria-label="Salvar Alterações">
                          Salvar Alterações
                        </button>
                      </>
                    ) : (
                      <button
                        type="submit"
                        className="px-8 py-3 bg-slate-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-600 transition-all shadow-sm active:scale-95 w-full md:w-auto"
                       aria-label="Cadastrar Novo Usuário">
                        Cadastrar Novo Usuário
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl space-y-6 relative overflow-hidden">
              <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2">
                <FileText size={18} className="text-slate-400" /> Lista de Usuários 
                <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px] ml-2 font-black">{users.length}</span>
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="group bg-slate-900 border border-slate-700 p-5 rounded-2xl flex items-start justify-between hover:border-slate-500 transition-colors shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 shrink-0">
                        <User size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-base leading-none">{u.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          {(u.permissions || []).map((p) => (
                            <span
                              key={p}
                              className="text-[9px] font-black px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded uppercase tracking-widest"
                            >
                              {ROLE_DATA[p]?.label || p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-2.5 bg-slate-800 text-slate-400 hover:bg-white hover:text-slate-900 rounded-xl transition-all"
                        title="Editar"
                       aria-label="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Excluir o usuário ${u.name}? O login dele será revogado permanentemente.`)) {
                            onDeleteUser(u.id);
                            toast.success("Usuário excluído");
                          }
                        }}
                        className="p-2.5 bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Excluir"
                       aria-label="Excluir">
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="col-span-full border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center py-16 text-slate-500">
                    <User size={32} className="mb-4 opacity-50" />
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Nenhum Usuário</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">Cadastre o primeiro usuário acima</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit_logs" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Logs de Auditoria</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Histórico de ações (últimos 50 limitados via Query)</p>
              </div>
            </div>
            
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700 gap-4">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                    <FileText size={18} className="text-slate-400" /> Atividades Recentes
                  </h3>
                  <div className="flex-1 max-w-sm relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={16} /></span>
                    <input type="text" placeholder="Buscar logs..." className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }} />
                  </div>
                </div>
                
                <div className="space-y-3 mt-4">
                  {currentAuditLogs.length === 0 && (
                    <div className="border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center py-12 text-slate-500">
                      <FileText size={28} className="mb-2 opacity-40" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum log encontrado</p>
                    </div>
                  )}
                  {currentAuditLogs.map((log) => (
                    <div key={log.id} className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 hover:border-slate-500 hover:shadow-lg transition-all group">
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm mb-1 group-hover:text-blue-400 transition-colors uppercase tracking-wide">{log.action}</span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase bg-slate-800/50 block py-1 px-2 rounded w-fit">
                            {log.entityType} • {log.entityId}
                          </span>
                        </div>
                        <div className="flex flex-col items-end whitespace-nowrap">
                          <span className="text-[10px] font-black px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded uppercase tracking-widest">
                            {safeFormatDate(log.timestamp) + ' ' + safeFormatDate(log.timestamp, 'time')}
                          </span>
                          <div className="flex items-center gap-2 mt-2">
                             <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                               <User size={10} className="text-slate-400" />
                             </div>
                             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                               {log.userName}
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-800/50 text-xs text-slate-300 font-mono break-all whitespace-pre-wrap leading-relaxed bg-slate-900 p-3 rounded-lg border-l-2 border-l-blue-500">
                        {log.details || "Nenhum detalhe adicional"}
                      </div>
                    </div>
                  ))}
                </div>

                {totalAuditPages > 1 && (
                  <div className="flex justify-center flex-wrap gap-2 mt-6 pt-4 border-t border-slate-700">
                    <button onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage === 1} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-bold tracking-widest uppercase" aria-label="Ant">
                      Ant
                    </button>
                    {Array.from({ length: totalAuditPages }).map((_, i) => (
                      <button key={i} onClick={() => setAuditPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${auditPage === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`} aria-label="Botão">
                        {i + 1}
                      </button>
                    ))}
                    <button onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))} disabled={auditPage === totalAuditPages} className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-bold tracking-widest uppercase" aria-label="Próx">
                      Próx
                    </button>
                  </div>
                )}
                
                {onLoadMoreAuditLogs && auditLogs.length > 0 && auditLogs.length % 50 === 0 && (
                  <div className="flex justify-center mt-6">
                     <button onClick={onLoadMoreAuditLogs} className="px-6 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300 rounded-xl transition-all text-xs font-bold tracking-widest uppercase" aria-label="Carregar mais logs...">
                       Carregar mais logs...
                     </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;
