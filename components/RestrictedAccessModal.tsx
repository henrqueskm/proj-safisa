import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

interface RestrictedAccessModalProps {
  isOpen: boolean;
  passwordInput: string;
  pendingRole: UserRole | null;
  setPasswordInput: (value: string) => void;
  setPendingRole: (role: UserRole | null) => void;
  onConfirm: () => void;
}

const RestrictedAccessModal: React.FC<RestrictedAccessModalProps> = ({
  isOpen,
  passwordInput,
  pendingRole,
  setPasswordInput,
  setPendingRole,
  onConfirm
}) => {
  if (!isOpen || !pendingRole) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setPendingRole(null)} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        className="relative bg-slate-900/90 backdrop-blur-3xl p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700/50"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
        <div className="space-y-2">
          <div className="w-20 h-20 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50 shadow-xl">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-widest text-white">Acesso Restrito</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Identifique-se para continuar</p>
        </div>

        <input
          autoFocus
          type="password"
          value={passwordInput}
          onChange={event => setPasswordInput(event.target.value)}
          placeholder="••••"
          className="w-full py-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-5xl tracking-[0.3em] font-mono font-black text-white outline-none focus:border-slate-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPendingRole(null)}
            className="flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            aria-label="Cancelar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] bg-slate-700 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(71,85,105,0.3)] hover:shadow-[0_0_30px_rgba(71,85,105,0.5)] hover:bg-slate-600 transition-all active:scale-95"
            aria-label="Confirmar"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
};

export default RestrictedAccessModal;
