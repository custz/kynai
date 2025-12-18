import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, MessageRole, WebSource } from '../types';
import { WhaleLogo, FileGenericIcon, GlobeIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon, BoltIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
  onSourceClick?: (source: WebSource) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSourceClick }) => {
  const isUser = message.role === MessageRole.USER;
  const isStreaming = message.isStreaming;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  
  // State to track thinking box toggle
  const [isThinkingOpen, setIsThinkingOpen] = useState(true);

  // Parsing logic for <think> tags
  // We split the message.text into "thought" and "final response"
  let thoughtContent = "";
  let finalContent = "";
  let isThinkingProcess = false;

  const rawText = message.text || "";
  const cleanText = rawText.trimStart();

  if (!isUser) {
      const thinkRegex = /<think>([\s\S]*?)<\/think>/;
      const match = rawText.match(thinkRegex);
      
      if (match) {
          // Case 1: Completed thinking block
          thoughtContent = match[1];
          finalContent = rawText.replace(match[0], "").trim();
      } else if (cleanText.startsWith("<think>")) {
          // Case 2: Streaming, strictly inside thinking block
          isThinkingProcess = true;
          thoughtContent = cleanText.replace("<think>", "");
      } else if (isStreaming && cleanText.length < 10 && cleanText.startsWith("<") && "<think>".startsWith(cleanText)) {
          // Case 3: Streaming, starting to type <think>, prevent raw text flicker
          isThinkingProcess = true;
          thoughtContent = ""; // Waiting for more text
      } else {
          // Case 4: No thinking block found (yet) or regular text
          finalContent = rawText;
      }
  } else {
      finalContent = rawText;
  }
  
  // Initialize displayed text for typewriter effect on the FINAL content only
  const [displayedText, setDisplayedText] = useState(isUser ? finalContent : '');
  const hasStartedRef = useRef(isUser);

  // Extract grounding metadata chunks for cleaner access
  const webSources = message.groundingMetadata?.groundingChunks
    ?.filter(chunk => chunk.web)
    .map(chunk => chunk.web!) || [];

  useEffect(() => {
    if (isUser) {
        setDisplayedText(finalContent);
        return;
    }

    // If finalContent resets to empty (rare), clear display
    if (!finalContent && !hasStartedRef.current) {
        setDisplayedText('');
    }

    // If finalContent appears (e.g., after thinking finishes), immediately start showing it
    // If it's the very first chunk of text, show it immediately without animation lag
    if (finalContent && displayedText === '') {
        setDisplayedText(finalContent.slice(0, 5)); // Start with a few chars to reduce perception of lag
    }

    let intervalId: any;

    // Typewriter effect loop for the final answer part
    if (displayedText.length < finalContent.length) {
        intervalId = setInterval(() => {
            setDisplayedText((current) => {
                if (current.length < finalContent.length) {
                    const diff = finalContent.length - current.length;
                    // Faster typing for longer text blocks to prevent falling behind
                    const chunkSize = Math.max(1, Math.floor(diff / 20)) + (Math.random() > 0.5 ? 2 : 1); 
                    return finalContent.slice(0, current.length + chunkSize);
                }
                return current;
            });
        }, 10); // Faster interval
    } else if (finalContent.length < displayedText.length) {
        // Handle case where text might be trimmed or corrected (rare but possible)
        setDisplayedText(finalContent);
    }

    return () => clearInterval(intervalId);
  }, [finalContent, displayedText.length, isUser]);

  // Determine if we are in the "Thinking..." state
  // 1. Streaming and no text yet.
  // 2. Streaming and we are inside the thinking process block.
  const showThinkingSpinner = !isUser && isStreaming && (rawText.length === 0 || (isThinkingProcess && thoughtContent.length === 0));

  const getBadgeStyle = (provider?: string) => {
    switch (provider) {
        case 'gemini':
            return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        case 'gpt':
            return 'bg-green-500/10 text-green-400 border border-green-500/20';
        default:
            return 'bg-surfaceLight text-textMuted border border-white/10';
    }
  };

  const getBadgeIcon = (provider?: string) => {
    switch (provider) {
        case 'gemini': return <SparklesIcon size={10} />;
        case 'gpt': return <BoltIcon size={10} />;
        default: return <SparklesIcon size={10} />;
    }
  };

  const getBadgeText = (provider?: string) => {
    switch (provider) {
        case 'gemini': return 'Gemini 2.5';
        case 'gpt': return 'GPT-4o';
        default: return 'AI';
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      
      {/* AI Avatar with Loading Spinner Border */}
      {!isUser && (
        <div className="relative w-8 h-8 flex-shrink-0 mr-3 mt-1 group">
             {/* The Spinning/Static Border */}
             <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500 box-border
                ${showThinkingSpinner
                    ? 'border-white/10 border-t-white border-r-white/50 animate-spin' // Loading: Chasing tail effect
                    : 'border-white/20' // Done: Solid circle
                }`}
            />
            
            {/* The Logo or Model Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                <WhaleLogo className="w-4 h-4 text-primary" />
            </div>
            
            {/* Model Badge on Hover (for standard avatar) or displayed always if explicitly set */}
        </div>
      )}
      
      <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Model Badge Header for AI Messages */}
        {!isUser && message.modelProvider && (
            <div className={`flex items-center gap-1.5 mb-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase w-fit ${getBadgeStyle(message.modelProvider)}`}>
                {getBadgeIcon(message.modelProvider)}
                <span>{getBadgeText(message.modelProvider)}</span>
            </div>
        )}

        {/* Attachments Display */}
        {hasAttachments && (
            <div className={`flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {message.attachments!.map((att) => (
                    <div key={att.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-surfaceLight/30">
                        {att.type === 'image' ? (
                            <img 
                                src={`data:${att.mimeType};base64,${att.data}`} 
                                alt={att.name}
                                className="h-32 w-auto object-cover max-w-[200px]"
                            />
                        ) : (
                            <div className="flex items-center gap-3 p-3 min-w-[150px]">
                                <div className="p-2 bg-white/5 rounded-lg">
                                    <FileGenericIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-medium text-white truncate max-w-[120px]">{att.name}</span>
                                    <span className="text-[10px] text-textMuted uppercase">{att.size}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}

        {/* Deep Thinking Box */}
        {(thoughtContent || (isThinkingProcess && thoughtContent.length > 0)) && (
            <div className="w-full mb-2 animate-fade-in">
                <div 
                    onClick={() => setIsThinkingOpen(!isThinkingOpen)}
                    className="flex items-center gap-2 cursor-pointer text-textMuted/70 hover:text-textMuted transition-colors mb-1 select-none"
                >
                    {isThinkingOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                    <span className="text-xs font-medium tracking-wide">Thought Process</span>
                </div>
                
                {isThinkingOpen && (
                    <div className="bg-black/20 border-l-2 border-primary/30 pl-4 py-3 pr-4 rounded-r-xl text-sm text-textMuted/90 leading-relaxed max-w-full overflow-hidden">
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
                            <ReactMarkdown components={{
                                p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>
                            }}>
                                {thoughtContent}
                            </ReactMarkdown>
                        </div>
                        {isThinkingProcess && isStreaming && (
                            <div className="flex items-center gap-2 mt-2 text-primary/70 text-xs animate-pulse opacity-80">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
                                <span className="font-mono">Thinking...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Text Message */}
        {(finalContent || showThinkingSpinner) && (
            <div className={`${isUser ? 'bg-surfaceLight/50 text-white rounded-2xl px-4 py-2' : 'text-gray-100'} w-full`}>
                {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                ) : (
                    <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl max-w-none min-h-[24px]">
                        {showThinkingSpinner ? (
                            <div className="flex items-center gap-2 py-1">
                                <span className="text-textMuted/70 text-sm animate-pulse">Thinking...</span>
                            </div>
                        ) : (
                            <>
                                {/* Show "Searching..." if streaming and message has grounding data but text is short/starting */}
                                {isStreaming && webSources.length > 0 && displayedText.length < 10 && (
                                     <div className="flex items-center gap-2 mb-2 text-primary/80 text-sm">
                                        <GlobeIcon className="w-4 h-4 animate-spin" />
                                        <span>Searching...</span>
                                     </div>
                                )}
                                
                                <ReactMarkdown 
                                components={{
                                    p: ({children}) => <p className="mb-2 last:mb-0 inline-block">{children}</p>
                                }}
                                >
                                {displayedText}
                                </ReactMarkdown>
                                {isStreaming && !isThinkingProcess && (
                                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-primary animate-pulse rounded-sm" />
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Sources / Grounding Display */}
        {!isUser && webSources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 animate-fade-in">
                {webSources.map((source, idx) => (
                    <button 
                        key={idx}
                        onClick={() => onSourceClick && onSourceClick(source)}
                        className="flex items-center gap-2 max-w-[200px] border border-white/10 bg-surfaceLight/30 hover:bg-surfaceLight/60 rounded-full px-3 py-1.5 transition-colors text-left group"
                    >
                        <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[8px] text-textMuted font-bold uppercase">
                            {source.title.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                             <span className="text-[10px] font-medium text-textMuted group-hover:text-primary transition-colors truncate">
                                {source.title}
                             </span>
                        </div>
                    </button>
                ))}
            </div>
        )}

      </div>
    </div>
  );
};
