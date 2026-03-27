require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const db = require('./db');
const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exam');
const socketHandlers = require('./socket/handlers');
const { calculateSessionScore } = require('./utils/helpers');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:4173', // vite preview
];

// Setup Socket.IO
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

const logsDir = path.resolve(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const appLogStream = fs.createWriteStream(path.join(logsDir, 'app.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

const stringifyLogArgs = (args) => {
    try {
        return args.map(a => {
            if (a instanceof Error) return { message: a.message, stack: a.stack };
            if (typeof a === 'object') return a;
            return String(a);
        });
    } catch (_e) {
        void _e;
        return [String(args)];
    }
};

const writeLogLine = (stream, payload) => {
    try {
        stream.write(JSON.stringify(payload) + '\n');
    } catch (_e) {
        void _e;
    }
};

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
    writeLogLine(errorLogStream, { ts: new Date().toISOString(), level: 'error', args: stringifyLogArgs(args) });
    originalConsoleError(...args);
};

const originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
    writeLogLine(appLogStream, { ts: new Date().toISOString(), level: 'info', args: stringifyLogArgs(args) });
    originalConsoleLog(...args);
};

// App Settings
app.set('io', io);
app.set('trust proxy', 1); // Trust first proxy (Nginx/Cloudflare) to fix express-rate-limit X-Forwarded-For error

// Global Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev')); // Gunakan 'dev' untuk logging yang lebih ringkas di console
app.use(morgan('combined', { stream: accessLogStream }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api', examRoutes);

// Socket Handlers
socketHandlers(io);

app.use((err, req, res, next) => {
    void next;
    const payload = {
        ts: new Date().toISOString(),
        level: 'error',
        type: 'express_error',
        method: req.method,
        url: req.originalUrl,
        message: err?.message || 'Unknown error',
        stack: err?.stack
    };
    writeLogLine(errorLogStream, payload);
    io.to('admin_dashboard').emit('ops_alert', { level: 'error', message: payload.message, ts: payload.ts });
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
});

// Background Worker: Auto-finalize expired sessions
const autoFinalizeWorker = () => {
    const now = new Date().toISOString();
    db.all("SELECT id, exam_id, participant_id FROM exam_sessions WHERE status = 'ongoing' AND is_suspended = 0 AND end_time < ?", [now], (err, sessions) => {
        if (err) return console.error('[Worker] Error fetching expired sessions:', err);
        if (sessions.length > 0) {
            console.log(`[Worker] Found ${sessions.length} expired sessions. Finalizing...`);
            sessions.forEach(session => {
                calculateSessionScore(session.id, session.exam_id).then(({ totalScore, detailedScores, isPassed }) => {
                    db.run(`UPDATE exam_sessions SET status = 'finished', final_score_total = ?, category_scores = ?, is_passed = ? WHERE id = ?`,
                        [totalScore, JSON.stringify(detailedScores), isPassed, session.id],
                        (err) => {
                            if (err) console.error(`[Worker] Failed to finalize session ${session.id}:`, err);
                            else {
                                console.log(`[Worker] Automatically finalized session for participant: ${session.participant_id}`);
                                io.to('admin_dashboard').emit('admin_update', { type: 'SESSION_AUTO_FINISHED', participantId: session.participant_id });
                            }
                        }
                    );
                }).catch(e => console.error(`[Worker] Scoring failed for ${session.id}:`, e));
            });
        }
    });
};

// Start worker every 30 seconds
const autoFinalizeInterval = setInterval(autoFinalizeWorker, 30000);

// Server Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[CAT Backend] Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown
const gracefulShutdown = () => {
    console.log('\n[CAT Backend] Memulai graceful shutdown...');
    clearInterval(autoFinalizeInterval);
    server.close(() => {
        console.log('[CAT Backend] HTTP Server dan Socket ditutup.');
        db.close((err) => {
            if (err) {
                console.error('[CAT Backend] Kesalahan menutup database:', err);
                process.exit(1);
            }
            console.log('[CAT Backend] Database SQLite diputuskan dengan aman.');
            process.exit(0);
        });
    });

    setTimeout(() => {
        console.error('[CAT Backend] Shutdown timeout, forcing exit.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    writeLogLine(errorLogStream, { ts: new Date().toISOString(), level: 'error', type: 'unhandledRejection', message, stack });
    io.to('admin_dashboard').emit('ops_alert', { level: 'error', message: `Unhandled rejection: ${message}`, ts: new Date().toISOString() });
});

process.on('uncaughtException', (err) => {
    writeLogLine(errorLogStream, { ts: new Date().toISOString(), level: 'error', type: 'uncaughtException', message: err?.message, stack: err?.stack });
    io.to('admin_dashboard').emit('ops_alert', { level: 'error', message: `Uncaught exception: ${err?.message || 'Unknown error'}`, ts: new Date().toISOString() });
});
