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
  const [isFocused, setIsFocused] = useState(false);
  
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
      'pdf': 'application/pdf',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'py': 'text/x-python',
      'html': 'text/html',
      'css': 'text/css',
      'xml': 'application/xml',
      'rtf': 'application/rtf'
    };
    return ext ? (mimeMap[ext] || 'application/octet-stream') : 'application/octet-stream';
  };

  // Helper to encode UTF-8 strings to Base64 (handles Unicode correctly)
  const utf8_to_b64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      const files: File[] = Array.from(e.target.files);

      for (const file of files) {
        try {
          let base64Data = '';
          let mimeType = getMimeType(file);
          const ext = file.name.split('.').pop()?.toLowerCase();

          // Document Conversion Logic
          if (ext === 'docx') {
             const arrayBuffer = await file.arrayBuffer();
             const result = await mammoth.extractRawText({ arrayBuffer });
             base64Data = utf8_to_b64(result.value);
             mimeType = 'text/plain'; // Send extracted text as plain text
          } 
          else if (ext === 'xlsx' || ext === 'xls') {
             const arrayBuffer = await file.arrayBuffer();
             const workbook = XLSX.read(arrayBuffer);
             let csvText = "";
             workbook.SheetNames.forEach((sheetName: string) => {
                const sheet = workbook.Sheets[sheetName];
                csvText += `--- Sheet: ${sheetName} ---\n`;
                csvText += XLSX.utils.sheet_to_csv(sheet);
                csvText += "\n\n";
             });
             base64Data = utf8_to_b64(csvText);
             mimeType = 'text/csv'; // Send extracted data as CSV
          }
          // Default handling for PDF, Images, Audio, Video, Text
          else {
              base64Data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  if (result) {
                      resolve(result.split(',')[1] || '');
                  } else {
                      resolve('');
                  }
                };
                reader.readAsDataURL(file);
              });
          }

          if (!base64Data) continue;

          let type: 'image' | 'video' | 'audio' | 'file' = 'file';
          if (mimeType.startsWith('image/')) type = 'image';
          else if (mimeType.startsWith('video/')) type = 'video';
          else if (mimeType.startsWith('audio/')) type = 'audio';

          newAttachments.push({
            id: uuidv4(),
            mimeType: mimeType,
            data: base64Data,
            name: file.name,
            size: formatFileSize(file.size),
            type
          });

        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          alert(`Could not process ${file.name}. Ensure it is a valid file.`);
        }
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleSubmit = () => {
    if ((input.trim() || attachments.length > 0) && !disabled) {
      onSend(input, attachments, isSearchActive, isDeepThinkActive);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const hasText = input.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-3xl mx-auto relative z-20">
      
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx,.csv,.json,.xml,.rtf"
      />

      {/* Footer Text */}
      <div className="flex justify-center mb-3">
        <span className="text-[10px] font-semibold text-textMuted/40 uppercase tracking-[0.2em] select-none">
          Zent Technology Inc.
        </span>
      </div>

      {/* 
        Input Wrapper
        Uses a layered approach for the animated gradient border.
      */}
      <div 
        className="relative rounded-[32px] transition-all duration-300"
        style={{
            // Static Glow Effect: Left Red (#ff0055), Right Blue (#0056ff)
            boxShadow: `
                -12px 0 35px -8px rgba(255, 0, 85, 0.25), 
                12px 0 35px -8px rgba(0, 86, 255, 0.25),
                0 10px 20px -5px rgba(0,0,0,0.5)
            `
        }}
      >
        {/* Layer 1: The Rotating Gradient "Border" */}
        {/* We use overflow-hidden on a wrapper to clip the massive spinning gradient */}
        <div className="absolute inset-0 rounded-[32px] overflow-hidden z-0">
             {/* The spinning element is much larger than the container to ensure coverage during rotation */}
             <div 
                className="absolute left-[-50%] top-[-50%] w-[200%] h-[200%] animate-spin-slow"
                style={{
                    background: 'conic-gradient(from 0deg, #ff0055, #0056ff, #ff0055)'
                }}
             />
        </div>

        {/* Layer 2: The Inner Content (The actual input field) */}
        {/* Margin of 2px reveals the spinning gradient behind it, creating the border effect */}
        <div className="relative z-10 bg-[#2d2d2d] rounded-[30px] m-[2px]">
            <div className="px-6 py-4 flex flex-col gap-3">
            
            {/* Attachments Row */}
            {attachments.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {attachments.map((att) => (
                    <div key={att.id} className="relative group flex-shrink-0 animate-fade-in">
                    <div className="flex items-center gap-3 bg-surfaceLight/50 border border-white/10 rounded-2xl pr-3 pl-2 py-1.5 h-14 min-w-[140px] max-w-[200px]">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/20 flex items-center justify-center flex-shrink-0">
                        {att.type === 'image' ? (
                            <img 
                            src={`data:${att.mimeType};base64,${att.data}`} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                            />
                        ) : (
                            <FileGenericIcon className="w-5 h-5 text-textMuted" />
                        )}
                        </div>
                        <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-gray-200 truncate w-full block leading-tight">
                            {att.name}
                        </span>
                        <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold mt-0.5">
                            {att.size}
                        </span>
                        </div>
                        <button 
                        onClick={() => removeAttachment(att.id)}
                        className="absolute -top-1.5 -right-1.5 bg-neutral-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-500"
                        >
                        <XIcon size={12} />
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}

            {/* Text Area */}
            <div className="w-full min-h-[44px]">
                <textarea
                ref={textareaRef}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isSearchActive ? "Ask anything..." : (isDeepThinkActive ? "Ask a complex question..." : "Message KynAI")}
                rows={1}
                disabled={disabled}
                className="w-full bg-transparent text-white placeholder-textMuted/60 resize-none outline-none max-h-[200px] overflow-y-auto leading-relaxed scrollbar-hide text-[15px] py-1.5"
                />
            </div>

            {/* Bottom Toolbar */}
            <div className="flex justify-between items-end pt-1">
                
                {/* Left: Tools */}
                <div className="flex gap-1 text-textMuted -ml-2">
                    <button 
                    onClick={() => setIsSearchActive(!isSearchActive)}
                    className={`group transition-all duration-300 p-2.5 rounded-full active:scale-95 ${
                        isSearchActive 
                        ? 'text-primary bg-primary/10' 
                        : 'text-textMuted hover:text-white hover:bg-white/5'
                    }`}
                    title={isSearchActive ? "Turn off Search" : "Search Web"}
                    >
                    <GlobeIcon className={`w-5 h-5 transition-transform duration-300 ${isSearchActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    </button>
                    
                    <button 
                    onClick={() => setIsDeepThinkActive(!isDeepThinkActive)}
                    className={`group transition-all duration-300 p-2.5 rounded-full active:scale-95 ${
                        isDeepThinkActive 
                        ? 'text-purple-400 bg-purple-500/10' 
                        : 'text-textMuted hover:text-white hover:bg-white/5'
                    }`}
                    title={isDeepThinkActive ? "Turn off Deep Reasoning" : "Deep Reasoning"}
                    >
                    <DeepThinkIcon className={`w-5 h-5 transition-transform duration-300 ${isDeepThinkActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 -mr-1">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="group hover:text-primary transition-all duration-300 p-2.5 rounded-full hover:bg-white/5 active:scale-95 text-textMuted"
                        title="Add Attachment"
                    >
                        <PaperclipIcon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                    </button>

                    <div className="relative w-10 h-10">
                        <button
                            className={`absolute inset-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                                hasText 
                                ? 'opacity-0 scale-50 pointer-events-none' 
                                : 'opacity-100 scale-100 bg-surfaceLight hover:bg-white/10 text-white'
                            }`}
                            title="Voice Input"
                        >
                            <VoiceIcon className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={!hasText || disabled}
                            className={`absolute inset-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                                hasText && !disabled
                                ? 'opacity-100 scale-100 bg-primary hover:bg-primaryHover text-white shadow-lg shadow-primary/30'
                                : 'opacity-0 scale-50 pointer-events-none'
                            }`}
                        >
                            <ArrowUpIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
      </div>
      
      {/* Status Text */}
      <div className="text-center mt-2 h-4">
        <p className="text-xs text-textMuted/40 font-medium tracking-wide">
          {[
            isDeepThinkActive && "Deep Reasoning",
            isSearchActive && "Web Search"
          ].filter(Boolean).join(" & ") + (isDeepThinkActive || isSearchActive ? " enabled." : "")}
        </p>
      </div>
    </div>
  );
};