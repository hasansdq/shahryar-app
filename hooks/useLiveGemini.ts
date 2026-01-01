import { useState, useRef, useCallback } from 'react';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { User } from '../types';

export const useLiveGemini = (user: User | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const connect = useCallback(async () => {
    try {
      setError(null);

      // Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Connect to Server WS
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`; // Connects to same host/port
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
          console.log("WS to Server Open");
          // Start Audio Recording
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              processorRef.current = scriptProcessor;

              scriptProcessor.onaudioprocess = (e) => {
                  if (ws.readyState === WebSocket.OPEN) {
                      const inputData = e.inputBuffer.getChannelData(0);
                      const blob = createBlob(inputData); // returns { data: base64, mimeType }
                      ws.send(JSON.stringify({ type: 'audio', data: blob.data }));
                  }
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
          } catch (e) {
              console.error("Mic Error", e);
              setError("خطا در دسترسی به میکروفون");
          }
      };

      ws.onmessage = async (event) => {
          try {
              const msg = JSON.parse(event.data);
              
              if (msg.type === 'connected') {
                  setIsConnected(true);
              } else if (msg.type === 'audio') {
                  setIsSpeaking(true);
                  const ctx = outputAudioContextRef.current;
                  if (!ctx) return;
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  
                  // Decode
                  const audioBuffer = await decodeAudioData(decode(msg.data), ctx, 24000, 1);
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

              } else if (msg.type === 'interrupted') {
                  console.log("Interrupted");
                  sourcesRef.current.forEach(s => s.stop());
                  sourcesRef.current.clear();
                  nextStartTimeRef.current = 0;
                  setIsSpeaking(false);
              } else if (msg.type === 'error') {
                  console.error("Server Error:", msg.message);
                  setError(msg.message || "خطا در ارتباط");
              }
          } catch (e) {
              console.error("WS Parse Error", e);
          }
      };

      ws.onclose = () => {
          console.log("WS Closed");
          setIsConnected(false);
          setIsSpeaking(false);
      };

      ws.onerror = () => {
          setError("خطا در اتصال به سرور");
          setIsConnected(false);
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
  }, []);

  return { isConnected, isSpeaking, error, connect, disconnect };
};