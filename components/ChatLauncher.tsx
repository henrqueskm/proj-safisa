import React from 'react';
import { MessageSquare } from 'lucide-react';

interface ChatLauncherProps {
  unreadCount: number;
  onOpen: () => void;
}

const ChatLauncher: React.FC<ChatLauncherProps> = ({ unreadCount, onOpen }) => {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 no-print"
      aria-label="Abrir chat"
    >
      <MessageSquare size={24} />
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-4 border-slate-950 animate-bounce">
          {unreadCount}
        </div>
      )}
    </button>
  );
};

export default ChatLauncher;
