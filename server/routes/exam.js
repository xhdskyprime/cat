const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, loginLimiter, JWT_SECRET } = require('../middleware/auth');
const { serveQuestions, calculateSessionScore } = require('../utils/helpers');

// ---- HEALTH CHECK ----
router.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// ---- PUBLIC SETTINGS ----
router.get('/settings', (req, res) => {
    db.all("SELECT key, value FROM settings WHERE key IN ('institution_logo', 'max_tab_violations', 'require_fullscreen', 'max_fs_violations', 'app_name', 'app_version_label', 'support_contact_text', 'support_contact_url')", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch settings' });
        const obj = {};
        rows.forEach(r => obj[r.key] = r.value);
        res.json(obj);
    });
});

// ---- APPEARANCE TEMPLATE ----
router.get('/active-template', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'active_template'", [], (err, row) => {
        if (err || !row) {
            // Rollback to default if no setting
            return res.json({
                id: 'medical',
                name: 'Kesehatan (BLUD Perawat)',
                primary_color: '#0d9488',
                secondary_color: '#f59e0b',
                illustration_url: '/nurse_v3.png',
                headline: 'Tenaga Kesehatan Hebat!',
                sub_headline: 'Portal seleksi <b>Tenaga Kesehatan BLUD.</b><br />Siapkan kompetensi terbaikmu.',
                tagline: 'SAVE LIVES, SERVE BETTER!'
            });
        }
        db.get('SELECT * FROM appearance_templates WHERE id::text = $1', [row.value], (err2, template) => {
            if (err2 || !template) {
                // Return default if template not found to avoid 404
                return res.json({
                    id: 'medical',
                    name: 'Kesehatan (BLVD Perawat)',
                    primary_color: '#0d9488',
                    secondary_color: '#f59e0b',
                    illustration_url: '/nurse_v3.png',
                    headline: 'Tenaga Kesehatan Hebat!',
                    sub_headline: 'Portal seleksi <b>Tenaga Kesehatan BLUD.</b><br />Siapkan kompetensi terbaikmu.',
                    tagline: 'SAVE LIVES, SERVE BETTER!'
                });
            }
            res.json(template);
        });
    });
});

// ---- PARTICIPANT AUTH ----
router.post('/auth/login', loginLimiter, (req, res) => {
    const { nik, nomor_peserta, nomorPeserta, token } = req.body;
    const finalNomorPeserta = nomor_peserta || nomorPeserta;
    if (!nik || !finalNomorPeserta || !token) return res.status(400).json({ error: 'Data login tidak lengkap' });

    db.get('SELECT id, title, duration_minutes, schedule_start, schedule_end, show_result FROM exams WHERE token = $1 AND is_active = true', [token], (err, exam) => {
        if (err || !exam) return res.status(401).json({ error: 'PIN / Token Ujian tidak valid.' });

        const now = new Date();
        const scheduleStart = exam.schedule_start ? new Date(exam.schedule_start) : null;
        const scheduleEnd = exam.schedule_end ? new Date(exam.schedule_end) : null;
        if (scheduleStart && now < scheduleStart) return res.status(403).json({ error: 'Ujian belum dibuka.' });
        if (scheduleEnd && now > scheduleEnd) return res.status(403).json({ error: 'Ujian sudah ditutup.' });

        db.get('SELECT id, nama, is_active, exam_id FROM participants WHERE nik = $1 AND nomor_peserta = $2', [nik, finalNomorPeserta], (err, participant) => {
            if (err || !participant) return res.status(401).json({ error: 'Identitas tidak ditemukan.' });
            if (participant.is_active === false) return res.status(403).json({ error: 'Akses ditolak.' });
            if (participant.exam_id && participant.exam_id !== exam.id) return res.status(403).json({ error: 'Tidak dijadwalkan untuk sesi ini.' });

            const authToken = jwt.sign({ participantId: participant.id, nama: participant.nama, examId: exam.id, duration: exam.duration_minutes }, JWT_SECRET, { expiresIn: '6h' });
            db.get('SELECT status FROM exam_sessions WHERE participant_id = $1 AND exam_id = $2', [participant.id, exam.id], (errSess, sess) => {
                const hasFinished = !!(sess && sess.status === 'finished');
                const hasActiveSession = !!(sess && !hasFinished);
                res.json({
                    success: true,
                    token: authToken,
                    user: { id: participant.id, nama: participant.nama, nik, nomorPeserta: finalNomorPeserta },
                    exam: {
                        id: exam.id,
                        title: exam.title,
                        duration_minutes: exam.duration_minutes,
                        schedule_start: exam.schedule_start,
                        schedule_end: exam.schedule_end,
                        show_result: exam.show_result
                    },
                    hasFinished,
                    hasActiveSession
                });
            });
        });
    });
});

// ---- EXAM OPERATIONS ----
router.get('/exam/status', authenticate, (req, res) => {
    const { participantId, examId } = req.user;
    db.get('SELECT id, status, is_suspended FROM exam_sessions WHERE participant_id = $1 AND exam_id = $2', [participantId, examId], (err, session) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        const hasSession = !!session;
        const hasFinished = !!(session && session.status === 'finished');
        const hasActiveSession = !!(session && !hasFinished);
        res.json({
            success: true,
            hasSession,
            hasFinished,
            hasActiveSession,
            status: session?.status || null,
            sessionId: session?.id || null,
            isSuspended: !!session?.is_suspended
        });
    });
});

router.post('/exam/start', authenticate, (req, res) => {
    const { participantId, examId, duration } = req.user;
    db.get('SELECT title, show_result FROM exams WHERE id::text = $1', [examId], (errExam, exam) => {
        if (errExam || !exam) return res.status(500).json({ error: 'Sesi ujian tidak valid.' });

        db.get('SELECT * FROM exam_sessions WHERE participant_id::text = $1 AND exam_id::text = $2', [participantId, examId], (err, session) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            if (session) {
                const now = new Date();
                const endTime = new Date(session.end_time);

                if (session.status === 'finished') {
                    if (!exam.show_result) {
                        return res.json({ success: true, isFinished: true, resultAvailable: false, exam: { id: examId, title: exam.title } });
                    }
                    return calculateSessionScore(session.id, session.exam_id)
                        .then(({ totalScore, detailedScores, isPassed, pgMap, scoreMode }) => {
                            res.json({
                                success: true,
                                isFinished: true,
                                resultAvailable: true,
                                exam: { id: examId, title: exam.title },
                                scores: {
                                    total: totalScore,
                                    isPassed: !!isPassed,
                                    passingGrades: pgMap,
                                    scoreMode,
                                    detailed: detailedScores
                                }
                            });
                        })
                        .catch(() => res.status(500).json({ error: 'Finalize error.' }));
                }

                let timeRemaining;
                if (session.is_suspended) {
                    timeRemaining = session.remaining_seconds_at_pause || 0;
                } else {
                    timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
                }

                if (!session.is_suspended && timeRemaining <= 0) {
                    return calculateSessionScore(session.id, session.exam_id).then(({ totalScore, detailedScores, isPassed, pgMap, scoreMode }) => {
                        db.run(`UPDATE exam_sessions SET status = 'finished', final_score_total = $1, category_scores = $2, is_passed = $3 WHERE id::text = $4`, [totalScore, JSON.stringify(detailedScores), isPassed ? 1 : 0, session.id]);
                        if (!exam.show_result) {
                            return res.json({ success: true, isFinished: true, resultAvailable: false, exam: { id: examId, title: exam.title } });
                        }
                        res.json({
                            success: true,
                            isFinished: true,
                            resultAvailable: true,
                            exam: { id: examId, title: exam.title },
                            scores: {
                                total: totalScore,
                                isPassed: !!isPassed,
                                passingGrades: pgMap,
                                scoreMode,
                                detailed: detailedScores
                            }
                        });
                    }).catch(() => res.status(500).json({ error: 'Finalize error.' }));
                }

                return serveQuestions(session.id, timeRemaining, examId, session.is_suspended, res);
            }

            const newId = crypto.randomUUID();
            const now = new Date();
            const totalMinutes = Number(duration) || 90;
            const endTime = new Date(now.getTime() + totalMinutes * 60000);
            db.run(`INSERT INTO exam_sessions (id, participant_id, exam_id, start_time, end_time) VALUES ($1, $2, $3, $4, $5)`,
                [newId, participantId, examId, now.toISOString(), endTime.toISOString()], function (err) {
                    if (err) return res.status(500).json({ error: 'Registrasi gagal.' });
                    serveQuestions(newId, totalMinutes * 60, examId, 0, res);
                });
        });
    });
});

router.post('/exam/status/sync', authenticate, (req, res) => {
    const { participantId } = req.user;
    const { sessionId, isSuspended, fsViolations, tabViolations } = req.body;

    db.get('SELECT * FROM exam_sessions WHERE id::text = $1 AND participant_id::text = $2', [sessionId, participantId], (err, session) => {
        if (err || !session || session.status === 'finished') return res.status(403).json({ error: 'Sesi tidak valid.' });

        // ALWAYS update violations if provided
        if (fsViolations !== undefined || tabViolations !== undefined) {
            const nextFsViolations = fsViolations ?? session.fs_violations ?? 0;
            const nextTabViolations = tabViolations ?? session.tab_violations ?? 0;
            db.run('UPDATE exam_sessions SET fs_violations = $1, tab_violations = $2 WHERE id::text = $3',
                [nextFsViolations, nextTabViolations, sessionId]);
        }

        const now = new Date();
        const endTime = new Date(session.end_time);
        const currentRemaining = Math.max(0, Math.floor((endTime - now) / 1000));

        if (isSuspended) {
            // PAUSING: Store current remaining seconds
            db.run('UPDATE exam_sessions SET is_suspended = 1, remaining_seconds_at_pause = $1 WHERE id::text = $2',
                [currentRemaining, sessionId], function (err) {
                    if (err) return res.status(500).json({ error: 'Gagal pause.' });
                    req.app.get('io').to('admin_dashboard').emit('admin_update');
                    res.json({ success: true, isSuspended: true });
                });
        } else {
            // RESUMING: Recalculate end_time based on stored remaining seconds
            const storedRemaining = session.remaining_seconds_at_pause || currentRemaining;
            const newEndTime = new Date(now.getTime() + (storedRemaining * 1000));

            db.run('UPDATE exam_sessions SET is_suspended = 0, end_time = $1 WHERE id::text = $2',
                [newEndTime.toISOString(), sessionId], function (err) {
                    if (err) return res.status(500).json({ error: 'Gagal resume.' });
                    req.app.get('io').to('admin_dashboard').emit('admin_update');
                    res.json({ success: true, isSuspended: false, newEndTime: newEndTime.toISOString() });
                });
        }
    });
});

router.post('/exam/answer', authenticate, (req, res) => {
    const { participantId } = req.user;
    const { sessionId, questionId, selectedOptionId, isDoubt } = req.body;
    db.get('SELECT * FROM exam_sessions WHERE id::text = $1 AND participant_id::text = $2', [sessionId, participantId], (err, session) => {
        if (err || !session || session.status === 'finished') return res.status(403).json({ error: 'Akses ditolak.' });
        db.get('SELECT options FROM questions WHERE id::text = $1', [questionId], (err, q) => {
            if (err || !q) return res.status(500).json({ error: 'Soal tidak ditemukan.' });
            const opts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || []);
            const maxScore = Math.max(...opts.map(o => o.score || 0), 1);
            const chosen = opts.find(o => o.id === selectedOptionId);
            const isCorrect = chosen && chosen.score === maxScore && maxScore > 0 ? true : false;
            db.run(`INSERT INTO answers (id, session_id, question_id, selected_option_id, is_correct, is_doubt) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT(session_id, question_id) DO UPDATE SET selected_option_id = excluded.selected_option_id, is_correct = excluded.is_correct, is_doubt = excluded.is_doubt, updated_at = CURRENT_TIMESTAMP`,
                [crypto.randomUUID(), sessionId, questionId, selectedOptionId, isCorrect ? 1 : 0, isDoubt ? 1 : 0], function (err) {
                    if (err) return res.status(500).json({ error: 'Save failed.' });

                    const io = req.app.get('io');

                    // Background scoring to keep Admin Monitor Live (No blocking the participant)
                    calculateSessionScore(sessionId, session.exam_id).then(({ totalScore, detailedScores, isPassed, answeredCount }) => {
                        db.run('UPDATE exam_sessions SET final_score_total = $1, category_scores = $2, is_passed = $3 WHERE id::text = $4',
                            [totalScore, JSON.stringify(detailedScores), isPassed ? 1 : 0, sessionId],
                            () => {
                                // Emit update with FULL score data
                                io.to('admin_dashboard').emit('dashboard_update', {
                                    type: 'ANSWER_UPDATE',
                                    participantId,
                                    questionId,
                                    selectedOptionId,
                                    isDoubt,
                                    score: totalScore,
                                    answered_count: answeredCount,
                                    detailedScores
                                });
                            }
                        );
                    }).catch(console.error);

                    res.json({ success: true });
                });
        });
    });
});

router.post('/exam/submit', authenticate, (req, res) => {
    const { participantId } = req.user;
    const { sessionId } = req.body;
    db.get('SELECT * FROM exam_sessions WHERE id::text = $1 AND participant_id::text = $2', [sessionId, participantId], (err, session) => {
        if (err || !session) return res.status(403).json({ error: 'Akses ditolak.' });
        db.get('SELECT title, show_result FROM exams WHERE id::text = $1', [session.exam_id], (errExam, exam) => {
            if (errExam || !exam) return res.status(500).json({ error: 'Sesi ujian tidak valid.' });

            if (session.status === 'finished') {
                if (!exam.show_result) {
                    return res.json({ success: true, resultAvailable: false, exam: { id: session.exam_id, title: exam.title } });
                }
                return calculateSessionScore(session.id, session.exam_id)
                    .then(({ totalScore, detailedScores, isPassed, pgMap, scoreMode, answeredCount }) => {
                        res.json({
                            success: true,
                            resultAvailable: true,
                            exam: { id: session.exam_id, title: exam.title },
                            scores: {
                                total: totalScore,
                                answered_count: answeredCount,
                                isPassed: !!isPassed,
                                passingGrades: pgMap,
                                scoreMode,
                                detailed: detailedScores
                            }
                        });
                    })
                    .catch(e => res.status(500).json({ error: e.message }));
            }

            calculateSessionScore(sessionId, session.exam_id).then(({ totalScore, detailedScores, isPassed, pgMap, scoreMode, answeredCount }) => {
                db.run(`UPDATE exam_sessions SET status = 'finished', final_score_total = $1, category_scores = $2, is_passed = $3 WHERE id::text = $4`, [totalScore, JSON.stringify(detailedScores), isPassed ? 1 : 0, sessionId], (err) => {
                    if (err) return res.status(500).json({ error: 'Submit failed.' });
                    req.app.get('io').to('admin_dashboard').emit('admin_update', { type: 'SESSION_FINISHED', participantId });
                    if (!exam.show_result) {
                        return res.json({ success: true, resultAvailable: false, exam: { id: session.exam_id, title: exam.title } });
                    }
                    res.json({
                        success: true,
                        resultAvailable: true,
                        exam: { id: session.exam_id, title: exam.title },
                        scores: {
                            total: totalScore,
                            answered_count: answeredCount,
                            isPassed: !!isPassed,
                            passingGrades: pgMap,
                            scoreMode,
                            detailed: detailedScores
                        }
                    });
                });
            }).catch(e => res.status(500).json({ error: e.message }));
        });
    });
});

router.get('/exam/time-sync/:sessionId', authenticate, (req, res) => {
    db.get(`
        SELECT s.end_time, s.status, s.is_suspended, s.remaining_seconds_at_pause, e.show_result
        FROM exam_sessions s
        JOIN exams e ON s.exam_id::text = e.id::text
        WHERE s.id::text = $1 AND s.participant_id::text = $2
    `, [req.params.sessionId, req.user.participantId], (err, session) => {
        if (err || !session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
        const now = new Date();
        let remaining;
        if (session.is_suspended) {
            remaining = session.remaining_seconds_at_pause || 0;
        } else {
            remaining = Math.max(0, Math.floor((new Date(session.end_time) - now) / 1000));
        }
        res.json({
            timeRemaining: remaining,
            serverTime: now.toISOString(),
            status: session.status,
            isSuspended: !!session.is_suspended,
            resultAvailable: session.status === 'finished' ? !!session.show_result : undefined
        });
    });
});

module.exports = router;
