
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { User } from '../types';
import { storageService } from '../services/storageService';

// --- Tool Definition ---
const vectorSearchTool: FunctionDeclaration = {
  name: 'search_knowledge_base',
  parameters: {
    type: Type.OBJECT,
    description: 'Search for specific information about Rafsanjan in the knowledge base.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query.',
      },
    },
    required: ['query'],
  },
};

const getSystemInstruction = async (user: User) => {
  const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const tasks = await storageService.getTasks(user.id);
  const tasksSummary = tasks.map(t => `- ${t.title} (${t.status})`).join('\n');

  return `
شما "شهریار" هستید، هوش مصنوعی بومی و هوشمند شهر رفسنجان.
تاریخ امروز: ${today} است.
دستورالعمل‌های اختصاصی کاربر: ${user.customInstructions || 'ندارد'}
دانش شما شامل مکان‌های دیدنی، پسته و فرهنگ رفسنجان است.
لیست کارهای کاربر:
${tasksSummary || 'فعلا کاری ندارد'}

اگر اطلاعات تخصصی نیاز داشتید، از ابزار "search_knowledge_base" استفاده کنید.
پاسخ‌های شما باید کوتاه، صوتی و با لحن محاوره‌ای باشد.
`;
};

// Mock Logic
const getLocalKnowledge = (query: string) => {
    return `اطلاعات برای "${query}": رفسنجان بزرگترین تولید کننده پسته در جهان است. جاذبه‌های گردشگری شامل خانه حاج آقا علی، موزه ریاست جمهوری و بازار تاریخی است.`;
};

export const useLiveGemini = (user: User | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const connect = useCallback(async () => {
    try {
      const apiKey = process.env.API_KEY || process.env.REACT_APP_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instruction = await getSystemInstruction(user!);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: instruction,
          tools: [{ functionDeclarations: [vectorSearchTool] }],
        },
        callbacks: {
          onopen: () => {
            console.log("Connection Opened");
            setIsConnected(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Tool Calls Locally
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'search_knowledge_base') {
                    const query = (fc.args as any).query;
                    console.log("Mocking Vector Store:", query);
                    
                    const result = getLocalKnowledge(query);
                    
                    // Send Response Back to Model
                    sessionPromise.then(session => {
                        session.sendToolResponse({
                            functionResponses: [{
                                id: fc.id,
                                name: fc.name,
                                response: { result: result }
                            }]
                        });
                    });
                }
              }
            }

            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              const ctx = outputAudioContextRef.current;
              if (!ctx) return;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setIsSpeaking(false);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              console.log("Interrupted");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            console.log("Connection Closed");
            setIsConnected(false);
            setIsSpeaking(false);
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection Error");
            setIsConnected(false);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
    }
  }, [user]);

  const disconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
    }
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    setIsConnected(false);
    setIsSpeaking(false);
  }, []);

  return { isConnected, isSpeaking, error, connect, disconnect };
};
