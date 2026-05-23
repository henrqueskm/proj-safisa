import React from 'react';
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelTop,
  Printer,
  Sun
} from 'lucide-react';
import { ROLE_DATA } from '../constants';
import { UserRole } from '../types';
import { ThemeState } from '../hooks/useTheme';

interface AppHeaderProps {
  activeRole: UserRole;
  notificationPermission: NotificationPermission;
  pendingActionsCount: number;
  printers: string[];
  selectedPrinter: string;
  setActiveRole: (role: UserRole | null) => void;
  setSelectedPrinter: (printer: string) => void;
  setShowSummaryCards: (show: boolean) => void;
  setShowTabs: (show: boolean) => void;
  showSummaryCards: boolean;
  showTabs: boolean;
  themeState: ThemeState;
  onRequestNotificationPermission: () => void;
  onToggleTheme: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  activeRole,
  notificationPermission,
  pendingActionsCount,
  printers,
  selectedPrinter,
  setActiveRole,
  setSelectedPrinter,
  setShowSummaryCards,
  setShowTabs,
  showSummaryCards,
  showTabs,
  themeState,
  onRequestNotificationPermission,
  onToggleTheme
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center px-6 justify-between sticky top-0 z-50 no-print">
      <div className="flex items-center gap-4">
        <span className="font-bold text-white italic tracking-tighter text-xl">SAFISA PRO</span>
        <div className="h-6 w-[2px] bg-slate-800 mx-1"></div>
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {ROLE_DATA[activeRole].label}
        </span>

        {activeRole === UserRole.EXPEDITION && (
          <>
            <div className="h-6 w-[2px] bg-slate-800 mx-1"></div>
            <div className="bg-slate-800 p-1.5 px-3 rounded-xl border border-slate-700 flex items-center gap-2 shadow-sm max-w-[200px]">
              <Printer className="text-slate-400 shrink-0" size={14} />
              <select
                value={selectedPrinter}
                onChange={event => setSelectedPrinter(event.target.value)}
                className="bg-transparent border-none outline-none font-bold text-[10px] uppercase text-white w-full truncate cursor-pointer"
                title="Impressora"
              >
                {printers.length === 0 && <option value="">Buscando...</option>}
                {printers.map(printer => (
                  <option key={printer} value={printer} className="bg-slate-800">
                    {printer}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowTabs(!showTabs)}
              className={`p-2 border rounded-xl transition-all shadow-sm ${showTabs ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`}
              title="Alternar Abas"
              aria-label="Alternar Abas"
            >
              <PanelTop size={14} />
            </button>
            <button
              onClick={() => setShowSummaryCards(!showSummaryCards)}
              className={`p-2 border rounded-xl transition-all shadow-sm ${showSummaryCards ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'}`}
              title="Alternar Cards de Resumo"
              aria-label="Alternar Cards de Resumo"
            >
              <LayoutDashboard size={14} />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {notificationPermission !== 'granted' && (
          <button
            onClick={onRequestNotificationPermission}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-all group"
            title="Ativar Alertas na Área de Trabalho"
            aria-label="Ativar Alertas na Área de Trabalho"
          >
            <Bell size={14} className="group-hover:animate-bounce" />
            <span className="text-[8px] font-bold uppercase tracking-widest">Ativar Alertas</span>
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="hidden sm:flex items-center justify-center p-2 rounded-xl transition-all hover:bg-slate-800 text-slate-400 hover:text-white"
          title="Alternar Tema (Claro/Escuro)"
          aria-label="Alternar Tema (Claro/Escuro)"
        >
          {themeState === 'light' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className={`p-2 rounded-xl transition-all ${pendingActionsCount > 0 ? 'bg-red-50 text-red-500 animate-pulse' : 'text-slate-300'}`}>
          <Bell size={20} />
        </div>
        <div className="h-6 w-[2px] bg-slate-100"></div>
        <button
          onClick={() => setActiveRole(null)}
          className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors font-bold text-xs uppercase tracking-widest"
          aria-label="Sair"
        >
          <span className="hidden sm:inline">Sair</span>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
