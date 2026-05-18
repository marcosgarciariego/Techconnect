import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../lib/api';

interface UseSocketOptions {
  token?: string | null;
  autoConnect?: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  body: string;
  isRead: boolean;
  sentAt: string;
  sender: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
}

export function useSocket(options: UseSocketOptions = {}) {
  const { token, autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io(getSocketUrl(), {
      auth: token ? { token } : undefined,
      withCredentials: true,
      autoConnect: false,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message:new', (message: Message) => {
      setLastMessage(message);
    });

    socket.connect();
  }, [token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join:conversation', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave:conversation', conversationId);
  }, []);

  const sendMessage = useCallback((conversationId: string, body: string) => {
    socketRef.current?.emit('message:send', { conversationId, body });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:start', conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing:stop', conversationId);
  }, []);

  const onNewMessage = useCallback((callback: (message: Message) => void) => {
    socketRef.current?.on('message:new', callback);
    return () => {
      socketRef.current?.off('message:new', callback);
    };
  }, []);

  const onTypingStart = useCallback(
    (callback: (data: { conversationId: string; userId: string }) => void) => {
      socketRef.current?.on('typing:start', callback);
      return () => {
        socketRef.current?.off('typing:start', callback);
      };
    },
    []
  );

  const onTypingStop = useCallback(
    (callback: (data: { conversationId: string; userId: string }) => void) => {
      socketRef.current?.on('typing:stop', callback);
      return () => {
        socketRef.current?.off('typing:stop', callback);
      };
    },
    []
  );

  const onMessagesRead = useCallback(
    (callback: (data: { conversationId: string; readBy: string }) => void) => {
      socketRef.current?.on('messages:read', callback);
      return () => {
        socketRef.current?.off('messages:read', callback);
      };
    },
    []
  );

  const onUnreadUpdate = useCallback((callback: () => void) => {
    socketRef.current?.on('unread:update', callback);
    return () => {
      socketRef.current?.off('unread:update', callback);
    };
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    lastMessage,
    connect,
    disconnect,
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    onNewMessage,
    onTypingStart,
    onTypingStop,
    onMessagesRead,
    onUnreadUpdate,
  };
}
