import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, MessageRole, GroundingMetadata, ModelProvider } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash'; 

// Common System Instructions
const BASE_INSTRUCTION = "You are KynAI, an advanced AI assistant created by Zent Technology Inc. You represent the future of AI innovation. You are friendly, intelligent, and precise. You can see images, listen to audio, watch videos, and read files provided by the user. Always use Markdown to format your responses neatly.";

const FEW_SHOT_COT = `
    
    Here are examples of the Chain of Thought (CoT) process you must follow:

    [Example 1]
    User: If I have 3 apples and you take away 2, how many do you have?
    Model: <think>
    1. **Analyze the Request**: The user is asking a riddle-like math question.
    2. **Identify Key Elements**:
       - User starts with 3 apples.
       - "You" (the AI) take 2 apples.
       - The question asks "how many do *you* have?".
    3. **Deduce**: The question is about *my* possession, not what's left. If I take 2, I have 2.
    4. **Conclusion**: The answer is 2.
    </think>
    If I take 2 apples, I have 2 apples.

    [Example 2]
    User: What is 15% of 80 plus 5?
    Model: <think>
    1. **Break down the math**:
       - Task 1: Calculate 15% of 80.
       - Task 2: Add 5 to the result.
    2. **Execute Task 1**:
       - 10% of 80 is 8.
       - 5% of 80 is 4.
       - 8 + 4 = 12. So, 15% of 80 is 12.
    3. **Execute Task 2**:
       - 12 + 5 = 17.
    4. **Final Check**: 0.15 * 80 = 12. 12 + 5 = 17. Calculation is correct.
    </think>
    The result is 17.
`;

const getSystemInstruction = (useSearch: boolean, useDeepThink: boolean, provider: ModelProvider) => {
    let instruction = BASE_INSTRUCTION;

    if (useDeepThink) {
        instruction += `\n\nIMPORTANT: You are using a Few-Shot Chain of Thought (CoT) approach. You MUST engage in deep reasoning before answering. Wrap your thought process inside <think> and </think> tags. Use Markdown formatting (lists, bolding, etc.) inside your thoughts to keep them organized. After the closing </think> tag, you MUST provide your final, clear, and detailed response to the user. Do not stop after thinking. The user will only see the text outside the tags as the main answer.\n${FEW_SHOT_COT}`;
    }

    if (useSearch && provider === 'gemini') {
         instruction += "\n\nAdditionally, you have access to Google Search. You MUST use it to verify facts *during* your <think> process if the user asks for real-time info or facts you need to verify. Summarize results clearly and cite sources.";
    }

    return instruction;
};

// --- Gemini Implementation ---
const streamGeminiResponse = async (
    history: Message[],
    newMessage: string,
    useSearch: boolean,
    useDeepThink: boolean,
    onChunk: (text: string, metadata?: GroundingMetadata) => void
) => {
    const contents = history.map(msg => {
      const parts: any[] = [];
      if (msg.text) parts.push({ text: msg.text });
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(att => {
          parts.push({
            inlineData: { mimeType: att.mimeType, data: att.data }
          });
        });
      }
      return {
        role: msg.role === MessageRole.USER ? 'user' : 'model',
        parts: parts,
      };
    });

    const pastContent = contents.slice(0, -1);
    const validHistory = pastContent.filter(c => c.parts.length > 0);
    const tools = useSearch ? [{ googleSearch: {} }] : undefined;
    const thinkingConfig = useDeepThink ? { thinkingBudget: 2048 } : undefined;
    const systemInstruction = getSystemInstruction(useSearch, useDeepThink, 'gemini');

    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      history: validHistory,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        thinkingConfig: thinkingConfig,
      }
    });

    const lastMessage = history[history.length - 1];
    const currentMessageParts: any[] = [];
    if (newMessage) currentMessageParts.push({ text: newMessage });
    if (lastMessage.attachments && lastMessage.attachments.length > 0) {
        lastMessage.attachments.forEach(att => {
            currentMessageParts.push({
                inlineData: { mimeType: att.mimeType, data: att.data }
            });
        });
    }
    if (currentMessageParts.length === 0) currentMessageParts.push({ text: " " });

    const result = await chat.sendMessageStream({ message: currentMessageParts });
    
    let fullText = "";
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      const metadata = c.candidates?.[0]?.groundingMetadata as unknown as GroundingMetadata;
      if (text) fullText += text;
      onChunk(text || "", metadata);
    }
    return fullText;
};

// --- GPT (Pollinations) Implementation ---
const streamGptResponse = async (
    history: Message[],
    newMessage: string,
    useDeepThink: boolean,
    onChunk: (text: string) => void
) => {
    const systemInstruction = getSystemInstruction(false, useDeepThink, 'gpt');
    
    // Construct Pollinations format messages
    const messages = [
        { role: 'system', content: systemInstruction },
        ...history.slice(0, -1).map(msg => ({
            role: msg.role === MessageRole.MODEL ? 'assistant' : 'user', 
            content: msg.text 
        })),
        { role: 'user', content: newMessage }
    ];

    try {
        // Use environment variable if available, otherwise default to public endpoint
        const baseUrl = 'https://text.pollinations.ai/';
        // @ts-ignore
        const url = process.env.POLLINATIONS_API_KEY 
            // @ts-ignore
            ? `${baseUrl}?key=${process.env.POLLINATIONS_API_KEY}` 
            : baseUrl;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages,
                model: 'openai', 
                seed: Math.floor(Math.random() * 1000),
                jsonMode: false
            })
        });

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            onChunk(chunk);
        }
        return fullText;

    } catch (e) {
        console.error("Pollinations API Error", e);
        throw e;
    }
};

// --- Main Handler ---
export const streamChatResponse = async (
  history: Message[],
  newMessage: string,
  useSearch: boolean,
  useDeepThink: boolean,
  onChunk: (text: string, metadata?: GroundingMetadata) => void,
  provider: ModelProvider = 'gemini'
): Promise<string> => {
    if (provider === 'gpt') {
        return await streamGptResponse(history, newMessage, useDeepThink, (text) => onChunk(text));
    } else {
        // Gemini Provider (Default)
        return await streamGeminiResponse(history, newMessage, useSearch, useDeepThink, onChunk);
    }
};