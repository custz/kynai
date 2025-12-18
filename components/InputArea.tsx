import React, { useState, useRef } from 'react';
import { GlobeIcon, PaperclipIcon, ArrowUpIcon, VoiceIcon, XIcon, FileGenericIcon, DeepThinkIcon } from './Icons';
import { Attachment } from '../types';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import mammoth from 'mammoth';

interface InputAreaProps {
  onSend: (text: string, attachments: Attachment[], useSearch: boolean, useDeepThink: boolean) => void;
  disabled?: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isDeepThinkActive, setIsDeepThinkActive] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMimeType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf', 'csv': 'text/csv', 'txt': 'text/plain',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return ext ? (mimeMap[ext] || 'application/octet-stream') : 'application/octet-stream';
  };

  const utf8_to_b64 = (str: string) => window.btoa(unescape(encodeURIComponent(str)));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Fix: Explicitly type files as File[] to prevent 'unknown' inference and related property access errors
      const files: File[] = Array.from(e.target.files);
      const newAtts: Attachment[] = [];
      for (const file of files) {
        let base64Data = '';
        let mimeType = getMimeType(file);
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'docx') {
          const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
          base64Data = utf8_to_b64(res.value);
          mimeType = 'text/plain';
        } else if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(await file.arrayBuffer());
          let csv = "";
          wb.SheetNames.forEach(n => csv += `--- ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}\n`);
          base64Data = utf8_to_b64(csv);
          mimeType = 'text/csv';
        } else {
          base64Data = await new Promise((res) => {
            const r = new FileReader();
            r.onloadend = () => res((r.result as string).split(',')[1] || '');
            r.readAsDataURL(file);
          });
        }

        if (base64Data) {
          newAtts.push({
            id: uuidv4(), mimeType, data: base64Data, name: file.name,
            size: formatFileSize(file.size),
            type: mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('audio/') ? 'audio' : 'file'
          });
        }
      }
      setAttachments(prev => [...prev, ...newAtts]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if ((input.trim() || attachments.length > 0) && !disabled) {
      onSend(input, attachments, isSearchActive, isDeepThinkActive);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const hasContent = input.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full relative">
      <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

      {/* Brand Label */}
      <div className="flex justify-center mb-2">
        <span className="text-[9px] font-bold text-textMuted/30 uppercase tracking-[0.3em] select-none">
          Zent Technology Inc.
        </span>
      </div>

      <div className="relative rounded-[28px] overflow-hidden" 
           style={{ boxShadow: '0 8px 30px -10px rgba(0,0,0,0.5)' }}>
        
        {/* Animated Border Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[28px]">
          <div className="absolute left-[-50%] top-[-50%] w-[200%] h-[200%] animate-spin-slow"
               style={{ background: 'conic-gradient(from 0deg, #ff0055, #0056ff, #ff0055)' }} />
        </div>

        {/* Inner Content Box */}
        <div className="relative z-10 m-[1.5px] bg-[#1a1a1a] rounded-[26px] overflow-hidden">
          <div className="px-4 py-3 flex flex-col gap-2">
            
            {/* Horizontal Attachment Scroller */}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {attachments.map(att => (
                  <div key={att.id} className="relative flex-shrink-0 group">
                    <div className="flex items-center gap-2 bg-surface/50 rounded-xl px-2 py-1.5 border border-white/5 min-w-[120px] max-w-[160px]">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                        {att.type === 'image' ? (
                          <img src={`data:${att.mimeType};base64,${att.data}`} className="w-full h-full object-cover rounded-md" />
                        ) : <FileGenericIcon size={16} className="text-primary" />}
                      </div>
                      <span className="text-[11px] font-medium truncate">{att.name}</span>
                    </div>
                    <button onClick={() => setAttachments(p => p.filter(a => a.id !== att.id))} 
                            className="absolute -top-1 -right-1 bg-neutral-700 rounded-full p-0.5 shadow-lg">
                      <XIcon size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Row */}
            <div className="flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                placeholder="Message KynAI..."
                rows={1}
                className="w-full bg-transparent text-white placeholder-textMuted/40 resize-none outline-none leading-relaxed text-[15px] py-1"
              />

              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsSearchActive(!isSearchActive)}
                          className={`p-2 rounded-full transition-all ${isSearchActive ? 'text-primary bg-primary/10' : 'text-textMuted'}`}>
                    <GlobeIcon size={18} />
                  </button>
                  <button onClick={() => setIsDeepThinkActive(!isDeepThinkActive)}
                          className={`p-2 rounded-full transition-all ${isDeepThinkActive ? 'text-purple-400 bg-purple-400/10' : 'text-textMuted'}`}>
                    <DeepThinkIcon size={18} />
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-textMuted">
                    <PaperclipIcon size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!hasContent ? (
                    <button className="p-2 text-textMuted bg-white/5 rounded-full"><VoiceIcon size={18} /></button>
                  ) : (
                    <button onClick={handleSubmit} 
                            className="p-2 bg-primary text-white rounded-full shadow-lg shadow-primary/20 animate-fade-in">
                      <ArrowUpIcon size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
