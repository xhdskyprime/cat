const db = require('../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, ADMIN_JWT_SECRET } = require('../middleware/auth');

module.exports = (io) => {
    const connectedParticipants = new Map();

    io.on('connection', (socket) => {
        const rawToken = socket.handshake?.auth?.token;
        let auth = null;
        if (rawToken) {
            try {
                const decoded = jwt.verify(rawToken, JWT_SECRET);
                auth = { kind: 'participant', ...decoded };
            } catch (_e) {
                void _e;
                try {
                    const decoded = jwt.verify(rawToken, ADMIN_JWT_SECRET);
                    auth = { kind: 'admin', ...decoded };
                } catch (_e2) {
                    void _e2;
                    auth = null;
                }
            }
        }

        console.log('[Socket] Client connected:', socket.id);

        socket.on('admin_subscribe', () => {
            if (!auth || auth.kind !== 'admin') return;
            socket.join('admin_dashboard');
            console.log('[Socket] Admin joined dashboard channel');
        });

        socket.on('participant_join', ({ sessionId } = {}) => {
            if (!auth || auth.kind !== 'participant') return;
            const participantId = auth.participantId;
            const examId = auth.examId;
            if (!participantId || !examId) return;

            const oldSocketId = connectedParticipants.get(participantId);
            if (oldSocketId && oldSocketId !== socket.id) {
                console.log(`[Anti-Cheat] Multiple Login Detected for ${participantId}. Forcing logout.`);
                io.to(oldSocketId).emit('FORCE_LOGOUT', { reason: 'Login ganda terdeteksi.' });
            }

            connectedParticipants.set(participantId, socket.id);
            socket.join(`exam_${examId}`);
            if (sessionId) {
                db.get('SELECT id FROM exam_sessions WHERE id::text = $1 AND participant_id::text = $2 AND exam_id::text = $3', [sessionId, participantId, examId], (err, row) => {
                    if (!err && row) socket.join(`exam_session_${sessionId}`);
                });
            }
            socket.participantId = participantId;

            db.run('UPDATE exam_sessions SET last_socket_id = $1 WHERE participant_id::text = $2 AND exam_id::text = $3', [socket.id, participantId, examId]);
            console.log(`[Socket] Participant ${participantId} joined`);
        });

        socket.on('admin_broadcast', ({ examId, message, type = 'info' }) => {
            if (!auth || auth.kind !== 'admin') return;
            const target = examId ? `exam_${examId}` : 'all';
            if (target === 'all') {
                io.emit('SERVER_MESSAGE', { message, type, timestamp: new Date() });
            } else {
                io.to(target).emit('SERVER_MESSAGE', { message, type, timestamp: new Date() });
            }
            console.log(`[Socket] Admin broadcast to ${target}: ${message}`);
        });

        socket.on('admin_force_logout', ({ participantId, reason }) => {
            if (!auth || auth.kind !== 'admin') return;
            if (participantId) {
                const targetSocketId = connectedParticipants.get(participantId);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('FORCE_LOGOUT', { reason });
                }
            } else {
                io.emit('FORCE_LOGOUT', { reason });
            }
            console.log(`[Socket] Admin force logout for ${participantId || 'ALL'}`);
        });

        const heartbeatInterval = setInterval(() => {
            socket.emit('server_time', new Date().getTime());
        }, 10000);

        socket.on('disconnect', () => {
            clearInterval(heartbeatInterval);
            if (socket.participantId && connectedParticipants.get(socket.participantId) === socket.id) {
                // AUTO-PAUSE ON DISCONNECT
                db.get(`SELECT id, end_time, is_suspended FROM exam_sessions 
                        WHERE participant_id::text = $1 AND status = 'ongoing' 
                        ORDER BY start_time DESC LIMIT 1`, [socket.participantId], (err, session) => {
                    if (session && !session.is_suspended) {
                        const now = new Date();
                        const currentRemaining = Math.max(0, Math.floor((new Date(session.end_time) - now) / 1000));
                        db.run('UPDATE exam_sessions SET is_suspended = 1, remaining_seconds_at_pause = $1 WHERE id = $2',
                            [currentRemaining, session.id], () => {
                                io.to('admin_dashboard').emit('admin_update');
                                console.log(`[Socket] Auto-paused session ${session.id} for participant ${socket.participantId} on disconnect`);
                            });
                    }
                });
                connectedParticipants.delete(socket.participantId);
            }
            console.log('[Socket] Client disconnected:', socket.id);
        });
    });
};
