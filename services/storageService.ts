
import { User, ChatSession, Task, TaskCategory } from '../types';

const USER_KEY = 'shahryar_user'; // Currently logged-in user session
const USERS_DB_KEY = 'shahryar_users_db'; // "Database" of all registered users
const SESSIONS_KEY_PREFIX = 'shahryar_sessions_'; // Prefix for user-specific sessions
const TASKS_KEY_PREFIX = 'shahryar_tasks_';
const CATEGORIES_KEY_PREFIX = 'shahryar_categories_';

// Helper to simulate network delay for better UX
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get all registered users
const getDbUsers = (): User[] => {
    try {
        return JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
    } catch { return []; }
};

// Helper to save users
const saveDbUsers = (users: User[]) => {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
};

export const storageService = {
  
  login: async (phone: string, password: string): Promise<User> => {
    await delay(800); // Fake loading

    const users = getDbUsers();
    
    // 1. Check if user exists
    const user = users.find(u => u.phone === phone);
    if (!user) {
        throw new Error("404: حساب کاربری یافت نشد.");
    }

    // 2. Check password
    if ((user as any).password !== password) {
        throw new Error("401: رمز عبور اشتباه است.");
    }

    // 3. Login successful
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  register: async (phone: string, password: string, name: string): Promise<User> => {
    await delay(1000); // Fake loading

    const users = getDbUsers();
    if (users.find(u => u.phone === phone)) {
        throw new Error("409: این شماره تلفن قبلا ثبت شده است.");
    }

    const newUser: User = {
        id: 'user_' + Date.now(),
        phone,
        name,
        joinedDate: new Date().toLocaleDateString('fa-IR'),
        learnedData: [],
        traits: [],
        customInstructions: ''
    };

    // Store password alongside user data (Internal logic only)
    const userWithPass = { ...newUser, password };
    
    users.push(userWithPass);
    saveDbUsers(users);

    // Auto login
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    return newUser;
  },

  getUser: async (): Promise<User | null> => {
      try {
          const local = localStorage.getItem(USER_KEY);
          return local ? JSON.parse(local) : null;
      } catch (e) {
          console.error("Error parsing user from storage", e);
          localStorage.removeItem(USER_KEY); // Clear corrupted data
          return null;
      }
  },

  saveUser: async (user: User) => {
      // Update current session
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      // Update in "Database"
      const users = getDbUsers();
      const index = users.findIndex(u => u.id === user.id);
      if (index !== -1) {
          // Preserve password when updating
          const password = (users[index] as any).password;
          users[index] = { ...user, password } as any;
          saveDbUsers(users);
      }
  },

  logout: () => {
      localStorage.removeItem(USER_KEY);
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
      try {
          const key = SESSIONS_KEY_PREFIX + userId;
          return JSON.parse(localStorage.getItem(key) || '[]');
      } catch (e) { return []; }
  },

  createSession: async (userId: string): Promise<ChatSession> => {
      const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'گفتگوی جدید',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
      };
      await storageService.saveSession(newSession, userId);
      return newSession;
  },

  saveSession: async (session: ChatSession, userId: string) => {
      const key = SESSIONS_KEY_PREFIX + userId;
      const sessions: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]');
      
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx !== -1) sessions[idx] = session;
      else sessions.push(session);
      
      localStorage.setItem(key, JSON.stringify(sessions));
  },

  deleteSession: async (id: string) => {
      const currentUser = await storageService.getUser();
      if (!currentUser) return;

      const key = SESSIONS_KEY_PREFIX + currentUser.id;
      const sessions: ChatSession[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = sessions.filter((s) => s.id !== id);
      localStorage.setItem(key, JSON.stringify(filtered));
  },

  // --- Task Management ---

  getCategories: async (userId: string): Promise<TaskCategory[]> => {
      const key = CATEGORIES_KEY_PREFIX + userId;
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
      
      // Default Categories
      const defaults: TaskCategory[] = [
          { id: 'cat_todo', title: 'برای انجام', color: '#3b82f6' }, // Blue
          { id: 'cat_doing', title: 'در حال انجام', color: '#eab308' }, // Yellow
          { id: 'cat_done', title: 'انجام شده', color: '#22c55e' }  // Green
      ];
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
  },

  saveCategories: async (userId: string, categories: TaskCategory[]) => {
      localStorage.setItem(CATEGORIES_KEY_PREFIX + userId, JSON.stringify(categories));
  },

  getTasks: async (userId: string): Promise<Task[]> => {
      const key = TASKS_KEY_PREFIX + userId;
      return JSON.parse(localStorage.getItem(key) || '[]');
  },

  saveTask: async (userId: string, task: Task) => {
      const tasks = await storageService.getTasks(userId);
      const index = tasks.findIndex(t => t.id === task.id);
      if (index !== -1) {
          tasks[index] = task;
      } else {
          tasks.push(task);
      }
      localStorage.setItem(TASKS_KEY_PREFIX + userId, JSON.stringify(tasks));
  },

  deleteTask: async (userId: string, taskId: string) => {
      const tasks = await storageService.getTasks(userId);
      const filtered = tasks.filter(t => t.id !== taskId);
      localStorage.setItem(TASKS_KEY_PREFIX + userId, JSON.stringify(filtered));
  }
};
