import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';

interface SystemSettingsPasswordModalProps {
  isOpen: boolean;
  onApproved: () => void;
  onClose: () => void;
}

const SystemSettingsPasswordModal: React.FC<SystemSettingsPasswordModalProps> = ({
  isOpen,
  onApproved,
  onClose
}) => {
  const [passwordInput, setPasswordInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (passwordInput === '456') {
      onApproved();
      onClose();
      setPasswordInput('');
      return;
    }

    toast.error('Acesso Negado', { description: 'Senha incorreta. Tente novamente.' });
    setPasswordInput('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-slate-800 p-12 rounded-xl shadow-2xl w-full max-w-sm text-center space-y-8 animate-in zoom-in-95 duration-300 border border-slate-700"
      >
        <div className="space-y-2">
          <div className="w-16 h-16 bg-slate-900 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Settings size={32} />
          </div>
          <h2 className="text-2xl font-bold uppercase italic tracking-tighter text-white">Configurações</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha do Sistema</p>
        </div>

        <input
          autoFocus
          type="password"
          value={passwordInput}
          onChange={event => setPasswordInput(event.target.value)}
          placeholder="••••"
          className="w-full py-6 bg-slate-900 border-2 border-slate-700 rounded-xl text-center text-4xl font-bold text-white outline-none focus:border-slate-500 focus:bg-slate-900 transition-all placeholder:text-slate-600"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white transition-colors"
            aria-label="Cancelar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-semibold uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-700 transition-all active:scale-95"
            aria-label="Confirmar"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
};

export default SystemSettingsPasswordModal;
