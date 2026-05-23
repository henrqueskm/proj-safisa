import React from 'react';
import { User } from 'lucide-react';
import { AppUser } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  loginPassword: string;
  loginUsername: string;
  setIsOpen: (open: boolean) => void;
  setLoginPassword: (value: string) => void;
  setLoginUsername: (value: string) => void;
  users: AppUser[];
  onLogin: (event: React.FormEvent, users: AppUser[]) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  loginPassword,
  loginUsername,
  setIsOpen,
  setLoginPassword,
  setLoginUsername,
  users,
  onLogin
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsOpen(false)} />
      <form
        onSubmit={event => onLogin(event, users)}
        className="relative bg-slate-900/90 backdrop-blur-3xl p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700/50"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="space-y-2">
          <div className="w-20 h-20 bg-slate-800 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50 shadow-xl">
            <User size={36} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-widest text-white">Login</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Entre com suas credenciais</p>
        </div>

        <div className="space-y-4">
          <input
            autoFocus
            type="text"
            value={loginUsername}
            onChange={event => setLoginUsername(event.target.value)}
            placeholder="Usuário"
            className="w-full py-4 px-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-xl font-bold text-white outline-none focus:border-emerald-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner"
          />
          <input
            type="password"
            value={loginPassword}
            onChange={event => setLoginPassword(event.target.value)}
            placeholder="Senha"
            className="w-full py-4 px-6 bg-slate-950/50 border-2 border-slate-800 rounded-2xl text-center text-xl tracking-[0.3em] font-mono font-black text-white outline-none focus:border-emerald-500 focus:bg-slate-900 transition-all placeholder:text-slate-700 shadow-inner"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            aria-label="Cancelar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition-all active:scale-95"
            aria-label="Entrar"
          >
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginModal;
