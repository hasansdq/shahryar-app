
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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
    // Don't log static file requests to keep logs clean
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

// --- Authentication Routes ---
app.post('/api/auth/register', (req, res) => {
    try {
        console.log("Processing Register...");
        const { phone, password, name } = req.body;
        if (!phone || !password || !name) {
            return res.status(400).json({ error: "لطفا تمام فیلدها را پر کنید." });
        }
        const db = getDb();
        const existingUser = db.users.find(u => u.phone === phone);
        if (existingUser) {
            return res.status(409).json({ error: "این شماره تلفن قبلا ثبت شده است." });
        }
        const newUser = {
            id: Date.now().toString(),
            phone,
            password, 
            name,
            email: '',
            bio: 'کاربر جدید',
            joinedDate: new Date().toLocaleDateString('fa-IR'),
            learnedData: [],
            traits: [],
            customInstructions: ''
        };
        db.users.push(newUser);
        if (saveDb(db)) {
            const { password, ...userSafe } = newUser;
            return res.status(200).json(userSafe);
        } else {
            return res.status(500).json({ error: "خطا در ذخیره سازی" });
        }
    } catch (error) {
        return res.status(500).json({ error: "خطای داخلی سرور" });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        console.log("Processing Login...", req.body.phone);
        const { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });

        const db = getDb();
        const user = db.users.find(u => u.phone === phone);

        if (!user) return res.status(404).json({ error: "حساب کاربری با این شماره یافت نشد." });
        if (user.password !== password) return res.status(401).json({ error: "رمز عبور اشتباه است." });

        const { password: _, ...userSafe } = user;
        return res.status(200).json(userSafe);
    } catch (error) {
        return res.status(500).json({ error: "خطای داخلی سرور" });
    }
});

// --- User & Session Routes ---
app.post('/api/user/update', (req, res) => {
    try {
        const updatedUser = req.body;
        if (!updatedUser.id) return res.status(400).json({ error: "ID required" });
        const db = getDb();
        const index = db.users.findIndex(u => u.id === updatedUser.id);
        if (index !== -1) {
            const currentPass = db.users[index].password;
            db.users[index] = { ...updatedUser, password: currentPass };
            saveDb(db);
            return res.json(updatedUser);
        } else {
            return res.status(404).json({ error: "User not found" });
        }
    } catch (e) { return res.status(500).json({ error: "Update failed" }); }
});

app.get('/api/user/:id', (req, res) => {
    try {
        const db = getDb();
        const user = db.users.find(u => u.id === req.params.id);
        if (user) {
            const { password, ...userSafe } = user;
            return res.json(userSafe);
        } else {
            return res.status(404).json({ error: "User not found" });
        }
    } catch (e) { return res.status(500).json({error: "Server Error"}); }
});

app.get('/api/sessions/:userId', (req, res) => {
    try {
        const db = getDb();
        const sessions = db.sessions.filter(s => s.userId === req.params.userId);
        return res.json(sessions);
    } catch (e) { return res.status(500).json([]); }
});

app.post('/api/sessions', (req, res) => {
    try {
        const session = req.body;
        const db = getDb();
        const index = db.sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            db.sessions[index] = session;
        } else {
            db.sessions.push(session);
        }
        saveDb(db);
        return res.json(session);
    } catch (e) { return res.status(500).json({error: "Save failed"}); }
});

app.delete('/api/sessions/:id', (req, res) => {
    try {
        const db = getDb();
        const initialLen = db.sessions.length;
        db.sessions = db.sessions.filter(s => s.id !== req.params.id);
        if (db.sessions.length !== initialLen) {
            saveDb(db);
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: "Session not found" });
        }
    } catch (e) { return res.status(500).json({error: "Delete failed"}); }
});

app.get('/api/health', (req, res) => res.json({ status: "Online" }));

app.post('/api/vector-search', (req, res) => {
    return res.json({ result: "Search functionality pending OpenAI key configuration." });
});

// --- PRODUCTION SERVING ---
// Serve static files from the React app build directory
const buildPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        // Handle client-side routing by returning index.html for unknown paths
        // Ensure we don't return index.html for api requests
        if (req.url.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
        res.sendFile(path.join(buildPath, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
