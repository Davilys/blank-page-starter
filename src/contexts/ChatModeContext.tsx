import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatModeContextType {
  chatMode: 'selector' | 'chatweb' | 'botconversa' | 'webconversa' | 'consultoria' | 'viabilidade' | 'marcasia' | null;
  setChatMode: (mode: 'selector' | 'chatweb' | 'botconversa' | 'webconversa' | 'consultoria' | 'viabilidade' | 'marcasia' | null) => void;
}

const ChatModeContext = createContext<ChatModeContextType>({
  chatMode: null,
  setChatMode: () => {},
});

export function ChatModeProvider({ children }: { children: ReactNode }) {
  const [chatMode, setChatMode] = useState<'selector' | 'chatweb' | 'botconversa' | 'webconversa' | 'consultoria' | 'viabilidade' | 'marcasia' | null>(null);
  return (
    <ChatModeContext.Provider value={{ chatMode, setChatMode }}>
      {children}
    </ChatModeContext.Provider>
  );
}

export function useChatMode() {
  return useContext(ChatModeContext);
}
