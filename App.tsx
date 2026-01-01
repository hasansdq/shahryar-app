import React, { useState, useEffect } from 'react';
import { Auth } from './views/Auth';
import { Chat } from './views/Chat';
import { Profile } from './views/Profile';
import { Planning } from './views/Planning';
import { VoiceMode } from './views/VoiceMode';
import { Home as HomeView } from './views/Home';
import { User, ViewState } from './types';
import { storageService } from './services/storageService';
import { MessageSquare, User as UserIcon, Mic, Home, Calendar, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('loading');

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing session
        const storedUser = await storageService.getUser();
        if (storedUser) {
          setUser(storedUser);
          setView('home'); // Redirect to home if logged in
        } else {
          setView('auth'); // Redirect to auth if not logged in
        }
      } catch (error) {
        console.error("Auth Initialization Error:", error);
        setView('auth'); // Fallback to auth on error
      }
    };
    initAuth();
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    setView('home'); // Redirect to home after login/register
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await storageService.saveUser(updatedUser);
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setView('auth'); // Redirect to auth after logout
  };

  if (view === 'loading') {
    return (
      <div 
        className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white" 
        style={{ fontFamily: "'Vazirmatn', sans-serif" }}
      >
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-teal-500 rounded-full animate-ping absolute opacity-20"></div>
          <div className="w-16 h-16 bg-gradient-to-tr from-teal-400 to-emerald-400 rounded-full shadow-lg shadow-teal-500/40 flex items-center justify-center relative z-10">
             <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">شهریار</h1>
        <p className="text-teal-200/60 text-sm">هوش مصنوعی رفسنجان</p>
      </div>
    );
  }

  if (view === 'auth') {
    return <Auth onLogin={handleLogin} />;
  }

  // Early return for Voice Mode to avoid type overlap issues in main render
  // Using explicit cast to ensure TypeScript recognizes 'voice' as valid ViewState
  if ((view as ViewState) === 'voice') {
      if (user) {
        return (
            <div style={{ fontFamily: "'Vazirmatn', sans-serif" }}>
                 <VoiceMode user={user} onClose={() => setView('home')} />
            </div>
        );
      } else {
        return <Auth onLogin={handleLogin} />;
      }
  }

  return (
    <div 
      className="fixed inset-0 w-full h-[100dvh] sm:static sm:h-screen sm:max-w-md sm:mx-auto bg-white shadow-2xl overflow-hidden relative"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      {/* Main Content Area */}
      <div className="absolute top-0 left-0 right-0 bottom-[70px] overflow-hidden z-0 flex flex-col">
        {/* Chat is kept mounted (display: none) to persist background generation */}
        {user && (
            <div className={`w-full h-full flex flex-col ${view === 'chat' ? 'flex' : 'hidden'}`}>
                <Chat user={user} />
            </div>
        )}
        
        {view === 'profile' && user && (
          <Profile 
            user={user} 
            onLogout={handleLogout} 
            onUpdateUser={handleUpdateUser}
          />
        )}

        {view === 'planning' && user && (
          <Planning user={user} />
        )}

        {view === 'home' && user && (
          <HomeView user={user} onChangeView={setView} />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 flex justify-between items-center pb-safe z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] h-[70px]">
          
          <button 
            onClick={() => setView('profile')}
            className={`flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'profile' ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold truncate w-full text-center">پروفایل</span>
          </button>

          <button 
            onClick={() => setView('voice')}
            className={`flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'voice' ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Mic className="w-6 h-6" />
            <span className="text-[10px] font-bold truncate w-full text-center">صوتی</span>
          </button>

          {/* Fixed Home Button: Perfectly Circular */}
          <button 
            onClick={() => setView('home')}
            className={`shrink-0 flex items-center justify-center rounded-full transition-all duration-300 -mt-8 shadow-lg border-4 border-slate-50 w-16 h-16 mx-2 ${
              view === 'home' 
                ? 'bg-gradient-to-tr from-teal-500 to-emerald-500 text-white scale-110 shadow-teal-500/30' 
                : 'bg-white text-slate-400 hover:text-teal-500'
            }`}
          >
            <Home className="w-7 h-7" />
          </button>

          <button 
            onClick={() => setView('chat')}
            className={`flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'chat' ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-bold truncate w-full text-center">گفتگو</span>
          </button>

          <button 
            onClick={() => setView('planning')}
            className={`flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${view === 'planning' ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-bold truncate w-full text-center">برنامه</span>
          </button>

        </div>
    </div>
  );
};

export default App;