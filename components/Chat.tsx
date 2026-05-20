import { safeFormatDate, safeToUpper } from '../lib/utils';

import React, { useState, useRef, useEffect } from 'react';
import { UserRole, ChatMessage, AppUser } from '../types';
import { ROLE_DATA } from '../constants';
import { Send, X, MessageSquare, Clock, Users, ArrowLeft, User, CheckCheck, Smile } from 'lucide-react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';

interface ChatProps {
  messages: ChatMessage[];
  activeRole: UserRole;
  users: AppUser[];
  loggedInUser: AppUser | null;
  onSendMessage: (text: string, recipient: UserRole | string, senderName?: string) => void;
  onReadMessages: (sender: UserRole | string) => void;
  onClose: () => void;
}

const Chat: React.FC<ChatProps> = ({ messages, activeRole, users, loggedInUser, onSendMessage, onReadMessages, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [targetId, setTargetId] = useState<UserRole | string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const availableRoles = Object.values(UserRole).filter(role => role !== activeRole);
  
  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Filter users who are not the current logged-in user
  const otherUsers = users.filter(u => u.id !== loggedInUser?.id);

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, targetId]);

  // Marcar mensagens como lidas ao selecionar um alvo ou ao receber novas mensagens do alvo atual
  useEffect(() => {
    if (targetId) {
      const currentRecipientId = loggedInUser?.id || activeRole;
      const hasUnread = messages.some(m => m.sender === targetId && m.recipient === currentRecipientId && !m.isRead);
      if (hasUnread) {
        onReadMessages(targetId);
      }
    }
  }, [messages, targetId, activeRole, loggedInUser, onReadMessages]);

  const currentSenderId = loggedInUser?.id || activeRole;

  const filteredMessages = messages.filter(msg => 
    (msg.sender === currentSenderId && msg.recipient === targetId) ||
    (msg.sender === targetId && msg.recipient === currentSenderId)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !targetId) return;
    onSendMessage(inputText.trim(), targetId, loggedInUser?.name);
    setInputText('');
  };

  const getTargetLabel = (id: UserRole | string) => {
    if (Object.values(UserRole).includes(id as UserRole)) {
      return ROLE_DATA[id as UserRole].label;
    }
    return users.find(u => u.id === id)?.name || 'Usuário';
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const isUserOnline = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    // Consider online if isOnline is true and lastSeen is within last 2 minutes
    return user.isOnline && user.lastSeen && (Date.now() - user.lastSeen < 120000);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col w-[90vw] md:w-[400px] h-[600px] max-h-[85vh] bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-10 no-print">
      <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {targetId ? (
            <button onClick={() => setTargetId(null)} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Botão"><ArrowLeft size={18}/></button>
          ) : <MessageSquare size={18} />}
          <div>
            <h4 className="font-semibold text-[10px] uppercase tracking-widest italic leading-none">
              {targetId ? `Falar com ${getTargetLabel(targetId)}` : 'Chat Safisa'}
            </h4>
            {!targetId && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Selecione o destinatário</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Fechar"><X size={18}/></button>
      </div>

      {!targetId ? (
        <div className="flex-1 p-6 space-y-6 bg-slate-900 overflow-y-auto">
           <div className="space-y-3">
             <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Setores:</h5>
             <div className="grid grid-cols-1 gap-2">
               {availableRoles.map(role => {
                 const currentRecipientId = loggedInUser?.id || activeRole;
                 const unreadCount = messages.filter(m => m.sender === role && m.recipient === currentRecipientId && !m.isRead).length;
                 return (
                   <button 
                     key={role}
                     onClick={() => setTargetId(role)}
                     className="w-full flex items-center justify-between p-3 bg-slate-800 rounded-2xl border border-slate-700 shadow-sm hover:border-slate-500 transition-all group"
                    aria-label="Botão">
                     <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${ROLE_DATA[role].color}`}>
                           <Users size={16} />
                        </div>
                        <div className="text-left">
                           <span className="block font-bold text-white text-[10px] uppercase italic">{ROLE_DATA[role].label}</span>
                        </div>
                     </div>
                     {unreadCount > 0 && (
                       <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg">{unreadCount}</span>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>

           <div className="space-y-3">
             <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usuários:</h5>
             <div className="grid grid-cols-1 gap-2">
               {otherUsers.map(user => {
                 const currentRecipientId = loggedInUser?.id || activeRole;
                 const unreadCount = messages.filter(m => m.sender === user.id && m.recipient === currentRecipientId && !m.isRead).length;
                 const online = isUserOnline(user.id);
                 return (
                   <button 
                     key={user.id}
                     onClick={() => setTargetId(user.id)}
                     className="w-full flex items-center justify-between p-3 bg-slate-800 rounded-2xl border border-slate-700 shadow-sm hover:border-slate-500 transition-all group"
                    aria-label="Botão">
                     <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white relative">
                           <User size={16} />
                           {online && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full shadow-sm" />
                           )}
                        </div>
                        <div className="text-left">
                           <span className="block font-bold text-white text-[10px] uppercase italic">{user.name}</span>
                           <span className="block text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                             {online ? 'Online' : 'Offline'}
                           </span>
                        </div>
                     </div>
                     {unreadCount > 0 && (
                       <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg">{unreadCount}</span>
                     )}
                   </button>
                 );
               })}
               {otherUsers.length === 0 && (
                 <p className="text-[8px] font-bold text-slate-600 uppercase text-center py-4">Nenhum outro usuário cadastrado</p>
               )}
             </div>
           </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-900">
            {filteredMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-20 py-20 text-white">
                 <MessageSquare size={32} />
                 <p className="text-[9px] font-bold uppercase tracking-widest">Inicie a conversa</p>
              </div>
            )}
            {filteredMessages.map((msg) => {
              const isMe = msg.sender === currentSenderId;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-xl text-xs font-bold shadow-sm whitespace-pre-wrap break-words ${
                    isMe 
                      ? 'bg-slate-700 text-white rounded-tr-none' 
                      : 'bg-slate-800 text-white rounded-tl-none border border-slate-700'
                  }`}>
                    {msg.text}
                    <div className={`text-[7px] mt-1 flex items-center gap-0.5 ${isMe ? 'text-slate-300 justify-end' : 'text-slate-400 justify-start'}`}>
                      {msg.isRead ? <CheckCheck size={10} /> : <Clock size={8} />}
                      <span>{safeFormatDate(msg.timestamp, 'time')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form 
            onSubmit={handleSubmit} 
            className="p-3 bg-slate-800 border-t border-slate-700 flex items-end space-x-2 relative"
          >
            {showEmojiPicker && (
              <div className="absolute bottom-full left-2 mb-2 z-50 shadow-2xl" ref={emojiPickerRef}>
                <EmojiPicker 
                  onEmojiClick={onEmojiClick} 
                  theme={Theme.DARK} 
                  searchPlaceHolder="Buscar..."
                  width={280}
                  height={320}
                  style={{
                    '--epr-emoji-size': '24px',
                    '--epr-category-navigation-button-size': '24px',
                  } as React.CSSProperties}
                />
              </div>
            )}
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="p-3 text-slate-400 rounded-xl hover:text-white hover:bg-slate-700 transition-all mb-0.5 shrink-0"
              title="Emojis"
             aria-label="Emojis">
              <Smile size={16} />
            </button>
            <textarea 
              autoFocus
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-slate-500 resize-none max-h-32"
            />
            <button type="submit" className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-950 shadow-md transition-all active:scale-95 mb-0.5 shrink-0" aria-label="Botão">
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Chat;
