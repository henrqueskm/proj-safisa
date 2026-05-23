import React from 'react';
import { Settings, ShieldCheck, Truck, User, X } from 'lucide-react';
import { ROLE_DATA } from '../constants';
import { AppUser, UserRole } from '../types';

interface RoleSelectionScreenProps {
  loggedInUser: AppUser | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onSelectRole: (role: UserRole) => void;
}

const roleDescriptions: Record<UserRole.ADMIN | UserRole.ASSEMBLY | UserRole.EXPEDITION, string> = {
  [UserRole.ADMIN]: 'Gestão e Faturamento',
  [UserRole.ASSEMBLY]: 'Produção e Testes',
  [UserRole.EXPEDITION]: 'Separação e Envio'
};

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  loggedInUser,
  onLogout,
  onOpenLogin,
  onOpenSettings,
  onSelectRole
}) => {
  const selectableRoles = [UserRole.ADMIN, UserRole.ASSEMBLY, UserRole.EXPEDITION];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      {loggedInUser ? (
        <div className="absolute top-6 left-6 flex items-center gap-4 bg-slate-900/50 p-2 pr-4 rounded-xl backdrop-blur-md border border-slate-800 z-50">
          <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-white">
            {loggedInUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Logado como</p>
            <p className="text-sm font-bold text-white">{loggedInUser.name}</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-4 p-2 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-900/30 rounded-xl transition-all"
            title="Sair"
            aria-label="Sair"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenLogin}
          className="absolute top-6 left-6 px-6 py-3 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all shadow-sm z-50 backdrop-blur-md border border-slate-800 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"
          aria-label="Fazer Login"
        >
          <User size={16} /> Fazer Login
        </button>
      )}

      <button
        onClick={onOpenSettings}
        className="absolute top-6 right-6 p-3 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all shadow-sm z-50 backdrop-blur-md border border-slate-800"
        aria-label="Configurações"
      >
        <Settings size={24} />
      </button>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-700 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl w-full text-center space-y-16 relative z-10">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter italic leading-none">
            SAFISA<span className="text-slate-500">.</span>
          </h1>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.3em]">
            Industrial Management System
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {selectableRoles.map(role => (
            <button
              key={role}
              onClick={() => onSelectRole(role)}
              className="bg-slate-900/40 backdrop-blur-3xl p-12 rounded-3xl border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all text-center group relative overflow-hidden shadow-2xl hover:shadow-[0_0_40px_rgba(79,70,229,0.15)] flex flex-col items-center hover:-translate-y-2"
              aria-label={ROLE_DATA[role].label}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute -inset-24 bg-gradient-to-b from-slate-500/5 to-transparent rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:bg-slate-700 group-hover:border-slate-500 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(71,85,105,0.4)] text-slate-400 transition-all duration-500 relative z-10">
                {role === UserRole.ADMIN ? <ShieldCheck size={32} /> : role === UserRole.ASSEMBLY ? <Settings size={32} /> : <Truck size={32} />}
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-3 relative z-10">
                {ROLE_DATA[role].label}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors relative z-10">
                {roleDescriptions[role]}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 w-full text-center z-10 pointer-events-none">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest flex items-center justify-center pointer-events-auto">
          Desenvolvido por Henrique Klein
        </p>
      </div>
    </div>
  );
};

export default RoleSelectionScreen;
