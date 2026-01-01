import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { User, ChatMessage, ChatSession, Attachment } from '../types';
import { storageService } from '../services/storageService';
import { 
  Send, Loader2, Sparkles, Globe, ExternalLink, 
  Menu, Plus, MessageSquare, Trash2, X, Paperclip, 
  FileText, ImageIcon, ChevronDown, Bot, User as UserIcon, CornerDownLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatProps {
  user: User;
}

// --- Styles for Animations ---
const animationStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .animate-message {
    animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .glass-header {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .typing-cursor::after {
    content: '▋';
    display: inline-block;
    vertical-align: baseline;
    animation: blink 1s step-end infinite;
    color: #0d9488;
    font-size: 0.8em;
    margin-right: 2px;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
`;

export const Chat: React.FC<ChatProps> = ({ user }) => {
  // --- State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [processingTool, setProcessingTool] = useState(false);
  
  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Effects ---
  useEffect(() => {
    const loadData = async () => {
        const loadedSessions = await storageService.getSessions(user.id);
        const latestSession = loadedSessions[0];
        if (!latestSession || latestSession.messages.length > 0) {
            try {
                const newSession = await storageService.createSession(user.id);
                setSessions([newSession, ...loadedSessions]);
                setCurrentSession(newSession);
            } catch (e) {
                console.error("Error creating initial session", e);
                setSessions(loadedSessions);
                if (loadedSessions.length > 0) setCurrentSession(loadedSessions[0]);
            }
        } else {
            setSessions(loadedSessions);
            setCurrentSession(latestSession);
        }
    };
    loadData();
  }, [user.id]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (input === '') {
          textarea.style.height = '52px';
          textarea.style.overflowY = 'hidden';
      } else {
          textarea.style.height = 'auto'; 
          const MAX_HEIGHT = 150;
          const DEFAULT_HEIGHT = 52;
          const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
          textarea.style.height = `${Math.max(newHeight, DEFAULT_HEIGHT)}px`;
          textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }
  }, [input]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useLayoutEffect(() => {
    scrollToBottom('auto');
  }, [currentSession?.id]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    if (loading && isNearBottom) scrollToBottom('smooth');
  }, [currentSession?.messages, loading]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  // --- Handlers ---
  const createNewSession = async () => {
    const newSession = await storageService.createSession(user.id);
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
    setIsSidebarOpen(false);
    setInput('');
    setAttachment(null);
    if (textareaRef.current) {
        textareaRef.current.style.height = '52px';
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await storageService.deleteSession(id);
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSession?.id === id) {
      setCurrentSession(updated.length > 0 ? updated[0] : null);
      if (updated.length === 0) createNewSession();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; 
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const data = base64String.split(',')[1];
      setAttachment({ mimeType: file.type, data: data, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    const attachmentToSend = attachment;

    if ((!textToSend && !attachmentToSend) || loading) return;

    setInput('');
    setAttachment(null);
    if (textareaRef.current) {
        textareaRef.current.style.height = '52px';
        textareaRef.current.style.overflowY = 'hidden';
    }

    let activeSession = currentSession;
    if (!activeSession) {
         try {
             const newSession = await storageService.createSession(user.id);
             setSessions(prev => [newSession, ...prev]);
             setCurrentSession(newSession);
             activeSession = newSession;
         } catch (e) { console.error(e); return; }
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
      attachment: attachmentToSend || undefined
    };

    const updatedMessages = [...activeSession.messages, userMsg];
    const sessionWithUserMsg = { 
      ...activeSession, 
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: activeSession.messages.length === 0 ? textToSend.slice(0, 30) : activeSession.title
    };

    const modelMsgId = (Date.now() + 1).toString();
    const modelPlaceholder: ChatMessage = {
        id: modelMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now()
    };
    
    const sessionStreaming = {
        ...sessionWithUserMsg,
        messages: [...updatedMessages, modelPlaceholder]
    };

    setCurrentSession(sessionStreaming);
    await storageService.saveSession(sessionWithUserMsg, user.id); 
    setSessions(prev => [sessionStreaming, ...prev.filter(s => s.id !== sessionStreaming.id)]);

    setLoading(true);

    try {
      const tasks = await storageService.getTasks(user.id);

      // Prepare History for Server
      const history = updatedMessages.slice(-15).map(msg => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.attachment) {
          parts.push({
            inlineData: { mimeType: msg.attachment.mimeType, data: msg.attachment.data }
          });
        }
        return { role: msg.role, parts: parts };
      });

      // Send Request to Backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           history,
           user,
           tasks
        })
      });

      if (!response.ok) {
          throw new Error('Server API Error');
      }

      const data = await response.json();

      const finalMsg: ChatMessage = {
          id: modelMsgId,
          role: 'model',
          text: data.text || "پاسخی دریافت نشد.",
          timestamp: Date.now(),
          sources: data.sources
      };

      const finalSession = {
          ...sessionStreaming,
          messages: [...updatedMessages, finalMsg],
          updatedAt: Date.now()
      };

      setCurrentSession(finalSession);
      await storageService.saveSession(finalSession, user.id);
      setSessions(prev => [finalSession, ...prev.filter(s => s.id !== finalSession.id)]);

    } catch (error: any) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: `خطا در ارتباط با سرور: ${error.message}`,
        timestamp: Date.now()
      };
      
      setCurrentSession(prev => {
          if(!prev) return null;
          const msgsWithoutPlaceholder = prev.messages.filter(m => m.id !== modelMsgId);
          return { ...prev, messages: [...msgsWithoutPlaceholder, errorMsg] };
      });
    } finally {
      setLoading(false);
      setProcessingTool(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      <style>{animationStyles}</style>
      
      {/* Sidebar Overlay */}
      <div 
        className={`absolute inset-0 bg-slate-900/60 z-30 transition-opacity duration-300 backdrop-blur-sm ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={`
        absolute inset-y-0 right-0 z-40 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-5 border-b border-slate-100 bg-teal-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-100" />
            <h3 className="font-bold text-lg">تاریخچه</h3>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="hover:bg-teal-500/50 p-1 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
           <button 
             onClick={createNewSession}
             className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors font-bold text-sm mb-4 border border-teal-200 dashed"
           >
             <Plus className="w-4 h-4" />
             گفتگوی جدید
           </button>
           {sessions.map(session => (
             <div 
               key={session.id}
               onClick={() => { setCurrentSession(session); setIsSidebarOpen(false); }}
               className={`group relative flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border ${
                 currentSession?.id === session.id 
                 ? 'bg-white border-teal-500 shadow-md shadow-teal-500/10 z-10' 
                 : 'bg-transparent border-transparent hover:bg-slate-100'
               }`}
             >
                <div className="flex flex-col overflow-hidden">
                   <span className={`text-sm font-medium truncate ${currentSession?.id === session.id ? 'text-slate-900' : 'text-slate-600'}`}>
                     {session.title || 'گفتگوی بدون عنوان'}
                   </span>
                   <span className="text-[10px] text-slate-400 mt-0.5">
                     {new Date(session.updatedAt).toLocaleDateString('fa-IR')}
                   </span>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className={`p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ${currentSession?.id === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
           ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full h-full relative">
        <div className="glass-header px-4 py-3 shadow-sm border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 transition-all">
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
               <Menu className="w-6 h-6" />
             </button>
             <div className="flex flex-col">
                <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                  {currentSession?.title || 'شهریار'}
                  <Sparkles className="w-3 h-3 text-teal-500" />
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                   هوش مصنوعی آنلاین
                </div>
             </div>
          </div>
          <button onClick={createNewSession} className="bg-teal-50 text-teal-600 p-2 rounded-xl hover:bg-teal-100 transition-colors shadow-sm active:scale-95">
             <Plus className="w-5 h-5" />
          </button>
        </div>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar scroll-smooth bg-slate-50/50 z-10"
        >
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-message">
              <div className="w-20 h-20 bg-gradient-to-tr from-teal-400 to-emerald-300 rounded-3xl shadow-xl shadow-teal-200/50 flex items-center justify-center mb-6 rotate-3">
                 <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">سلام {user.name} عزیز!</h2>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">من <span className="text-teal-600 font-bold">شهریار</span> هستم. دستیار هوشمند شهر رفسنجان.</p>
            </div>
          ) : (
            currentSession.messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full animate-message ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center flex-shrink-0 ml-3 shadow-md mt-1">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-start' : 'items-end'}`}>
                  <div className={`relative px-4 py-3 rounded-2xl text-sm leading-7 shadow-sm border ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none border-slate-700' : 'bg-white text-slate-800 rounded-tl-none border-slate-100'}`}>
                    {msg.attachment && (
                      <div className="mb-3 p-2 bg-black/10 rounded-xl flex items-center gap-3 backdrop-blur-sm">
                         {msg.attachment.mimeType.startsWith('image/') ? <ImageIcon className="w-5 h-5 opacity-80" /> : <FileText className="w-5 h-5 opacity-80" />}
                         <span className="text-xs truncate max-w-[150px] opacity-90 dir-ltr">{msg.attachment.name}</span>
                      </div>
                    )}
                    <div className={`markdown-content ${msg.role === 'model' ? 'prose-sm' : ''} ${loading && idx === currentSession.messages.length - 1 && msg.role === 'model' ? 'typing-cursor' : ''}`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === 'model' && msg.sources && (
                      <div className="mt-2 flex flex-wrap gap-2 justify-end w-full">
                          {msg.sources.map((source, idx) => (
                              <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-white border border-teal-100 text-teal-700 px-2 py-1 rounded-full text-[9px] hover:bg-teal-50 transition-colors shadow-sm">
                                  <Globe className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[100px]">{source.title}</span>
                              </a>
                          ))}
                      </div>
                  )}
                </div>
              </div>
            ))
          )}
          {processingTool && (
             <div className="flex justify-end pr-14 animate-pulse">
                <span className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-lg border border-teal-100 flex items-center gap-1">
                   <Sparkles className="w-3 h-3" />
                   در حال جستجو در پایگاه دانش...
                </span>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {showScrollButton && (
          <button onClick={() => scrollToBottom()} className="absolute bottom-24 left-4 bg-slate-800 text-white p-2 rounded-full shadow-lg z-20 animate-bounce opacity-90 hover:opacity-100">
            <ChevronDown className="w-5 h-5" />
          </button>
        )}

        <div className="p-3 bg-white border-t border-slate-100 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.08)] z-20">
           {attachment && (
             <div className="mb-3 mx-1 bg-teal-50 border border-teal-100 rounded-2xl p-2.5 flex justify-between items-center animate-message">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-teal-600 shadow-sm">
                      {attachment.mimeType.startsWith('image/') ? <ImageIcon className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                   </div>
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-teal-800 truncate max-w-[200px]">{attachment.name}</span>
                      <span className="text-[10px] text-teal-600/70">فایل پیوست شده</span>
                   </div>
                </div>
                <button onClick={() => setAttachment(null)} className="p-2 hover:bg-teal-100 rounded-full text-teal-600 transition">
                  <X className="w-4 h-4" />
                </button>
             </div>
           )}

          <div className="flex items-end gap-2 relative">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect}/>
            
            <button 
                onClick={() => fileInputRef.current?.click()} 
                className={`w-[52px] h-[52px] rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 border ${attachment ? 'bg-teal-100 text-teal-600 border-teal-200' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <Paperclip className="w-5 h-5 transform rotate-45" />
            </button>
            
            <div className="flex-1 bg-slate-100 rounded-[26px] border border-transparent focus-within:border-teal-500/30 focus-within:bg-white focus-within:shadow-md focus-within:shadow-teal-500/5 transition-all duration-300 min-h-[52px] flex items-center relative">
                <textarea 
                    ref={textareaRef} 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} 
                    placeholder="پیام خود را بنویسید..." 
                    className="w-full bg-transparent px-5 py-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none text-right font-medium resize-none text-sm leading-[24px] overflow-hidden" 
                    rows={1} 
                    style={{ height: '52px' }}
                    dir="rtl" 
                />
            </div>
            
            <button 
                onClick={handleSend} 
                disabled={(!input.trim() && !attachment) || loading} 
                className={`w-[52px] h-[52px] rounded-full flex-shrink-0 shadow-lg transition-all duration-300 flex items-center justify-center group ${(!input.trim() && !attachment) || loading ? 'bg-slate-100 text-slate-300 shadow-none scale-95' : 'bg-gradient-to-tr from-teal-600 to-emerald-500 text-white hover:shadow-teal-500/40 active:scale-95'}`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5 group-hover:scale-110 transition-transform" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};