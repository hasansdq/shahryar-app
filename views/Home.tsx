import React, { useEffect, useState, useRef } from 'react';
import { User, Task } from '../types';
import { storageService } from '../services/storageService';
import { 
  MessageSquare, Mic, Calendar, User as UserIcon, 
  Sparkles, Zap, ArrowLeft, Bell, Loader2, Plus, X, Lightbulb
} from 'lucide-react';

interface HomeProps {
  user: User;
  onChangeView: (view: any) => void;
}

const homeStyles = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-soft {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(0.98); }
  }
  .anim-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .delay-1 { animation-delay: 0.1s; }
  .delay-2 { animation-delay: 0.2s; }
  .delay-3 { animation-delay: 0.3s; }
  .glass-panel {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
  }
`;

export const Home: React.FC<HomeProps> = ({ user, onChangeView }) => {
  const [taskCount, setTaskCount] = useState(0);
  const [greeting, setGreeting] = useState('');
  
  // Dynamic Content States
  const [dailySuggestion, setDailySuggestion] = useState<string>('در حال دریافت پیشنهاد روزانه...');
  const [didYouKnow, setDidYouKnow] = useState<string>('در حال یافتن دانستنی‌های رفسنجان...');
  const [loadingDaily, setLoadingDaily] = useState(true);

  // Notification States
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifContent, setNotifContent] = useState('');
  const [notifLoading, setNotifLoading] = useState(false);

  // Smart Task States
  const [smartTaskInput, setSmartTaskInput] = useState('');
  const [smartTaskLoading, setSmartTaskLoading] = useState(false);

  // Helper to get context
  const getUserContext = async () => {
    const tasks = await storageService.getTasks(user.id);
    const sessions = await storageService.getSessions(user.id);
    const recentChats = sessions.slice(0, 3).flatMap(s => s.messages.slice(-3)).map(m => m.text).join(' | ');
    const pendingTasks = tasks.filter(t => t.status === 'todo').map(t => t.title).join(', ');
    return { tasks: pendingTasks, chats: recentChats };
  };

  useEffect(() => {
    const initHome = async () => {
      // 1. Basic Stats
      const tasks = await storageService.getTasks(user.id);
      setTaskCount(tasks.filter(t => t.status === 'todo').length);

      // 2. Greeting
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('صبح بخیر');
      else if (hour < 18) setGreeting('عصر بخیر');
      else setGreeting('شب بخیر');

      // 3. Generate AI Content
      generateDailyContent();
    };
    initHome();
  }, [user.id]);

  const generateDailyContent = async () => {
    setLoadingDaily(true);
    try {
        const context = await getUserContext();

        // Parallel requests to our API
        const [suggestionRes, factRes] = await Promise.all([
            fetch('/api/home/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...context, type: 'suggestion' })
            }),
            fetch('/api/home/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...context, type: 'fact' })
            })
        ]);

        const suggestionData = await suggestionRes.json();
        const factData = await factRes.json();

        setDailySuggestion(suggestionData.text || 'امروز روز خوبی برای پیشرفت است.');
        setDidYouKnow(factData.text || 'رفسنجان بزرگترین تولیدکننده پسته در جهان است.');

    } catch (e) {
        console.error(e);
        setDailySuggestion('یک روز عالی برای انجام کارهای عقب‌افتاده!');
        setDidYouKnow('خانه حاج آقا علی بزرگترین خانه خشتی جهان در رفسنجان است.');
    } finally {
        setLoadingDaily(false);
    }
  };

  const handleNotificationClick = async () => {
    setShowNotifModal(true);
    setNotifLoading(true);
    try {
        const context = await getUserContext();
        const response = await fetch('/api/home/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...context, type: 'notification' })
        });
        const data = await response.json();
        
        setNotifContent(data.text || 'یادآوری: زمانی را برای استراحت و مرور برنامه‌های خود اختصاص دهید.');
    } catch (e) {
        setNotifContent('ارتباط با هوش مصنوعی برقرار نشد. لطفا اینترنت خود را بررسی کنید.');
    } finally {
        setNotifLoading(false);
    }
  };

  const handleAddSmartTask = async () => {
    if (!smartTaskInput.trim()) return;
    setSmartTaskLoading(true);
    try {
        const now = new Date().toLocaleDateString('fa-IR');
        const response = await fetch('/api/home/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: smartTaskInput, type: 'smart-task' })
        });
        
        if(!response.ok) throw new Error("API Error");

        const taskData = await response.json();

        if (taskData.title) {
            const newTask: Task = {
                id: Date.now().toString(),
                userId: user.id,
                categoryId: taskData.categoryId || 'cat_todo',
                title: taskData.title,
                description: taskData.description || '',
                status: 'todo',
                date: taskData.date || now,
                createdAt: Date.now()
            };
            await storageService.saveTask(user.id, newTask);
            setSmartTaskInput('');
            setTaskCount(prev => prev + 1);
            alert('وظیفه با موفقیت اضافه شد!');
        }
    } catch (e) {
        alert('خطا در افزودن وظیفه. لطفا دستی وارد کنید.');
    } finally {
        setSmartTaskLoading(false);
    }
  };

  const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="h-full bg-slate-50 relative flex flex-col overflow-y-auto no-scrollbar">
      <style>{homeStyles}</style>

      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-teal-600 to-slate-50 rounded-b-[40px] z-0" />
      <div className="absolute top-10 right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute top-20 left-[-20px] w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl" />

      {/* Header Section */}
      <div className="relative z-10 px-6 pt-8 pb-4 anim-slide-up">
        <div className="flex justify-between items-start mb-6">
          {/* Clickable Profile Section */}
          <div 
            onClick={() => onChangeView('profile')}
            className="flex items-center gap-3 cursor-pointer group"
          >
             <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                {user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <UserIcon className="w-6 h-6 text-white" />
                )}
             </div>
             <div className="flex flex-col text-white">
                <span className="text-xs opacity-90 font-light">{greeting}،</span>
                <h1 className="text-lg font-black group-hover:text-teal-100 transition-colors">{user.name}</h1>
             </div>
          </div>
          
          {/* Notification Button */}
          <button 
             onClick={handleNotificationClick}
             className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors relative active:scale-95"
          >
             <Bell className="w-5 h-5" />
             <span className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full border border-teal-600 animate-pulse"></span>
          </button>
        </div>

        {/* Hero Widget */}
        <div className="glass-panel p-5 rounded-3xl shadow-xl mb-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
           {/* Added pointer-events-none to prevent blocking clicks */}
           <div className="absolute inset-0 bg-gradient-to-tr from-teal-50/50 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
           
           <div className="w-16 h-16 bg-gradient-to-tr from-teal-400 to-emerald-400 rounded-full shadow-lg shadow-teal-200 flex items-center justify-center mb-3 animate-[pulse-soft_3s_infinite]">
              <Sparkles className="w-8 h-8 text-white" />
           </div>
           <h2 className="text-slate-800 font-bold text-lg mb-1">دستیار هوشمند شهریار</h2>
           <p className="text-slate-500 text-xs mb-4 max-w-[200px]">آماده پاسخگویی به سوالات شما درباره شهر رفسنجان و برنامه‌های روزانه.</p>
           
           <button 
             onClick={() => onChangeView('chat')}
             className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2 relative z-10"
           >
             شروع گفتگو
             <ArrowLeft className="w-4 h-4" />
           </button>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="flex-1 px-6 pb-24 z-10 space-y-4">
        
        {/* Date & Daily Suggestion Strip */}
        <div className="flex gap-3 anim-slide-up delay-1">
           <div className="w-1/3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-400">امروز</span>
              <span className="text-sm font-bold text-slate-700 leading-tight">{today}</span>
           </div>
           
           {/* AI Daily Suggestion (Replaced Weather) */}
           <div className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-md text-white flex items-center gap-3 relative overflow-hidden">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm shrink-0">
                  {loadingDaily ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              </div>
              <p className="text-[10px] font-medium leading-relaxed opacity-95">
                 {loadingDaily ? 'در حال تحلیل روز شما...' : dailySuggestion}
              </p>
           </div>
        </div>

        <h3 className="text-slate-700 font-bold text-sm mt-4 mb-2 pr-1 border-r-4 border-teal-500 anim-slide-up delay-2">دسترسی سریع</h3>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4 anim-slide-up delay-2">
           
           <button 
             onClick={() => onChangeView('chat')}
             className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all group text-right"
           >
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                 <MessageSquare className="w-5 h-5" />
              </div>
              <span className="block font-bold text-slate-700 text-sm">چت‌بات متنی</span>
              <span className="text-[10px] text-slate-400">سوال بپرسید</span>
           </button>

           <button 
             onClick={() => onChangeView('planning')}
             className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-right"
           >
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform relative">
                 <Calendar className="w-5 h-5" />
                 {taskCount > 0 && (
                   <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center border border-white">
                     {taskCount}
                   </span>
                 )}
              </div>
              <span className="block font-bold text-slate-700 text-sm">برنامه‌ریزی</span>
              <span className="text-[10px] text-slate-400">مدیریت وظایف</span>
           </button>

           <button 
             onClick={() => onChangeView('voice')}
             className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all group text-right"
           >
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                 <Mic className="w-5 h-5" />
              </div>
              <span className="block font-bold text-slate-700 text-sm">مکالمه صوتی</span>
              <span className="text-[10px] text-slate-400">صحبت زنده</span>
           </button>

           <button 
             onClick={() => onChangeView('profile')}
             className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group text-right"
           >
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                 <UserIcon className="w-5 h-5" />
              </div>
              <span className="block font-bold text-slate-700 text-sm">پروفایل</span>
              <span className="text-[10px] text-slate-400">تنظیمات کاربر</span>
           </button>

        </div>

        {/* Smart Task Add Section */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 anim-slide-up delay-3 mt-4">
            <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-500" />
                افزودن سریع وظیفه با هوش مصنوعی
            </h4>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={smartTaskInput}
                    onChange={(e) => setSmartTaskInput(e.target.value)}
                    placeholder="مثلا: فردا ساعت ۵ جلسه دارم..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 transition-colors"
                />
                <button 
                    onClick={handleAddSmartTask}
                    disabled={smartTaskLoading || !smartTaskInput.trim()}
                    className="bg-teal-600 text-white p-2 rounded-xl shadow-lg hover:bg-teal-500 transition-all active:scale-95 disabled:opacity-50"
                >
                    {smartTaskLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
            </div>
        </div>

        {/* Dynamic Tip of the day */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-5 rounded-3xl shadow-lg text-white mt-4 anim-slide-up delay-3 relative overflow-hidden">
           <Zap className="w-40 h-40 text-white/5 absolute -left-10 -bottom-10 rotate-12" />
           <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-xs font-bold text-yellow-400">آیا می‌دانستید؟</span>
           </div>
           <p className="text-sm font-light leading-relaxed opacity-90 relative z-10 min-h-[40px]">
             {loadingDaily ? 'در حال جستجوی دانستنی‌ها...' : didYouKnow}
           </p>
        </div>

      </div>

      {/* Notification Modal */}
      {showNotifModal && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
              <button 
                onClick={() => setShowNotifModal(false)}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                  <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                      {notifLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Bell className="w-7 h-7" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">پیام هوشمند شهریار</h3>
                  {notifLoading ? (
                      <p className="text-sm text-slate-400">در حال تحلیل وضعیت شما...</p>
                  ) : (
                      <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {notifContent}
                      </p>
                  )}
                  
                  {!notifLoading && (
                      <button 
                        onClick={() => setShowNotifModal(false)}
                        className="mt-6 w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm"
                      >
                          متوجه شدم
                      </button>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};