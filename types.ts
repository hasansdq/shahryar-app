

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  bio?: string;
  avatar?: string; // Base64 Data URL
  joinedDate: string;
  learnedData: string[]; // General facts learned
  traits: string[]; // Ethical/Behavioral traits derived from chat
  customInstructions?: string; // User defined system instructions
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64
  name: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
  attachment?: Attachment;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskCategory {
  id: string;
  title: string;
  color: string; // Hex code or Tailwind class
}

export interface Task {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  date: string; // Jalali Date String
  createdAt: number;
}

export type ViewState = 
  | 'loading' 
  | 'auth' 
  | 'dashboard' 
  | 'voice' 
  | 'profile' 
  | 'chat' 
  | 'planning' 
  | 'home';

export interface AudioConfig {
  sampleRate: number;
}