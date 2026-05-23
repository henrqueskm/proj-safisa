import { useMemo } from 'react';
import { ROLE_DATA } from '../constants';
import { AppUser, ChatMessage, UserRole } from '../types';
import { generateId } from '../lib/utils';
import { supabase } from '../supabase';
import { cleanData } from './useOrderManagement';

interface UseChatActionsParams {
  activeRole: UserRole | null;
  loggedInUser: AppUser | null;
  messages: ChatMessage[];
}

export function useChatActions({ activeRole, loggedInUser, messages }: UseChatActionsParams) {
  const currentIdentity = loggedInUser?.id || activeRole;

  const unreadCount = useMemo(() => {
    if (!currentIdentity) return 0;
    return messages.filter(message => message.recipient === currentIdentity && !message.isRead).length;
  }, [currentIdentity, messages]);

  const sendMessage = async (text: string, recipient: string, senderName?: string) => {
    if (!activeRole) return;

    const sender = loggedInUser?.id || activeRole;
    await supabase.from('messages').insert({
      id: generateId(),
      data: cleanData({
        sender,
        recipient,
        senderName: senderName || ROLE_DATA[activeRole].label,
        text,
        timestamp: Date.now(),
        isRead: false
      })
    });
  };

  const readMessages = async (sender: string) => {
    if (!currentIdentity) return;

    const unreadMessages = messages.filter(message =>
      message.sender === sender &&
      message.recipient === currentIdentity &&
      !message.isRead
    );

    await Promise.all(unreadMessages.map(message =>
      supabase.from('messages').update({
        data: { ...message, isRead: true }
      }).eq('id', message.id)
    ));
  };

  return {
    unreadCount,
    sendMessage,
    readMessages
  };
}
