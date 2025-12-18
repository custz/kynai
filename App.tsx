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
  // --- State ---
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


  // --- Event Handlers ---

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const isBottom = distanceToBottom < 50;
      isAtBottomRef.current = isBottom;
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
        if (isAtBottomRef.current) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
      if (isAtBottomRef.current && scrollContainerRef.current) {
           scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [messages.length, messages[messages.length-1]?.text]);

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
    setTimeout(() => {
        if (scrollContainerRef.current) {
             scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, 10);

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
        modelProvider === 'gemini' ? useSearch : false, // Only Gemini supports the search tool config currently
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
    <div className="flex flex-col h-screen bg-background text-textMain font-sans overflow-hidden selection:bg-primary/30">
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteAll={handleDeleteAll}
      />

      {/* Web Preview Sheet */}
      <WebPreviewSheet 
        source={selectedWebSource} 
        onClose={() => setSelectedWebSource(null)} 
      />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 py-4 z-30 flex-shrink-0 bg-background/80 backdrop-blur-md sticky top-0 border-b border-white/5">
        <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-textMuted hover:text-white transition-all duration-200 rounded-lg hover:bg-white/5 active:scale-90 active:bg-white/10 group"
        >
          <MenuIcon className="w-6 h-6 group-hover:text-primary transition-colors" />
        </button>
        
        {/* Model Switcher */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center bg-white/5 backdrop-blur-xl rounded-full p-1 border border-white/5 shadow-inner">
                <button
                    onClick={() => setModelProvider('gemini')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                        modelProvider === 'gemini'
                        ? 'bg-surfaceLight text-white shadow-lg'
                        : 'text-textMuted hover:text-white'
                    }`}
                >
                    Gemini
                </button>
                <button
                    onClick={() => setModelProvider('gpt')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                        modelProvider === 'gpt'
                        ? 'bg-surfaceLight text-white shadow-lg'
                        : 'text-textMuted hover:text-white'
                    }`}
                >
                    GPT-4o
                </button>
            </div>
        </div>

        <button 
            onClick={handleNewChat}
            className="p-2 -mr-2 text-textMuted hover:text-white transition-all duration-200 rounded-lg hover:bg-white/5 active:scale-90 active:bg-white/10 group"
        >
          <PlusIcon className="w-6 h-6 group-hover:text-primary transition-colors" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col w-full max-w-3xl mx-auto overflow-hidden relative transition-transform duration-300 ${isSidebarOpen && window.innerWidth >= 768 ? 'translate-x-36 scale-95 opacity-80' : ''}`}>
        
        {/* Welcome Screen */}
        {isWelcomeScreen && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in px-4">
            <div className="mb-6 relative group cursor-default">
               <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse transition-all duration-1000 group-hover:bg-primary/30 group-hover:scale-175"></div>
               <WhaleLogo className="w-20 h-20 text-primary relative z-10 transition-transform duration-500 group-hover:scale-110" />
            </div>
            <h1 className="text-2xl font-medium text-white tracking-tight text-center">
              How can I help you?
            </h1>
          </div>
        )}

        {/* Chat History */}
        {!isWelcomeScreen && (
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 pt-4 scrollbar-thin scrollbar-thumb-surfaceLight scrollbar-track-transparent min-h-0"
          >
            <div className="max-w-3xl mx-auto w-full">
              {messages.map((msg) => (
                <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onSourceClick={(source) => setSelectedWebSource(source)}
                />
              ))}
              <div className="h-4" />
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 relative z-20 w-full">
           <div className="absolute bottom-0 left-0 right-0 top-[-60px] bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none" />
           <div className="px-4 pb-4 pt-2">
              <InputArea onSend={handleSendMessage} disabled={isLoading} />
           </div>
        </div>
      </main>

    </div>
  );
};

export default App;