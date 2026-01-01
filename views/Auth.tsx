
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { 
  User as UserIcon, Lock, Smartphone, ArrowLeft, 
  Sparkles, ShieldCheck, Eye, EyeOff, Bot, Loader2
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

// --- Custom CSS for Advanced Animations ---
const authStyles = `
  @keyframes float {
    0% { transform: translate(0px, 0px) rotate(0deg); }
    33% { transform: translate(30px, -50px) rotate(10deg); }
    66% { transform: translate(-20px, 20px) rotate(-5deg); }
    100% { transform: translate(0px, 0px) rotate(0deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(45, 212, 191, 0.2); }
    50% { box-shadow: 0 0 40px rgba(45, 212, 191, 0.5); }
  }
  @keyframes slideUpFade {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-float { animation: float 15s ease-in-out infinite; }
  .animate-float-delayed { animation: float 20s ease-in-out infinite reverse; }
  .glass-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
  }
  .input-focus-effect:focus-within {
    border-color: #5eead4;
    box-shadow: 0 0 0 4px rgba(94, 234, 212, 0.1);
    background: rgba(0, 0, 0, 0.25);
  }
  .anim-entry { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .anim-delay-1 { animation-delay: 0.1s; }
  .anim-delay-2 { animation-delay: 0.2s; }
  .anim-delay-3 { animation-delay: 0.3s; }
`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Timer reference to force-kill loading if it hangs
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear inputs on mode switch
  useEffect(() => {
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [isLogin]);

  useEffect(() => {
    return () => {
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
    };
  }, []);

  // --- THE MASTER HANDLER FUNCTION ---
  // This function guarantees that the system either logs in OR shows an error.
  // It never leaves the user in a 'loading' state indefinitely.
  const executeAuthSession = async () => {
    setLoading(true);
    setError(null);

    // 1. Set a safety timer. If backend is totally dead, kill loading after 15s.
    if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
    failsafeTimerRef.current = setTimeout(() => {
        setLoading(false);
        setError("پاسخی از سرور دریافت نشد. (تایم‌اوت)");
    }, 15000);

    try {
        let user: User;
        console.log("Starting Auth Session...", isLogin ? "Login" : "Register");

        // 2. Artificial delay for smooth UX (prevents flashing)
        const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));

        // 3. Execute Service Call
        let authPromise: Promise<User>;
        if (isLogin) {
            authPromise = storageService.login(phone, password);
        } else {
            authPromise = storageService.register(phone, password, name);
        }

        const [userData] = await Promise.all([authPromise, minLoadTime]);
        user = userData;

        // 4. Success!
        console.log("Auth Successful:", user.id);
        if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
        onLogin(user); // Triggers App.tsx to switch view

    } catch (err: any) {
        // 5. Failure Handling
        console.error("Auth Failed:", err);
        if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
        
        // Translate error messages for user friendliness
        let msg = err.message || "خطای ناشناخته";
        if (msg.includes('404')) {
             msg = "لطفا ابتدا ثبت نام کنید.";
        } else if (msg.includes('401')) {
             msg = "رمز عبور اشتباه است.";
        } else if (msg.includes('409')) {
             msg = "این شماره قبلا ثبت شده است.";
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
             msg = "عدم ارتباط با سرور. اتصال اینترنت را بررسی کنید.";
        }

        setError(msg);
    } finally {
        // 6. GUARANTEED EXIT: Stop loading no matter what happens
        setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    // Validations
    if (phone.length < 10) {
      setError('شماره تلفن وارد شده صحیح نیست.');
      return;
    }
    if (!password) {
        setError('رمز عبور الزامی است.');
        return;
    }

    if (!isLogin) {
      if (!name.trim()) {
        setError('لطفا نام خود را وارد کنید.');
        return;
      }
      if (password !== confirmPassword) {
        setError('رمز عبور و تکرار آن مطابقت ندارند.');
        return;
      }
      if (password.length < 4) {
        setError('رمز عبور باید حداقل ۴ کاراکتر باشد.');
        return;
      }
    }

    // Run the robust handler
    executeAuthSession();
  };

  return (
    <div 
      className="relative flex flex-col h-full w-full overflow-hidden bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white justify-center items-center"
      style={{ fontFamily: "'Vazirmatn', sans-serif" }}
    >
      <style>{authStyles}</style>

      {/* --- Animated Background Elements --- */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/20 rounded-full blur-[100px] animate-float pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-float-delayed pointer-events-none" />
      <div className="absolute top-[40%] left-[20%] w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] animate-pulse pointer-events-none" />

      <div className="w-full max-w-[360px] z-10 px-4">
        
        {/* --- Header / Logo --- */}
        <div className="mb-8 text-center anim-entry">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-teal-400 to-emerald-400 rounded-3xl shadow-[0_0_40px_-10px_rgba(45,212,191,0.5)] mb-4 rotate-6 transform hover:rotate-12 transition-transform duration-500">
             <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight drop-shadow-lg flex items-center justify-center gap-2">
            شهریار
            <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
          </h1>
          <p className="text-teal-100 text-sm font-light opacity-90">دستیار هوشمند و بومی شهر رفسنجان</p>
        </div>

        {/* --- Main Glass Card --- */}
        <div className="glass-card p-1 rounded-[32px] anim-entry anim-delay-1">
          
          {/* Toggle Switch */}
          <div className="relative flex bg-black/30 p-1 rounded-[28px] mb-6 mx-4 mt-4">
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-teal-500 rounded-[24px] shadow-lg transition-all duration-300 ease-out ${isLogin ? 'right-1' : 'right-[50%]'}`} 
            />
            <button 
              type="button"
              className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors duration-300 ${isLogin ? 'text-white' : 'text-slate-300 hover:text-white'}`}
              onClick={() => setIsLogin(true)}
            >
              ورود
            </button>
            <button 
              type="button"
              className={`flex-1 relative z-10 py-3 text-sm font-bold transition-colors duration-300 ${!isLogin ? 'text-white' : 'text-slate-300 hover:text-white'}`}
              onClick={() => setIsLogin(false)}
            >
              ثبت نام
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 pb-6 space-y-4">
            
            {/* Name Field (Signup Only) */}
            {!isLogin && (
              <div className="relative group anim-entry">
                <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="نام و نام خانوادگی"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm"
                  style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            
            {/* Phone Field */}
            <div className="relative group anim-entry anim-delay-1">
              <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                <Smartphone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                placeholder="شماره تلفن همراه"
                className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm text-left dir-ltr"
                style={{ direction: 'ltr', textAlign: 'right', fontFamily: "'Vazirmatn', sans-serif" }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative group anim-entry anim-delay-2">
              <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="رمز عبور"
                className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-10 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm"
                style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3.5 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirm Password Field (Signup Only) */}
            {!isLogin && (
              <div className="relative group anim-entry">
                <div className="absolute right-3 top-3.5 text-teal-300/70 group-focus-within:text-teal-300 transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="تکرار رمز عبور"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pr-11 pl-4 text-white placeholder-slate-400 focus:outline-none input-focus-effect transition-all duration-300 text-sm"
                  style={{ fontFamily: "'Vazirmatn', sans-serif" }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center animate-pulse">
                <p className="text-red-200 text-xs font-bold">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(20,184,166,0.4)] mt-4 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] anim-entry anim-delay-3"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                    <span className="text-lg">{isLogin ? 'ورود به حساب' : 'ایجاد حساب کاربری'}</span>
                    <div className="bg-white/20 p-1 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </div>
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="text-center mt-8 anim-entry anim-delay-3">
           <p className="text-teal-200/40 text-[10px] tracking-wider">
             طراحی شده با عشق برای مردم رفسنجان ❤️
           </p>
        </div>
      </div>
    </div>
  );
};
