
import React, { useState, useEffect, useRef } from 'react';
import { User, Task, TaskCategory } from '../types';
import { storageService } from '../services/storageService';
import { GoogleGenAI } from '@google/genai';
import { 
  Plus, MoreHorizontal, Calendar as CalendarIcon, Trash2, 
  CheckCircle2, Circle, Clock, Sparkles, X, Edit3, GripVertical, Loader2, List
} from 'lucide-react';

interface PlanningProps {
  user: User;
}

export const Planning: React.FC<PlanningProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Drag & Drop State
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  // Manual Add/Edit State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formCat, setFormCat] = useState('');

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    setLoading(true);
    const [cats, tsks] = await Promise.all([
      storageService.getCategories(user.id),
      storageService.getTasks(user.id)
    ]);
    setCategories(cats);
    setTasks(tsks);
    setLoading(false);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, categoryId: targetCategoryId };
      }
      return t;
    });

    setTasks(updatedTasks);
    setDraggedTask(null);

    // Save to storage
    const task = updatedTasks.find(t => t.id === taskId);
    if (task) await storageService.saveTask(user.id, task);
  };

  // --- CRUD Handlers ---
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('آیا از حذف این وظیفه مطمئن هستید؟')) {
      await storageService.deleteTask(user.id, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const openAddModal = (categoryPreselect?: string) => {
    setEditingTask(null);
    setFormTitle('');
    setFormDesc('');
    setFormDate(new Date().toLocaleDateString('fa-IR'));
    setFormCat(categoryPreselect || categories[0]?.id || '');
    setAiMode(false);
    setShowAddModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || '');
    setFormDate(task.date);
    setFormCat(task.categoryId);
    setAiMode(false);
    setShowAddModal(true);
  };

  const handleSaveTask = async () => {
    if (!formTitle.trim()) return;

    const newTask: Task = {
      id: editingTask ? editingTask.id : Date.now().toString(),
      userId: user.id,
      categoryId: formCat,
      title: formTitle,
      description: formDesc,
      status: 'todo', // Simplified status, mostly relying on category
      date: formDate,
      createdAt: editingTask ? editingTask.createdAt : Date.now()
    };

    await storageService.saveTask(user.id, newTask);
    
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === newTask.id ? newTask : t));
    } else {
      setTasks(prev => [...prev, newTask]);
    }
    setShowAddModal(false);
  };

  // --- AI Generation Handler ---
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);

    try {
      const apiKey = process.env.API_KEY || process.env.REACT_APP_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      const now = new Date().toLocaleDateString('fa-IR');
      
      const prompt = `
        You are a smart task planning assistant.
        Current Date (Jalali): ${now}
        Available Categories: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.title })))}
        
        User Request: "${aiPrompt}"

        Task: Convert the user's request into a JSON array of tasks.
        Rules:
        1. 'date' must be a valid Jalali date string (e.g., 1403/02/15). Calculate based on "tomorrow", "next week", etc. relative to ${now}.
        2. 'categoryId' must match one of the available category IDs. If unsure, use the first one.
        3. Output MUST be a valid JSON array. No markdown.
        
        Format:
        [
          { "title": "...", "description": "...", "date": "...", "categoryId": "..." }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const generatedTasks = JSON.parse(response.text || '[]');
      
      if (Array.isArray(generatedTasks)) {
        const newTasks: Task[] = [];
        for (const t of generatedTasks) {
           const nt: Task = {
             id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
             userId: user.id,
             categoryId: t.categoryId || categories[0].id,
             title: t.title,
             description: t.description,
             status: 'todo',
             date: t.date || now,
             createdAt: Date.now()
           };
           newTasks.push(nt);
           await storageService.saveTask(user.id, nt);
        }
        setTasks(prev => [...prev, ...newTasks]);
        setShowAddModal(false);
        setAiPrompt('');
      }

    } catch (e) {
      console.error(e);
      alert('خطا در تولید هوشمند وظایف');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
        <div>
           <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
             برنامه‌ریزی
             <span className="text-xs bg-teal-50 text-teal-600 px-2 py-1 rounded-lg border border-teal-100 font-medium">هوشمند</span>
           </h2>
           <p className="text-xs text-slate-400 mt-1">مدیریت وظایف روزانه با قدرت هوش مصنوعی</p>
        </div>
        <button 
          onClick={() => { openAddModal(); setAiMode(true); }}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-2.5 rounded-xl shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      {/* Vertical List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {loading ? (
           <div className="w-full h-full flex items-center justify-center text-slate-400 gap-2">
             <Loader2 className="w-6 h-6 animate-spin" />
             در حال بارگذاری...
           </div>
        ) : (
          categories.map(category => (
            <div 
              key={category.id}
              className="w-full flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 transition-all"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category.id)}
            >
               {/* Category Header */}
               <div className="p-3 flex items-center justify-between border-b border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: category.color }} />
                    <span className="font-bold text-slate-700 text-sm">{category.title}</span>
                    <span className="text-xs bg-white px-2 py-0.5 rounded-md text-slate-400 font-mono border border-slate-100">
                      {tasks.filter(t => t.categoryId === category.id).length}
                    </span>
                  </div>
                  <button 
                    onClick={() => openAddModal(category.id)}
                    className="text-slate-400 hover:text-teal-600 p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
               </div>

               {/* Tasks List */}
               <div className="p-3 space-y-3 min-h-[80px]">
                  {tasks.filter(t => t.categoryId === category.id).map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                       <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-800 text-sm leading-snug">{task.title}</h4>
                          <button onClick={() => openEditModal(task)} className="text-slate-300 hover:text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                             <Edit3 className="w-3.5 h-3.5" />
                          </button>
                       </div>
                       
                       {task.description && (
                         <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{task.description}</p>
                       )}

                       <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                             <CalendarIcon className="w-3 h-3 text-slate-400" />
                             <span className="pt-0.5">{task.date}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    </div>
                  ))}
                  
                  {tasks.filter(t => t.categoryId === category.id).length === 0 && (
                     <div className="flex flex-col items-center justify-center h-20 text-slate-300 text-xs border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <GripVertical className="w-5 h-5 mb-1 opacity-50" />
                        رها کنید یا وظیفه جدید بسازید
                     </div>
                  )}
               </div>
            </div>
          ))
        )}
        <div className="h-20" /> {/* Spacer for bottom nav */}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  {aiMode ? <Sparkles className="w-5 h-5 text-teal-500" /> : <Edit3 className="w-5 h-5 text-teal-500" />}
                  {aiMode ? 'ایجاد هوشمند' : (editingTask ? 'ویرایش وظیفه' : 'وظیفه جدید')}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full bg-slate-100 hover:bg-slate-200">
                   <X className="w-5 h-5 text-slate-500" />
                </button>
             </div>

             {/* Mode Switcher */}
             <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
                <button 
                  onClick={() => setAiMode(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!aiMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                >
                  دستی
                </button>
                <button 
                   onClick={() => setAiMode(true)}
                   className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${aiMode ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400'}`}
                >
                  <Sparkles className="w-3 h-3" />
                  هوش مصنوعی
                </button>
             </div>

             {aiMode ? (
               <div className="space-y-4">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="مثلا: فردا ساعت ۵ عصر یک جلسه با تیم فنی دارم. برای هفته بعد هم خرید بلیط سفر رو یادآوری کن."
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-teal-500 resize-none leading-relaxed"
                  />
                  <button 
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2"
                  >
                    {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {aiLoading ? 'در حال تحلیل...' : 'تولید وظایف'}
                  </button>
               </div>
             ) : (
               <div className="space-y-3">
                  <input 
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="عنوان وظیفه"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-500"
                  />
                  <textarea 
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="توضیحات (اختیاری)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-teal-500 resize-none h-20"
                  />
                  <div className="flex gap-2">
                     <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block mr-1">تاریخ (شمسی)</label>
                        <input 
                          type="text"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 text-center dir-ltr"
                        />
                     </div>
                     <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block mr-1">دسته‌بندی</label>
                        <select 
                          value={formCat}
                          onChange={(e) => setFormCat(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                     </div>
                  </div>
                  <button 
                    onClick={handleSaveTask}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm mt-2 hover:bg-slate-700 transition-colors"
                  >
                    {editingTask ? 'ذخیره تغییرات' : 'افزودن وظیفه'}
                  </button>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
