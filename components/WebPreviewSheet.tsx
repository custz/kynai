import React from 'react';
import { WebSource } from '../types';
import { XIcon, GlobeIcon, ExternalLinkIcon } from './Icons';

interface WebPreviewSheetProps {
  source: WebSource | null;
  onClose: () => void;
}

export const WebPreviewSheet: React.FC<WebPreviewSheetProps> = ({ source, onClose }) => {
  if (!source) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 h-[85vh] bg-[#1e1e1e] rounded-t-3xl z-50 flex flex-col shadow-2xl animate-slide-up border-t border-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-surfaceLight flex items-center justify-center flex-shrink-0">
                    <GlobeIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{source.title}</h3>
                    <span className="text-xs text-textMuted truncate">{source.uri}</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <a 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 text-textMuted hover:text-primary transition-colors rounded-full hover:bg-white/5"
                    title="Open in new tab"
                 >
                    <ExternalLinkIcon className="w-5 h-5" />
                 </a>
                <button 
                    onClick={onClose}
                    className="p-2 text-textMuted hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white w-full relative">
            <iframe
                src={source.uri}
                className="w-full h-full border-0"
                title={source.title}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
            {/* Fallback overlay if iframe is blocked (common in modern sites) - visually implemented as a hint */}
            <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 text-center opacity-80 pointer-events-none">
                If the content doesn't load, use the external link button above.
            </div>
        </div>
      </div>
    </>
  );
};