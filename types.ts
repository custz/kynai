
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export type ModelProvider = 'gemini' | 'gpt';

export interface Attachment {
  id: string;
  mimeType: string;
  data: string; // Base64 string
  name: string;
  size: string; // Formatted size string (e.g. "2 MB")
  type: 'image' | 'video' | 'audio' | 'file';
}

export interface WebSource {
  uri: string;
  title: string;
}

export interface GroundingMetadata {
  groundingChunks: {
    web?: WebSource;
  }[];
  webSearchQueries?: string[];
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isStreaming?: boolean;
  groundingMetadata?: GroundingMetadata | null;
  // Although we parse <think> tags dynamically, keeping a flag might be useful for future enhancements
  isThinking?: boolean; 
  modelProvider?: ModelProvider; // Tracks which model generated this message
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface IconProps {
  className?: string;
  size?: number;
}
