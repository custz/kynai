import React from 'react';
import { ChatSession, IconProps } from '../types';
import { WhaleLogo, PlusIcon, XIcon, SettingsIcon, TrashIcon } from './Icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteAll: () => void;
}

const SettingsItem: React.FC<{ icon: React.FC<IconProps>, label: string }> = ({ icon: Icon, label }) => (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-textMuted hover:text-white hover:bg-white/5 cursor-pointer transition-colors group">
        <Icon className="w-5 h-5 group-hover:text-primary transition-colors" />
        <span className="text-sm font-medium">{label}</span>
    </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat,
  onDeleteAll
}) => {
  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-[#171717] border-r border-white/5 z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-semibold tracking-wide">
                    <WhaleLogo className="w-8 h-8 text-primary" />
                    <span>KynAI</span>
                </div>
                <button onClick={onClose} className="md:hidden p-1 text-textMuted hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <button 
                onClick={() => {
                    onNewChat();
                    if (window.innerWidth < 768) onClose();
                }}
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primaryHover text-white py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-primary/20 active:scale-95 font-medium"
            >
                <PlusIcon className="w-5 h-5" />
                <span>New Chat</span>
            </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-surfaceLight scrollbar-track-transparent">
            <div className="text-xs font-semibold text-textMuted/50 uppercase tracking-wider px-3 mb-2">History</div>
            <div className="flex flex-col gap-1">
                {sessions.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-textMuted italic text-center opacity-50">
                        No chat history yet.
                    </div>
                ) : (
                    sessions.sort((a,b) => b.timestamp - a.timestamp).map(session => (
                        <button
                            key={session.id}
                            onClick={() => {
                                onSelectSession(session);
                                if (window.innerWidth < 768) onClose();
                            }}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all duration-200 border border-transparent ${
                                currentSessionId === session.id 
                                ? 'bg-surfaceLight/50 text-white border-white/5' 
                                : 'text-textMuted hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span className="text-sm font-medium truncate w-full">
                                {session.title}
                            </span>
                            <span className="text-[10px] opacity-60">
                                {new Date(session.timestamp).toLocaleDateString()}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>

        {/* Footer / Settings */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-1 bg-[#121212]">
            <SettingsItem icon={SettingsIcon} label="Settings" />
            <div onClick={onDeleteAll}>
                <SettingsItem icon={TrashIcon} label="Delete All History" />
            </div>
        </div>
      </div>
    </>
  );
};