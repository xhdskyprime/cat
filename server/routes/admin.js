const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
const os = require('os');
const fsp = require('fs/promises');
const path = require('path');
const db = require('../db');
const { authenticateAdmin, authenticateSuperadmin, loginLimiter, ADMIN_JWT_SECRET } = require('../middleware/auth');
const { logAudit, calculateSessionScore, reconstructQuestions, hashPassword, comparePassword } = require('../utils/helpers');

const upload = multer({ storage: multer.memoryStorage() });

const tailFile = async (filePath, maxLines = 200) => {
    try {
        const stat = await fsp.stat(filePath);
        const chunkSize = Math.min(512 * 1024, stat.size);
        const start = Math.max(0, stat.size - chunkSize);
        const fh = await fsp.open(filePath, 'r');
        try {
            const buf = Buffer.alloc(chunkSize);
            const { bytesRead } = await fh.read(buf, 0, chunkSize, start);
            const text = buf.subarray(0, bytesRead).toString('utf8');
            const lines = text.split(/\r?\n/).filter(Boolean);
            return lines.slice(-maxLines);
        } finally {
            await fh.close();
        }
    } catch (_e) {
        void _e;
        return [];
    }
};

// ---- ADMIN AUTH ----
router.post('/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id, username, password_hash, role FROM admins WHERE username = $1', [username], async (err, admin) => {
        if (err) return res.status(500).json({ error: 'Kesalahan database.' });
        if (admin && await comparePassword(password, admin.password_hash)) {
            const token = jwt.sign({ role: admin.role, username: admin.username, adminId: admin.id }, ADMIN_JWT_SECRET, { expiresIn: '12h' });
            res.json({ success: true, token, role: admin.role, username: admin.username });
        } else {
            res.status(401).json({ error: 'Username atau password admin salah.' });
        }
    });
});

// ---- MANAJEMEN ADMIN USERS (RBAC) ----
router.get('/users', authenticateSuperadmin, (req, res) => {
    db.all('SELECT id, username, role, created_at FROM admins ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/users', authenticateSuperadmin, async (req, res) => {
    const { username, password, role } = req.body;
    const newId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);
    db.run('INSERT INTO admins (id, username, password_hash, role) VALUES ($1, $2, $3, $4)',
        [newId, username, hashedPassword, role || 'pengawas'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Username sudah ada.' : err.message });
            logAudit(req.admin.username, 'CREATE_ADMIN', 'admins', newId, { username, role });
            res.json({ success: true, message: 'Admin berhasil ditambahkan.' });
        }
    );
});

router.put('/users/:id', authenticateSuperadmin, async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    let query, params;
    if (password) {
        const hashedPassword = await hashPassword(password);
        query = 'UPDATE admins SET username = $1, password_hash = $2, role = $3 WHERE id::text = $4';
        params = [username, hashedPassword, role, id];
    } else {
        query = 'UPDATE admins SET username = $1, role = $2 WHERE id::text = $3';
        params = [username, role, id];
    }
    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'UPDATE_ADMIN', 'admins', id, { username, role });
        res.json({ success: true, message: 'Admin diperbarui.' });
    });
});

router.delete('/users/:id', authenticateSuperadmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM admins WHERE id::text = $1', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'DELETE_ADMIN', 'admins', id);
        res.json({ success: true, message: 'Admin dihapus.' });
    });
});

// ---- MANAJEMEN MASTER DATA KATEGORI ----
router.get('/categories', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM categories ORDER BY sort_order ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/categories', authenticateAdmin, (req, res) => {
    const { id, name, passing_grade, full_score, is_random, sort_order } = req.body;
    db.run('INSERT INTO categories (id, name, passing_grade, full_score, is_random, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [id.toUpperCase(), name, passing_grade || 0, full_score || 100, (is_random === undefined || is_random === true || is_random === 'true') ? true : false, sort_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req.admin.username, 'CREATE_CATEGORY', 'categories', id, req.body);
            res.json({ success: true, message: 'Kategori berhasil ditambahkan.' });
        }
    );
});

router.put('/categories/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { name, passing_grade, full_score, is_random, sort_order } = req.body;
    db.run('UPDATE categories SET name = $1, passing_grade = COALESCE($2, passing_grade), full_score = COALESCE($3, full_score), is_random = COALESCE($4, is_random), sort_order = COALESCE($5, sort_order) WHERE id = $6',
        [name, passing_grade, full_score, is_random !== undefined ? ((is_random === true || is_random === 'true') ? true : false) : null, sort_order, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req.admin.username, 'UPDATE_CATEGORY', 'categories', id, req.body);
            res.json({ success: true, message: 'Kategori berhasil diperbarui.' });
        }
    );
});

router.delete('/categories/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM categories WHERE id = $1', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'DELETE_CATEGORY', 'categories', id);
        res.json({ success: true, message: 'Kategori berhasil dihapus.' });
    });
});

// ---- PESERTA CRUD ----
router.get('/participants', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT p.id, p.nik, p.nomor_peserta, p.nama, p.is_active, p.exam_id, p.created_at, e.title as exam_title 
        FROM participants p 
        LEFT JOIN exams e ON p.exam_id = e.id 
        ORDER BY p.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/participants', authenticateAdmin, (req, res) => {
    const { nik, nomor_peserta, nomorPeserta, nama, exam_id } = req.body;
    const finalNomorPeserta = nomor_peserta || nomorPeserta;
    if (!nik || !finalNomorPeserta || !nama) return res.status(400).json({ error: 'NIK, No. Peserta, dan Nama wajib diisi.' });
    const newId = crypto.randomUUID();
    db.run('INSERT INTO participants (id, nik, nomor_peserta, nama, password_hash, exam_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [newId, nik, finalNomorPeserta, nama, '123456', exam_id || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message.includes('UNIQUE') ? 'NIK atau nomor peserta sudah terdaftar.' : err.message });
            logAudit(req.admin.username, 'CREATE_PARTICIPANT', 'participants', newId, { nama, nik });
            res.json({ success: true, id: newId, message: 'Peserta berhasil ditambahkan.' });
        }
    );
});

router.put('/participants/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { nama, nik, nomor_peserta, nomorPeserta, is_active, isActive, exam_id } = req.body;
    const finalNomorPeserta = nomor_peserta || nomorPeserta;
    const finalActive = is_active !== undefined ? (is_active === true || is_active === "true") : (isActive !== undefined ? (isActive === true || isActive === "true") : true);
    db.run('UPDATE participants SET nama = $1, nik = $2, nomor_peserta = $3, is_active = $4, exam_id = $5 WHERE id::text = $6',
        [nama, nik, finalNomorPeserta, finalActive, exam_id || null, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req.admin.username, 'UPDATE_PARTICIPANT', 'participants', id, { nama, nik });
            res.json({ success: true, message: 'Data peserta diperbarui.' });
        }
    );
});

router.delete('/participants/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM participants WHERE id::text = $1', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'DELETE_PARTICIPANT', 'participants', id);
        res.json({ success: true, message: 'Peserta dihapus.' });
    });
});

router.post('/participants/:id/reset-session', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM answers WHERE session_id IN (SELECT id FROM exam_sessions WHERE participant_id::text = $1)', [id]);
        await client.query('DELETE FROM exam_sessions WHERE participant_id::text = $1', [id]);
        await client.query('COMMIT');
        logAudit(req.admin.username, 'RESET_SESSION', 'participants', id);
        res.json({ success: true, message: 'Sesi peserta berhasil direset.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.patch('/participants/:id/toggle-active', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.get('SELECT is_active FROM participants WHERE id::text = $1', [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
        const newStatus = !row.is_active;
        db.run('UPDATE participants SET is_active = $1 WHERE id::text = $2', [newStatus, id], function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            logAudit(req.admin.username, 'TOGGLE_PARTICIPANT_STATUS', 'participants', id, { status: newStatus });
            res.json({ success: true, is_active: newStatus, message: newStatus ? 'Peserta diaktifkan.' : 'Peserta dinonaktifkan.' });
        });
    });
});

router.post('/participants/:id/reset-password', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const newPass = req.body.newPassword || 'Password123';
    db.run('UPDATE participants SET password_hash = $1 WHERE id::text = $2', [newPass, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'RESET_PASSWORD', 'participants', id);
        res.json({ success: true, message: `Password direset ke: ${newPass}` });
    });
});

router.get('/participant-history/:id', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT s.id, s.start_time, s.end_time, s.status,
               s.final_score_total, s.category_scores, s.is_passed,
               e.title as exam_title,
               COALESCE(ac.answered_count, 0) as answered_count
        FROM exam_sessions s 
        JOIN exams e ON s.exam_id = e.id
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as answered_count FROM answers WHERE session_id = s.id AND selected_option_id IS NOT NULL
        ) ac ON true
        WHERE s.participant_id::text = $1 
        ORDER BY s.start_time DESC
    `, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ---- SOAL CRUD ----
router.get('/questions', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM questions ORDER BY category, created_at ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = rows.map(r => ({ 
            ...r, 
            options: typeof r.options === 'string' ? JSON.parse(r.options || '[]') : (r.options || []) 
        }));
        res.json(formatted);
    });
});

router.post('/questions', authenticateAdmin, (req, res) => {
    const { examId, exam_id, category, content, options, image_url, audio_url } = req.body;
    if (!category || !content || !options || options.length < 2) {
        return res.status(400).json({ error: 'Data soal tidak lengkap.' });
    }
    const targetExamId = exam_id || examId;
    const getExamId = targetExamId ? Promise.resolve(targetExamId)
        : new Promise((resolve, reject) => {
            db.get('SELECT id FROM exams WHERE is_active = true LIMIT 1', [], (err, row) => {
                if (err || !row) reject(new Error('Tidak ada ujian aktif.'));
                else resolve(row.id);
            });
        });

    getExamId.then(eid => {
        const newId = crypto.randomUUID();
        db.run('INSERT INTO questions (id, exam_id, category, content, options, image_url, audio_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [newId, eid, category, content, typeof options === "string" ? options : JSON.stringify(options), image_url || null, audio_url || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logAudit(req.admin.username, 'CREATE_QUESTION', 'questions', newId, { category, content });
                res.json({ success: true, id: newId, message: 'Soal berhasil ditambahkan.' });
            }
        );
    }).catch(e => res.status(400).json({ error: 'Gagal: ' + e.message + ' Silakan buat dan aktifkan Sesi Ujian terlebih dahulu.' }));
});

router.put('/questions/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { category, content, options, image_url, audio_url } = req.body;
    db.run('UPDATE questions SET category = $1, content = $2, options = $3, image_url = $4, audio_url = $5 WHERE id::text = $6',
        [category, content, typeof options === "string" ? options : JSON.stringify(options), image_url || null, audio_url || null, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req.admin.username, 'UPDATE_QUESTION', 'questions', id, { category, content });
            res.json({ success: true, message: 'Soal diperbarui.' });
        }
    );
});

router.delete('/questions/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM questions WHERE id::text = $1', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'DELETE_QUESTION', 'questions', id);
        res.json({ success: true, message: 'Soal dihapus.' });
    });
});

router.post('/questions/bulk-delete', authenticateAdmin, (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ID tidak valid' });

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    db.run(`DELETE FROM questions WHERE id::text IN (${placeholders})`, ids, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req.admin.username, 'BULK_DELETE_QUESTIONS', 'questions', 'bulk', { count: ids.length });
        res.json({ success: true, message: `${ids.length} soal berhasil dihapus.` });
    });
});

// ---- MANAJEMEN UJIAN ----
router.get('/exams', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM exams ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/exams', authenticateAdmin, (req, res) => {
    const { title, description, duration_minutes, durationMinutes, token, config } = req.body;
    if (!title || !token) return res.status(400).json({ error: 'Nama ujian dan token wajib diisi.' });

    const newId = crypto.randomUUID();
    const show_result = req.body.show_result !== undefined ? (req.body.show_result === true || req.body.show_result === "true") : true;
    
    db.run('INSERT INTO exams (id, title, description, duration_minutes, token, config, show_result) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [newId, title, description || '', duration_minutes || durationMinutes || 100, token.toUpperCase(), typeof config === 'string' ? config : JSON.stringify(config || {}), show_result],
        function (err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            logAudit(req.admin.username, 'CREATE_EXAM', 'exams', newId, { title, token });
            res.json({ success: true, id: newId, message: 'Ujian berhasil dibuat.' });
        }
    );
});

router.put('/exams/:id', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { title, description, duration_minutes, durationMinutes, token, config, is_active, isActive, show_result, showResult } = req.body;
    const finalToken = (token || '').toUpperCase();
    const finalDuration = duration_minutes || durationMinutes || 100;
    const finalActive = is_active !== undefined ? (is_active === true || is_active === "true") : (isActive !== undefined ? (isActive === true || isActive === "true") : true);
    const finalShowResult = show_result !== undefined ? (show_result === true || show_result === "true") : (showResult !== undefined ? (showResult === true || showResult === "true") : true);
    const finalConfig = typeof config === 'string' ? config : JSON.stringify(config || {});

    db.run('UPDATE exams SET title = $1, description = $2, duration_minutes = $3, token = $4, config = $5, is_active = $6, show_result = $7 WHERE id::text = $8',
        [title, description, finalDuration, finalToken, finalConfig, finalActive, finalShowResult, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req.admin.username, 'UPDATE_EXAM', 'exams', id, { title, token: finalToken });
            res.json({ success: true, message: 'Sesi ujian diperbarui.' });
        }
    );
});

router.patch('/exams/:id/settings', authenticateAdmin, (req, res) => {
    const { scheduleStart, scheduleEnd, showResult, show_result, allowReview, maxAttempts } = req.body;
    const finalShowResult = show_result !== undefined ? (show_result === true || show_result === "true") : (showResult !== undefined ? (showResult === true || showResult === "true") : true);
    const finalAllowReview = allowReview === true || allowReview === "true";
    db.run('UPDATE exams SET schedule_start=$1, schedule_end=$2, show_result=$3, allow_review=$4, max_attempts=$5 WHERE id::text=$6',
        [scheduleStart || null, scheduleEnd || null, finalShowResult, finalAllowReview, maxAttempts || 1, req.params.id],
        function (err) { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); }
    );
});

router.delete('/exams/:id', authenticateAdmin, async (req, res) => {
    const examId = req.params.id;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        // Hapus history sesi peserta (hanya data ujian peserta yang dihapus)
        await client.query('DELETE FROM answers WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id::text=$1)', [examId]);
        await client.query('DELETE FROM exam_sessions WHERE exam_id::text=$1', [examId]);
        await client.query('UPDATE participants SET exam_id=NULL WHERE exam_id::text=$1', [examId]);
        await client.query('DELETE FROM exams WHERE id::text=$1', [examId]);
        await client.query('COMMIT');
        logAudit(req.admin.username, 'DELETE_EXAM', 'exams', examId, null);
        res.json({ success: true, message: 'Sesi ujian beserta riwayatnya berhasil dihapus.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("=== FATAL EXAM DELETE DB ERROR ===", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});



// ---- LIVE MONITORING ----
router.get('/live-monitoring', authenticateAdmin, (req, res) => {
    const { examId } = req.query;
    const where = examId ? 'WHERE s.exam_id::text = $1' : '';
    const params = examId ? [examId] : [];
    db.all(`
        SELECT 
            s.id as session_id, s.status, s.start_time, s.end_time,
            s.exam_id,
            s.final_score_total, s.category_scores, s.is_passed,
            s.is_suspended, s.extra_time, s.fs_violations, s.tab_violations,
            p.id as participant_id, p.nik, p.nomor_peserta, p.nama,
            COALESCE(e.title, '-') as exam_title,
            e.config as exam_config,
            COALESCE(ac.answered_count, 0) as answered_count,
            COALESCE(qc.db_total_questions, 0) as db_total_questions
        FROM exam_sessions s
        JOIN participants p ON s.participant_id = p.id
        LEFT JOIN exams e ON s.exam_id = e.id
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as answered_count 
            FROM answers 
            WHERE session_id = s.id AND selected_option_id IS NOT NULL
        ) ac ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as db_total_questions 
            FROM questions 
            WHERE exam_id = s.exam_id
        ) qc ON true
        ${where}
        ORDER BY s.start_time DESC
    `, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processedRows = rows.map(row => {
            let totalQuestions = row.db_total_questions;
            if (row.exam_config) {
                try {
                    const config = typeof row.exam_config === 'string' ? JSON.parse(row.exam_config) : (row.exam_config || {});
                    const nonCategoryKeys = ['score_mode', 'total_pass', 'total_full'];
                    totalQuestions = Object.entries(config)
                        .filter(([key]) => !nonCategoryKeys.includes(key))
                        .reduce((sum, [_, val]) => {
                            const count = typeof val === 'object' ? Number(val.count) : Number(val);
                            return sum + (count || 0);
                        }, 0);
                } catch (_e) { void _e; }
            }
            return { 
                ...row, 
                total_questions: totalQuestions || row.db_total_questions,
                category_scores: typeof row.category_scores === 'string' ? JSON.parse(row.category_scores || '{}') : (row.category_scores || {})
            };
        });
        res.json({ sessions: processedRows, serverNow: new Date().toISOString() });
    });
});

// ---- REPORTS & ANALYTICS ----
router.get('/export-results', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT 
            p.nama, p.nik, p.nomor_peserta, 
            s.status, s.start_time, s.end_time,
            s.category_scores, s.final_score_total, s.is_passed, 
            s.id as session_id,
            s.exam_id, 
            COALESCE(e.title, '⚠️ Sesi Tidak Terhapus/Hilang') as exam_title
        FROM exam_sessions s
        JOIN participants p ON s.participant_id = p.id
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE s.status = 'finished' OR (s.status = 'ongoing' AND s.end_time < $1)
        ORDER BY s.final_score_total DESC
    `, [new Date().toISOString()], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const processed = rows.map(r => ({
            ...r,
            category_scores: typeof r.category_scores === 'string' ? JSON.parse(r.category_scores || '{}') : (r.category_scores || {})
        }));
        res.json(processed);
    });
});

router.get('/question-stats', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT q.id, q.category, q.content, q.options,
               COUNT(DISTINCT s.id) as total_sessions,
               SUM(CASE WHEN a.selected_option_id IS NOT NULL THEN 1 ELSE 0 END) as answered_count,
               SUM(CASE WHEN a.is_correct = true THEN 1 ELSE 0 END) as correct_count
        FROM questions q
        LEFT JOIN answers a ON a.question_id = q.id
        LEFT JOIN exam_sessions s ON a.session_id = s.id
        GROUP BY q.id
        ORDER BY q.category, q.created_at
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(q => ({
            ...q,
            options: typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || []),
            correct_rate: q.answered_count > 0 ? (q.correct_count / q.answered_count) * 100 : 0
        })));
    });
});

// Participant Specific Detailed Review
router.get('/sessions/:sessionId/review', authenticateAdmin, (req, res) => {
    const { sessionId } = req.params;
    db.get('SELECT exam_id FROM exam_sessions WHERE id::text = $1', [sessionId], (err, session) => {
        if (err || !session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

        reconstructQuestions(sessionId, session.exam_id)
            .then(questions => {
                db.all('SELECT question_id, selected_option_id, is_correct, updated_at FROM answers WHERE session_id::text = $1', [sessionId], (err, answers) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const answerMap = {};
                    answers.forEach(a => answerMap[a.question_id] = a);

                    const reviewData = questions.map(q => {
                        const ans = answerMap[q.id] || {};
                        return {
                            question_id: q.id,
                            category: q.category,
                            question_text: q.question,
                            question_options: q.options,
                            selected_option_id: ans.selected_option_id || null,
                            is_correct: ans.is_correct,
                            answered_at: ans.updated_at
                        };
                    });

                    res.json(reviewData);
                });
            })
            .catch(err => {
                res.status(500).json({ error: err.message });
            });
    });
});

router.get('/question-details/:questionId', authenticateAdmin, (req, res) => {
    const { questionId } = req.params;
    db.all(`
        SELECT p.nama as participant_name, p.nik, p.nomor_peserta,
               a.selected_option_id, q.options as question_options
        FROM answers a
        JOIN exam_sessions s ON a.session_id = s.id
        JOIN participants p ON s.participant_id = p.id
        JOIN questions q ON a.question_id = q.id
        WHERE a.question_id::text = $1
        ORDER BY p.nama ASC
    `, [questionId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ 
            ...r, 
            question_options: typeof r.question_options === 'string' ? JSON.parse(r.question_options || '[]') : (r.question_options || []) 
        })));
    });
});

// ---- SYSTEM SETTINGS & AUDIT ----
router.get('/audit-logs', authenticateAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as count FROM audit_logs', [], (err, total) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                data: rows,
                total: total.count,
                page,
                limit
            });
        });
    });
});

router.get('/settings', authenticateAdmin, (req, res) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const obj = {}; rows.forEach(r => obj[r.key] = r.value); res.json(obj);
    });
});

router.put('/settings', authenticateAdmin, async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [k, v] of entries) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
                    [k, String(v)], (err) => err ? reject(err) : resolve());
            });
        }
        logAudit(req.admin.username, 'UPDATE_SETTINGS', 'settings', 'all', req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- APPEARANCE TEMPLATES ----
router.get('/appearance-templates', authenticateAdmin, (req, res) => {
    db.all('SELECT * FROM appearance_templates ORDER BY is_custom ASC, name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


router.put('/change-password', authenticateAdmin, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const current = process.env.ADMIN_PASSWORD || 'admin123';
    if (currentPassword !== current) return res.status(401).json({ error: 'Password saat ini salah.' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password baru min 6 karakter.' });
    process.env.ADMIN_PASSWORD = newPassword;
    logAudit(req.admin.username, 'CHANGE_ADMIN_PASSWORD', 'admin', 'self');
    res.json({ success: true, message: 'Password admin diubah. Berlaku hingga server restart.' });
});

// ---- PROCTORING CONTROLS ----
router.post('/sessions/:sessionId/force-finish', authenticateAdmin, (req, res) => {
    const { sessionId } = req.params;
    db.get('SELECT last_socket_id, participant_id, exam_id FROM exam_sessions WHERE id::text = $1', [sessionId], (err, session) => {
        if (err || !session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
        calculateSessionScore(sessionId, session.exam_id).then(({ totalScore, detailedScores, isPassed }) => {
            db.run(`UPDATE exam_sessions SET status = 'finished', end_time = CURRENT_TIMESTAMP, final_score_total = $1, category_scores = $2, is_passed = $3 WHERE id::text = $4`,
                [Math.round(totalScore), JSON.stringify(detailedScores), !!isPassed, sessionId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    logAudit(req.admin.username, 'FORCE_FINISH', 'exam_sessions', sessionId, { totalScore });
                    const io = req.app.get('io');
                    if (session.last_socket_id) io.to(session.last_socket_id).emit('FORCE_LOGOUT', { reason: 'Ujian dihentikan paksa (Selesai).' });
                    io.to('admin_dashboard').emit('admin_update', { type: 'SESSION_FINISHED', participantId: session.participant_id });
                    res.json({ success: true, message: 'Sesi berhasil diakhiri.' });
                });
        }).catch(err => res.status(500).json({ error: err.message }));
    });
});

router.post('/sessions/:sessionId/pause', authenticateAdmin, (req, res) => {
    const { sessionId } = req.params;
    db.run('UPDATE exam_sessions SET is_suspended = true WHERE id::text = $1', [sessionId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const io = req.app.get('io');
        io.to(`exam_session_${sessionId}`).emit('SESSION_PAUSED', { sessionId });
        logAudit(req.admin.username, 'PAUSE_SESSION', 'exam_sessions', sessionId);
        res.json({ success: true });
    });
});

router.post('/sessions/:sessionId/resume', authenticateAdmin, (req, res) => {
    const { sessionId } = req.params;
    db.run('UPDATE exam_sessions SET is_suspended = false WHERE id::text = $1', [sessionId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const io = req.app.get('io');
        io.to(`exam_session_${sessionId}`).emit('SESSION_RESUMED', { sessionId });
        logAudit(req.admin.username, 'RESUME_SESSION', 'exam_sessions', sessionId);
        res.json({ success: true });
    });
});

router.post('/sessions/:sessionId/add-time', authenticateAdmin, (req, res) => {
    const { sessionId } = req.params;
    const { minutes } = req.body;
    db.get('SELECT end_time, extra_time FROM exam_sessions WHERE id::text = $1', [sessionId], (err, session) => {
        if (err || !session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        const newEndTime = new Date(new Date(session.end_time).getTime() + minutes * 60000).toISOString();
        const newExtraTime = (session.extra_time || 0) + minutes;
        db.run('UPDATE exam_sessions SET end_time = $1, extra_time = $2 WHERE id::text = $3', [newEndTime, newExtraTime, sessionId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const io = req.app.get('io');
            io.to(`exam_session_${sessionId}`).emit('TIME_ADDED', { sessionId, addedMinutes: minutes, newEndTime });
            logAudit(req.admin.username, 'ADD_TIME', 'exam_sessions', sessionId, { added_minutes: minutes });
            res.json({ success: true });
        });
    });
});

// ---- IMPORT/EXPORT EXCEL ----
router.post('/import-participants', authenticateAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file.' });
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dataRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1).filter(r => r.length >= 3 && r[0] && r[1]);
        if (dataRows.length === 0) return res.status(400).json({ error: 'Data kosong.' });

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            let imported = 0;
            const query = 'INSERT INTO participants (id, nik, nomor_peserta, nama, exam_id, password_hash) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (nik) DO NOTHING';
            
            for (const row of dataRows) {
                const rawExamId = String(row[3] || '').trim();
                const examId = rawExamId === '-' || rawExamId === '' ? (req.body.exam_id || null) : rawExamId;
                const res = await client.query(query, [crypto.randomUUID(), String(row[1]).trim(), String(row[2]).trim(), String(row[0]).trim(), examId, '123456']);
                if (res.rowCount > 0) imported++;
            }
            
            await client.query('COMMIT');
            logAudit(req.admin.username, 'IMPORT_PARTICIPANTS', 'participants', 'bulk', { count: imported });
            res.json({ success: true, imported });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/import-questions', authenticateAdmin, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file.' });
    const { exam_id } = req.body;

    const getExam = exam_id
        ? new Promise((resolve, reject) => {
            db.get('SELECT id FROM exams WHERE id::text = $1', [exam_id], (err, row) => {
                if (err || !row) reject(new Error('Sesi ujian tidak valid.'));
                else resolve(row);
            });
        })
        : new Promise((resolve, reject) => {
            db.get('SELECT id FROM exams WHERE is_active = true LIMIT 1', [], (err, exam) => {
                if (err || !exam) reject(new Error('Tidak ada ujian aktif.'));
                else resolve(exam);
            });
        });    getExam.then(async (exam) => {
        const client = await db.pool.connect();
        try {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const dataRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1).filter(r => r.length >= 3 && r[0] && r[1]);

            await client.query('BEGIN');
            const query = 'INSERT INTO questions (id, exam_id, category, content, options) VALUES ($1, $2, $3, $4, $5)';
            let imported = 0;

            for (const row of dataRows) {
                const category = String(row[0]).trim().toUpperCase();
                const optLabels = ['A', 'B', 'C', 'D', 'E'];
                const correctLabel = String(row[7] || '').trim().toUpperCase();
                const options = optLabels.map((id, i) => {
                    const text = String(row[2 + i] || '').trim();
                    if (!text) return null;
                    let score = 0;
                    if (correctLabel && correctLabel === id) score = Number(row[8]) || 1;
                    else if (!correctLabel) score = Number(row[8 + i]) || 0;
                    return { id, text, score };
                }).filter(Boolean);

                if (options.length >= 2) {
                    await client.query(query, [crypto.randomUUID(), exam.id, category, String(row[1]).trim(), JSON.stringify(options)]);
                    imported++;
                }
            }

            await client.query('COMMIT');
            logAudit(req.admin.username, 'IMPORT_QUESTIONS', 'questions', 'bulk', { count: imported, exam_id: exam.id });
            res.json({ success: true, imported });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Import failed:', err);
            res.status(500).json({ error: 'Gagal menyimpan data import.' });
        } finally {
            client.release();
        }
    }).catch(e => res.status(400).json({ error: e.message }));
});


router.get('/template-participants', authenticateAdmin, (req, res) => {
    db.all('SELECT id, title FROM exams WHERE is_active = true', [], (err, exams) => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Main Data
        const exampleExamId = exams.length > 0 ? exams[0].id : '';
        const mainData = [
            ['Nama', 'NIK', 'Nomor Peserta', 'ID Sesi (Opsional - Lihat Sheet "Referensi Sesi")'],
            ['Budi Santoso', '1234567890123456', '001', exampleExamId]
        ];
        const wsMain = XLSX.utils.aoa_to_sheet(mainData);
        XLSX.utils.book_append_sheet(wb, wsMain, 'Input Peserta');

        // Sheet 2: Reference Exams
        const refData = [['ID Sesi (Copy ini)', 'Nama Sesi / Judul Ujian']];
        exams.forEach(ex => refData.push([ex.id, ex.title]));
        if (exams.length === 0) refData.push(['-', 'Tidak ada sesi aktif']);
        const wsRef = XLSX.utils.aoa_to_sheet(refData);
        XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi Sesi');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=template_peserta_lengkap.xlsx');
        res.send(buf);
    });
});

router.get('/template-questions', authenticateAdmin, (req, res) => {
    db.all('SELECT category, content, options FROM questions LIMIT 2', [], (err, rows) => {
        const wb = XLSX.utils.book_new();
        const header = [['Kategori', 'Soal', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Benar (A/B/C/D/E)', 'Poin (Bila Benar/TKP)']];

        const dataRows = rows.map(r => {
            const options = typeof r.options === 'string' ? JSON.parse(r.options || '[]') : (r.options || []);
            const row = [r.category, r.content];
            // Fill A-E
            for (let i = 0; i < 5; i++) row.push(options[i]?.text || '');

            // Determine correct column/score
            const maxScore = Math.max(...options.map(o => o.score || 0));
            const bestOpt = options.find(o => o.score === maxScore);

            row.push(bestOpt?.id || 'A'); // Answer key
            row.push(maxScore || 1);      // Poin
            return row;
        });

        // If no data, add a generic example
        if (dataRows.length === 0) {
            dataRows.push(['TWK', 'Apa ibukota Indonesia?', 'Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Makassar', 'A', '5']);
        }

        const ws = XLSX.utils.aoa_to_sheet(header.concat(dataRows));
        XLSX.utils.book_append_sheet(wb, ws, 'Data Soal');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=template_bank_soal.xlsx');
        res.send(buf);
    });
});

router.get('/ops/metrics', authenticateSuperadmin, async (req, res) => {
    const io = req.app.get('io');
    const dbPath = path.resolve(__dirname, '..');
    const startDbPing = Date.now();
    const dbPing = await new Promise(resolve => {
        db.get('SELECT 1 as ok', [], (err, row) => {
            if (err) return resolve({ ok: false, error: err.message });
            resolve({ ok: !!row?.ok });
        });
    });
    const dbPingMs = Date.now() - startDbPing;

    let disk = null;
    try {
        const statfs = await fsp.statfs(path.dirname(dbPath));
        const total = Number(statfs.bsize) * Number(statfs.blocks);
        const free = Number(statfs.bsize) * Number(statfs.bfree);
        const available = Number(statfs.bsize) * Number(statfs.bavail);
        disk = { total, free, available };
    } catch (_e) {
        void _e;
    }

    res.json({
        ok: true,
        ts: new Date().toISOString(),
        node: {
            version: process.version,
            pid: process.pid,
            uptimeSec: Math.floor(process.uptime()),
            cwd: process.cwd()
        },
        os: {
            platform: process.platform,
            arch: process.arch,
            hostname: os.hostname(),
            uptimeSec: Math.floor(os.uptime()),
            loadavg: os.loadavg(),
            cpus: os.cpus()?.length || 0,
            totalmem: os.totalmem(),
            freemem: os.freemem()
        },
        processMemory: process.memoryUsage(),
        disk,
        sockets: { connected: io?.engine?.clientsCount ?? null },
        db: { ...dbPing, pingMs: dbPingMs }
    });
});

router.get('/ops/logs', authenticateSuperadmin, async (req, res) => {
    const type = String(req.query.type || 'error');
    const lines = Math.max(10, Math.min(1000, Number(req.query.lines || 200)));
    const logsDir = path.resolve(__dirname, '..', 'logs');
    const file = type === 'access'
        ? path.join(logsDir, 'access.log')
        : (type === 'app' ? path.join(logsDir, 'app.log') : path.join(logsDir, 'error.log'));

    const items = await tailFile(file, lines);
    res.json({ ok: true, type, lines: items });
});

router.post('/ops/clear-logs', authenticateSuperadmin, async (req, res) => {
    const type = String(req.body.type || 'error');
    const logsDir = path.resolve(__dirname, '..', 'logs');
    const fileMap = {
        error: path.join(logsDir, 'error.log'),
        app: path.join(logsDir, 'app.log'),
        access: path.join(logsDir, 'access.log'),
        all: null
    };
    try {
        if (type === 'all') {
            for (const f of Object.values(fileMap)) {
                if (f) await fsp.writeFile(f, '', 'utf8');
            }
        } else {
            const file = fileMap[type];
            if (!file) return res.status(400).json({ error: 'Tipe log tidak valid.' });
            await fsp.writeFile(file, '', 'utf8');
        }
        logAudit(req.admin.username, 'CLEAR_LOGS', 'ops', type);
        res.json({ ok: true, message: `Log ${type} berhasil dibersihkan.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
