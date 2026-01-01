import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const AI_TIMEOUT_MS = 30000; // 30 Seconds Timeout

// --- Database Configuration ---
const DB_DIR = __dirname; 
const DB_FILE = path.join(DB_DIR, 'database.json');

// Ensure DB exists immediately
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sessions: [] }, null, 2));
}

// --- Middleware ---
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));

// Logging Middleware
app.use((req, res, next) => {
    if (!req.url.startsWith('/static') && !req.url.includes('.')) {
        console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
});

// --- Helper Functions ---
const getDb = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return { users: [], sessions: [] };
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (!parsed.users) parsed.users = [];
        if (!parsed.sessions) parsed.sessions = [];
        return parsed;
    } catch (e) {
        console.error("DB Read Error - Resetting structure:", e);
        return { users: [], sessions: [] };
    }
};

const saveDb = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("DB Write Error:", e);
        return false;
    }
};

// Timeout Wrapper Helper
const runWithTimeout = (promise) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("AI_TIMEOUT"));
        }, AI_TIMEOUT_MS);
    });

    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
};

// --- GEMINI SETUP & TOOLS (Server Side) ---
const apiKey = process.env.API_KEY || process.env.REACT_APP_API_KEY; 
// In a real Node env, use process.env.API_KEY. 
// Assuming the environment running this server has the key.

let ai = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    console.warn("WARNING: API_KEY is missing in server environment.");
}

// Mock Local Knowledge Base
const getLocalKnowledge = (query) => {
    return `اطلاعات یافت شده در پایگاه داده داخلی برای "${query}":
    رفسنجان یکی از شهرهای مهم استان کرمان و مرکز پسته ایران است.
    مکان‌های دیدنی شامل: خانه حاج آقا علی (بزرگترین خانه خشتی جهان)، دره راگه، و بازار قدیم.
    پسته رفسنجان شهرت جهانی دارد و ارقام اکبری، کله‌قوچی و احمدآقایی معروف‌ترین آنها هستند.`;
};

const vectorSearchTool = {
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

// --- AUTH ROUTES ---
app.post('/api/auth/register', (req, res) => {
    try {
        const { phone, password, name } = req.body;
        if (!phone || !password || !name) return res.status(400).json({ error: "Missing fields" });
        const db = getDb();
        if (db.users.find(u => u.phone === phone)) return res.status(409).json({ error: "Phone exists" });
        
        const newUser = {
            id: Date.now().toString(),
            phone, password, name,
            email: '', bio: 'کاربر جدید',
            joinedDate: new Date().toLocaleDateString('fa-IR'),
            learnedData: [], traits: [], customInstructions: ''
        };
        db.users.push(newUser);
        saveDb(db);
        const { password: _, ...userSafe } = newUser;
        return res.status(200).json(userSafe);
    } catch (error) { return res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { phone, password } = req.body;
        const db = getDb();
        const user = db.users.find(u => u.phone === phone);
        if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials" });
        const { password: _, ...userSafe } = user;
        return res.status(200).json(userSafe);
    } catch (error) { return res.status(500).json({ error: "Server Error" }); }
});

// --- DATA ROUTES ---
app.post('/api/user/update', (req, res) => {
    const updatedUser = req.body;
    const db = getDb();
    const index = db.users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
        db.users[index] = { ...updatedUser, password: db.users[index].password };
        saveDb(db);
        return res.json(updatedUser);
    }
    return res.status(404).json({ error: "User not found" });
});

app.get('/api/sessions/:userId', (req, res) => {
    const db = getDb();
    res.json(db.sessions.filter(s => s.userId === req.params.userId));
});

app.post('/api/sessions', (req, res) => {
    const session = req.body;
    const db = getDb();
    const index = db.sessions.findIndex(s => s.id === session.id);
    if (index !== -1) db.sessions[index] = session;
    else db.sessions.push(session);
    saveDb(db);
    res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
    const db = getDb();
    const initLen = db.sessions.length;
    db.sessions = db.sessions.filter(s => s.id !== req.params.id);
    if (db.sessions.length !== initLen) {
        saveDb(db);
        res.json({ success: true });
    } else res.status(404).json({ error: "Not found" });
});

app.get('/api/user/:id', (req, res) => {
    const db = getDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (user) {
        const { password, ...userSafe } = user;
        res.json(userSafe);
    } else res.status(404).json({ error: "Not found" });
});

// --- AI ENDPOINTS (Server Side Generation) ---

// 1. CHAT ENDPOINT
app.post('/api/chat', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured on server" });
    
    try {
        const { history, user, tasks } = req.body; 
        
        const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const tasksSummary = tasks ? tasks.map(t => `- ${t.title} (${t.status}, ${t.date})`).join('\n') : 'هیچ';

        const systemInstruction = `
          شما "شهریار" هستید، هوش مصنوعی بومی و هوشمند شهر رفسنجان.
          تاریخ امروز: ${today} است.
          دستورالعمل‌های اختصاصی کاربر: ${user.customInstructions || 'ندارد'}
          برای سوالات تخصصی رفسنجان از ابزار search_knowledge_base استفاده کن.
          لحن: صمیمی، محترمانه و به زبان فارسی.
          لیست وظایف کاربر:
          ${tasksSummary}
        `;

        let currentHistory = [...history];
        let finalResponseText = '';
        let collectedSources = [];

        // Loop for function calling (max 3 turns)
        for (let turn = 0; turn < 3; turn++) {
            const response = await runWithTimeout(
                ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: currentHistory,
                    config: {
                        systemInstruction,
                        tools: [{ functionDeclarations: [vectorSearchTool] }],
                    }
                })
            );

            // Handle Function Calls
            const functionCalls = response.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                if (call.name === 'search_knowledge_base') {
                    const query = call.args.query;
                    const result = getLocalKnowledge(query);
                    
                    // Add tool call and response to history for next iteration
                    currentHistory.push({
                        role: 'model',
                        parts: [{ functionCall: call }]
                    });
                    currentHistory.push({
                        role: 'user',
                        parts: [{ functionResponse: { name: call.name, response: { result: result } } }]
                    });
                    continue; // Loop again to get model's interpretation of tool result
                }
            }

            // Extract Text
            if (response.text) {
                finalResponseText = response.text;
            }

            // Extract Grounding
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const newSources = groundingChunks
                    .filter(c => c.web?.uri && c.web?.title)
                    .map(c => ({ title: c.web.title, uri: c.web.uri }));
                collectedSources = [...collectedSources, ...newSources];
            }
            
            // If we got text and no function call, we are done
            break; 
        }

        res.json({ text: finalResponseText, sources: collectedSources });

    } catch (error) {
        if (error.message === 'AI_TIMEOUT') {
             console.error("Chat Timeout Error");
             return res.status(504).json({ error: "زمان پاسخگویی هوش مصنوعی به پایان رسید. لطفا مجددا تلاش کنید." });
        }
        console.error("Chat Error:", error);
        res.status(500).json({ error: error.message || "AI Error" });
    }
});

// 2. PROFILE ANALYSIS ENDPOINT
app.post('/api/profile/analyze', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured" });
    try {
        const { messages } = req.body;
        const prompt = `
          Analyze the following messages sent by a user to an AI city assistant (Shahryar).
          Identify 4 to 6 specific personality traits, interests, or communication styles of this user.
          User Messages: "${messages.slice(0, 5000)}"
          Output Rules:
          1. Return ONLY a JSON array of strings.
          2. The strings must be in Persian (Farsi).
          3. Be concise (1-3 words per trait).
        `;
        
        const response = await runWithTimeout(
            ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            })
        );
        res.json(JSON.parse(response.text || "[]"));
    } catch (e) {
        if (e.message === 'AI_TIMEOUT') {
            return res.status(504).json({ error: "زمان تحلیل پروفایل به پایان رسید." });
        }
        res.status(500).json({ error: "Analysis failed" }); 
    }
});

// 3. PLANNING GENERATION ENDPOINT
app.post('/api/planning/generate', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured" });
    try {
        const { prompt, categories } = req.body;
        const now = new Date().toLocaleDateString('fa-IR');
        const systemPrompt = `
            You are a smart task planning assistant. Current Date (Jalali): ${now}.
            Available Categories: ${JSON.stringify(categories)}
            User Request: "${prompt}"
            Task: Convert request to JSON array of tasks.
            Format: [{ "title": "...", "description": "...", "date": "...", "categoryId": "..." }]
            Date must be valid Jalali. Output ONLY JSON.
        `;
        const response = await runWithTimeout(
            ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: systemPrompt,
                config: { responseMimeType: 'application/json' }
            })
        );
        res.json(JSON.parse(response.text || "[]"));
    } catch (e) { 
        if (e.message === 'AI_TIMEOUT') {
            return res.status(504).json({ error: "زمان تولید برنامه به پایان رسید." });
        }
        res.status(500).json({ error: "Generation failed" }); 
    }
});

// 4. HOME CONTENT GENERATION
app.post('/api/home/content', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured" });
    try {
        const { tasks, chats, type } = req.body; 
        
        let prompt = "";
        let config = {};

        if (type === 'suggestion') {
            prompt = `Based on user tasks: [${tasks}] and chats: [${chats}], give a very short (max 15 words) friendly Persian suggestion for today.`;
        } else if (type === 'fact') {
            prompt = `Tell me one interesting short fact about Rafsanjan city (history, pistachio, culture) in Persian. Max 20 words.`;
        } else if (type === 'notification') {
            prompt = `Act as Shahryar. Based on pending tasks: [${tasks}] and interests: [${chats}], generate a personalized, urgent, or motivating notification/tip (max 2 sentences) in Persian.`;
        } else if (type === 'smart-task') {
             const { input } = req.body;
             const now = new Date().toLocaleDateString('fa-IR');
             prompt = `Convert user input to task JSON: "${input}". Current Date: ${now}. Format: { "title": "...", "description": "...", "date": "...", "categoryId": "cat_todo" }. Date should be Jalali.`;
             config = { responseMimeType: 'application/json' };
        }

        const response = await runWithTimeout(
            ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: config
            })
        );

        if (type === 'smart-task') {
            res.json(JSON.parse(response.text || '{}'));
        } else {
            res.json({ text: response.text });
        }
    } catch (e) { 
        if (e.message === 'AI_TIMEOUT') {
             return res.status(504).json({ error: "زمان دریافت محتوا به پایان رسید." });
        }
        res.status(500).json({ error: "Generation failed" }); 
    }
});

// --- PRODUCTION SERVING ---
const buildPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        if (req.url.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
        res.sendFile(path.join(buildPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});