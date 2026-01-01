import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { 
  User as UserIcon, Calendar, Database, LogOut, Award, 
  Camera, Edit2, Save, X, Mail, FileText, BrainCircuit, Sliders, Loader2, Sparkles
} from 'lucide-react';

interface ProfileProps {
  user: User;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onLogout, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form States
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [customInstructions, setCustomInstructions] = useState(user.customInstructions || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze User Traits on Mount
  useEffect(() => {
    const analyzeUserTraits = async () => {
      // 1. Gather User Context from History
      const sessions = await storageService.getSessions(user.id);
      const userMessages = sessions
        .flatMap(s => s.messages)
        .filter(m => m.role === 'user')
        .slice(-50) // Analyze last 50 messages to save tokens/time
        .map(m => m.text)
        .join('\n');

      // Only analyze if there's enough data and we haven't just analyzed (simple check)
      if (!userMessages || userMessages.length < 20) return;

      setIsAnalyzing(true);
      try {
        const apiKey = process.env.API_KEY;
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
          Analyze the following messages sent by a user to an AI city assistant (Shahryar).
          Identify 4 to 6 specific personality traits, interests, or communication styles of this user.
          
          User Messages:
          "${userMessages.slice(0, 5000)}"

          Output Rules:
          1. Return ONLY a JSON array of strings.
          2. The strings must be in Persian (Farsi).
          3. Be concise (1-3 words per trait).
          4. Example: ["کنجکاو", "علاقمند به پسته", "لحن رسمی"]
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const newTraits = JSON.parse(response.text || "[]");

        if (Array.isArray(newTraits) && newTraits.length > 0) {
           // Compare strictly to avoid unnecessary updates/renders
           const currentTraitsJSON = JSON.stringify(user.traits);
           const newTraitsJSON = JSON.stringify(newTraits);
           
           if (currentTraitsJSON !== newTraitsJSON) {
             const updatedUser = { ...user, traits: newTraits };
             onUpdateUser(updatedUser); // Save to parent/storage
           }
        }
      } catch (error) {
        console.error("Failed to analyze traits:", error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeUserTraits();
  }, []); // Run once on mount

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateUser({ ...user, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updatedUser: User = {
      ...user,
      name,
      email,
      bio,
      customInstructions
    };
    await onUpdateUser(updatedUser);
    setSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(user.name);
    setEmail(user.email || '');
    setBio(user.bio || '');
    setCustomInstructions(user.customInstructions || '');
    setIsEditing(false);
  };

  return (
    <div className="h-full bg-slate-50 relative flex flex-col">
      {/* Top Banner & Header */}
      <div className="relative bg-teal-600 h-32 flex-shrink-0 z-0">
        <div className="absolute top-4 right-4 z-50">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl backdrop-blur-sm transition-colors cursor-pointer"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-green-500 hover:bg-green-400 text-white p-2 rounded-xl shadow-lg transition-colors cursor-pointer flex items-center justify-center"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              </button>
              <button 
                onClick={handleCancel}
                disabled={saving}
                className="bg-red-500 hover:bg-red-400 text-white p-2 rounded-xl shadow-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 flex-1 overflow-y-auto pb-6 no-scrollbar -mt-12 relative z-10">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-6 flex flex-col items-center">
          
          {/* Avatar Area */}
          <div className="relative mb-4 group">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-100 flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-slate-400" />
              )}
            </div>
            
            {/* Upload Button Overlay */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-teal-500 text-white p-2 rounded-full shadow-lg hover:bg-teal-400 transition-transform active:scale-95 border-2 border-white"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>

          {/* Name & Bio */}
          {isEditing ? (
            <div className="w-full space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-center text-xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-none focus:border-teal-400"
                placeholder="نام شما"
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-none focus:border-teal-400 resize-none"
                placeholder="بیوگرافی خود را بنویسید..."
                rows={2}
              />
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
              <p className="text-slate-500 text-sm mt-1">{user.bio || 'کاربر شهریار'}</p>
            </div>
          )}
        </div>

        {/* Info Fields */}
        <div className="space-y-4">
          
          {/* Personal Info */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-teal-600 font-bold mb-4 flex items-center gap-2 border-b border-slate-50 pb-2 text-sm">
              <Award className="w-5 h-5" />
              اطلاعات شخصی
            </h3>
            
            <div className="space-y-4">
              {/* Phone (Read Only) */}
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-slate-400">شماره موبایل (غیرقابل تغییر)</label>
                 <div className="bg-slate-50 text-slate-600 px-3 py-2.5 rounded-xl text-sm font-mono flex justify-between items-center opacity-70">
                    <span>{user.phone}</span>
                    <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-500">تایید شده</span>
                 </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                 <label className="text-xs text-slate-400">ایمیل</label>
                 {isEditing ? (
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-teal-400 text-left transition-colors"
                      placeholder="example@mail.com"
                      dir="ltr"
                    />
                 ) : (
                    <div className="flex items-center gap-2 text-slate-700 text-sm px-1">
                       <Mail className="w-4 h-4 text-slate-400" />
                       <span>{user.email || 'ثبت نشده'}</span>
                    </div>
                 )}
              </div>

              {/* Joined Date */}
              <div className="flex items-center gap-2 text-slate-700 text-sm px-1 pt-2 border-t border-slate-50">
                 <Calendar className="w-4 h-4 text-slate-400" />
                 <span className="text-xs text-slate-500">عضویت: {user.joinedDate}</span>
              </div>
            </div>
          </div>

          {/* AI Ethical Traits (Learned Memory) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
             <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-4">
                <h3 className="text-purple-600 font-bold flex items-center gap-2 text-sm">
                  <BrainCircuit className="w-5 h-5" />
                  شناخت هوش مصنوعی از شما
                </h3>
                {isAnalyzing && (
                  <div className="flex items-center gap-1 text-[10px] text-purple-400 animate-pulse">
                     <Sparkles className="w-3 h-3" />
                     در حال تحلیل...
                  </div>
                )}
             </div>
             
             <p className="text-xs text-slate-400 mb-3 leading-relaxed">
               این ویژگی‌ها بر اساس تعاملات شما استخراج شده‌اند تا پاسخ‌های بهتری دریافت کنید.
             </p>
             
             <div className="flex flex-wrap gap-2">
               {user.traits && user.traits.length > 0 ? (
                 user.traits.map((trait, idx) => (
                   <span key={idx} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-100 flex items-center gap-1 animate-in fade-in zoom-in duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                     <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                     {trait}
                   </span>
                 ))
               ) : (
                 <span className="text-xs text-slate-400 italic flex items-center gap-1">
                   {isAnalyzing ? (
                     <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        در حال بررسی سوابق...
                     </>
                   ) : (
                      'هنوز ویژگی خاصی شناسایی نشده است.'
                   )}
                 </span>
               )}
             </div>
          </div>

          {/* Custom System Instructions */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-indigo-600 font-bold mb-4 flex items-center gap-2 border-b border-slate-50 pb-2 text-sm">
               <Sliders className="w-5 h-5" />
               دستورالعمل سفارشی
             </h3>
             <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                به هوش مصنوعی بگویید چگونه با شما رفتار کند (مثلا: همیشه کوتاه پاسخ بده، یا با زبان طنز صحبت کن).
             </p>
             
             {isEditing ? (
                <textarea 
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 min-h-[100px]"
                  placeholder="مثلا: لطفا همیشه رسمی صحبت کن و از اصطلاحات تخصصی کامپیوتر استفاده نکن."
                />
             ) : (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[60px]">
                   {user.customInstructions ? (
                     <p className="text-sm text-slate-700">{user.customInstructions}</p>
                   ) : (
                     <p className="text-xs text-slate-400 italic">هیچ دستورالعمل خاصی تنظیم نشده است.</p>
                   )}
                </div>
             )}
          </div>

          {/* Logout */}
          <button 
            onClick={onLogout}
            className="w-full bg-red-50 text-red-600 border border-red-100 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            خروج از حساب کاربری
          </button>

          <p className="text-center text-[10px] text-slate-300 pb-2">
            نسخه ۱.۰.۰ - شناسه کاربر: {user.id.slice(-6)}
          </p>
        </div>
      </div>
    </div>
  );
};