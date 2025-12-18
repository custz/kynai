import React, { useState, useRef, useEffect } from 'react';
import { MenuIcon, PlusIcon, WhaleLogo } from './components/Icons';
import { InputArea } from './components/InputArea';
import { ChatMessage } from './components/ChatMessage';
import { Sidebar } from './components/Sidebar';
import { WebPreviewSheet } from './components/WebPreviewSheet';
import { Message, MessageRole, Attachment, ChatSession, WebSource, ModelProvider } from './types';
import { streamChatResponse } from './services/gemini';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedWebSource, setSelectedWebSource] = useState<WebSource | null>(null);
  const [modelProvider, setModelProvider] = useState<ModelProvider>('gemini');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // --- Persistence ---
  useEffect(() => {
    const savedSessions = localStorage.getItem('kynai_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
            const lastSession = parsed.sort((a: ChatSession, b: ChatSession) => b.timestamp - a.timestamp)[0];
            setCurrentSessionId(lastSession.id);
            setMessages(lastSession.messages);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kynai_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
        setSessions(prev => prev.map(session => 
            session.id === currentSessionId 
            ? { ...session, messages: messages, title: session.title === 'New Chat' ? (messages[0]?.text.slice(0, 30) || 'New Chat') : session.title } 
            : session
        ));
    }
  }, [messages, currentSessionId]);

  // --- Scroll Logic ---
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      isAtBottomRef.current = distanceToBottom < 60;
    }
  };

  useEffect(() => {
    if (isAtBottomRef.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'auto' });
    }
  }, [messages]);

  const createNewSession = () => {
      const newId = uuidv4();
      const newSession: ChatSession = {
          id: newId,
          title: 'New Chat',
          messages: [],
          timestamp: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      setMessages([]);
  };

  const handleNewChat = () => {
      createNewSession();
      setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      setIsSidebarOpen(false);
  };

  const handleDeleteAll = () => {
      if (window.confirm("Are you sure you want to delete all chat history?")) {
          setSessions([]);
          setMessages([]);
          setCurrentSessionId(null);
          setIsSidebarOpen(false);
      }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[], useSearch: boolean, useDeepThink: boolean) => {
    if (!currentSessionId) {
        const newId = uuidv4();
        const newSession: ChatSession = {
            id: newId,
            title: text.slice(0, 30) || 'New Chat',
            messages: [],
            timestamp: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
    }

    const userMsg: Message = {
      id: uuidv4(),
      role: MessageRole.USER,
      text: text,
      timestamp: Date.now(),
      attachments: attachments
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    isAtBottomRef.current = true;

    const botMsgId = uuidv4();
    try {
      const botMsg: Message = {
        id: botMsgId,
        role: MessageRole.MODEL,
        text: '',
        timestamp: Date.now(),
        isStreaming: true,
        modelProvider: modelProvider
      };

      setMessages((prev) => [...prev, botMsg]);

      await streamChatResponse(
        [...messages, userMsg],
        text,
        modelProvider === 'gemini' ? useSearch : false,
        useDeepThink,
        (chunk, metadata) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? { 
                    ...msg, 
                    text: msg.text + chunk,
                    groundingMetadata: metadata || msg.groundingMetadata
                  }
                : msg
            )
          );
        },
        modelProvider
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    } catch (error) {
      console.error("Failed to generate response", error);
      setMessages((prev) => 
        prev.map(msg => 
            msg.id === botMsgId 
            ? { ...msg, text: "Sorry, something went wrong. Please try again.", isStreaming: false } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isWelcomeScreen = messages.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-textMain font-sans overflow-hidden h-[100dvh]">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteAll={handleDeleteAll}
      />

      <WebPreviewSheet 
        source={selectedWebSource} 
        onClose={() => setSelectedWebSource(null)} 
      />

      {/* Rigid Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 h-14 bg-background/80 backdrop-blur-xl border-b border-white/5 z-30">
        <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-textMuted hover:text-white rounded-lg active:scale-90 transition-all"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        
        <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
            <button
                onClick={() => setModelProvider('gemini')}
                className={`px-4 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    modelProvider === 'gemini' ? 'bg-surfaceLight text-white' : 'text-textMuted'
                }`}
            >
                Gemini
            </button>
            <button
                onClick={() => setModelProvider('gpt')}
                className={`px-4 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    modelProvider === 'gpt' ? 'bg-surfaceLight text-white' : 'text-textMuted'
                }`}
            >
                GPT-4o
            </button>
        </div>

        <button 
            onClick={handleNewChat}
            className="p-2 -mr-2 text-textMuted hover:text-white rounded-lg active:scale-90 transition-all"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Main Container */}
      <div className="relative flex-1 flex flex-col overflow-hidden w-full max-w-2xl mx-auto">
        
        {/* Scrollable Message Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 pt-4 scroll-smooth scrollbar-hide"
        >
          {isWelcomeScreen ? (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in">
              <div className="mb-6 relative">
                 <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse"></div>
                 <WhaleLogo className="w-16 h-16 text-primary relative z-10" />
              </div>
              <h1 className="text-xl font-medium text-white tracking-tight">How can I help you?</h1>
            </div>
          ) : (
            <div className="max-w-full">
              {messages.map((msg) => (
                <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onSourceClick={(source) => setSelectedWebSource(source)}
                />
              ))}
              <div className="h-2" />
            </div>
          )}
        </div>

        {/* Floating Input Area - Fixed at bottom of main */}
        <div className="flex-shrink-0 w-full px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent">
          <InputArea onSend={handleSendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
};

export default App;