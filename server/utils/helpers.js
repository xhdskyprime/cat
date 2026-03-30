const crypto = require('crypto');
const db = require('../db');
const bcrypt = require('bcryptjs');

// Password Utils
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
    // Fallback for plain text passwords in transition (unsecured but prevents total lockout)
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
        return password === hash;
    }
    return await bcrypt.compare(password, hash);
};

// Helper untuk Shuffle Deterministic
const deterministicShuffle = (array, seed) => {
    let m = array.length, t, i;
    let seedNum = 5381;
    for (let j = 0; j < seed.length; j++) {
        seedNum = (seedNum * 33) ^ seed.charCodeAt(j);
    }
    const random = () => {
        seedNum = (seedNum * 1103515245 + 12345) & 0x7fffffff;
        return seedNum / 0x7fffffff;
    }
    while (m) {
        i = Math.floor(random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
};

// Log Audit Actions
const logAudit = (adminId, action, targetType, targetId, details) => {
    db.run('INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [crypto.randomUUID(), adminId, action, targetType, targetId, JSON.stringify(details || {})]
    );
};

// Cache for Shared Data (to speed up high-frequency calculations)
const cache = {
    exams: new Map(),
    categories: null,
    questionCounts: new Map(), // examId -> counts
    lastUpdate: 0
};

const getCachedCategories = () => {
    return new Promise((resolve) => {
        if (cache.categories && (Date.now() - cache.lastUpdate < 30000)) {
            return resolve(cache.categories);
        }
        db.all('SELECT id, passing_grade, full_score FROM categories', [], (err, rows) => {
            if (!err) {
                cache.categories = rows;
                cache.lastUpdate = Date.now();
            }
            resolve(rows || []);
        });
    });
};

const getCachedExam = (examId) => {
    return new Promise((resolve) => {
        const cached = cache.exams.get(examId);
        if (cached && (Date.now() - cached.time < 30000)) {
            return resolve(cached.data);
        }
        db.get('SELECT config FROM exams WHERE id = $1', [examId], (err, row) => {
            if (!err && row) {
                cache.exams.set(examId, { data: row, time: Date.now() });
            }
            resolve(row);
        });
    });
};

const calculateSessionScore = (sessionId, examId) => {
    return new Promise((resolve, reject) => {
        (async () => {
            const records = await new Promise((res, rej) => {
                db.all(`
                    SELECT q.category, a.selected_option_id, q.options 
                    FROM answers a
                    JOIN questions q ON a.question_id = q.id 
                    WHERE a.session_id = $1
                `, [sessionId], (err, rows) => err ? rej(err) : res(rows));
            });
            const exam = await getCachedExam(examId);
            if (!exam) return reject(new Error('Gagal memuat konfigurasi ujian.'));
            const config = JSON.parse(exam.config || '{}');

            // Get counts (Cached by examId)
            let questionCounts = cache.questionCounts.get(examId);
            if (!questionCounts || (Date.now() - cache.lastUpdate > 60000)) {
                const counts = await new Promise((res, rej) => {
                    db.all('SELECT category, COUNT(*) as count FROM questions WHERE exam_id = $1 GROUP BY category', [examId], (err, rows) => err ? rej(err) : res(rows));
                });
                questionCounts = {};
                counts.forEach(c => {
                    const catConfig = config[c.category];
                    const count = typeof catConfig === 'object' ? Number(catConfig.count) : Number(catConfig);
                    questionCounts[c.category] = count || c.count;
                });
                cache.questionCounts.set(examId, questionCounts);
            }

            const categoriesRows = await getCachedCategories();
            const catRuleMap = {};
            const pgMap = {};
            categoriesRows.forEach(c => {
                catRuleMap[c.id] = { ...c };
                pgMap[c.id] = c.passing_grade;

                if (config[c.id] && typeof config[c.id] === 'object') {
                    if (config[c.id].pass !== undefined) pgMap[c.id] = config[c.id].pass;
                    if (config[c.id].full !== undefined) catRuleMap[c.id].full_score = config[c.id].full;
                }
            });

            const detailedScores = {};
            let totalScore = 0;
            let isPassed = 1;
            const scoreMode = config.score_mode || 'category';

            Object.keys(questionCounts).forEach(cat => detailedScores[cat] = 0);

            if (scoreMode === 'total') {
                const totalQuestionsInSession = Object.values(questionCounts).reduce((a, b) => a + b, 0) || 1;
                const totalFullScore = Number(config.total_full) || 100;
                const totalPassGrade = Number(config.total_pass) || 0;
                const weightPerQuestion = totalFullScore / totalQuestionsInSession;

                records.forEach(ans => {
                    const options = JSON.parse(ans.options);
                    const chosen = options.find(o => o.id === ans.selected_option_id);
                    if (chosen) {
                        const maxPtsInQuestion = Math.max(...options.map(o => Number(o.score) || 0), 1);
                        const calculatedPoints = (Number(chosen.score) / maxPtsInQuestion) * weightPerQuestion;
                        detailedScores[ans.category] += calculatedPoints;
                    }
                });

                Object.keys(detailedScores).forEach(cat => {
                    detailedScores[cat] = Math.round(detailedScores[cat] * 100) / 100;
                    totalScore += detailedScores[cat];
                });
                totalScore = Math.round(totalScore * 100) / 100;
                isPassed = totalScore >= totalPassGrade ? 1 : 0;
                resolve({ totalScore, detailedScores, isPassed, pgMap: { TOTAL: totalPassGrade }, scoreMode });
            } else {
                records.forEach(ans => {
                    const cat = ans.category;
                    const options = JSON.parse(ans.options);
                    const chosen = options.find(o => o.id === ans.selected_option_id);

                    const rule = catRuleMap[cat] || { full_score: 100 };
                    const totalQuestions = questionCounts[cat] || 1;
                    const weightPerQuestion = rule.full_score / totalQuestions;

                    if (chosen) {
                        const maxPtsInQuestion = Math.max(...options.map(o => Number(o.score) || 0), 1);
                        const calculatedPoints = (Number(chosen.score) / maxPtsInQuestion) * weightPerQuestion;
                        detailedScores[cat] += calculatedPoints;
                    }
                });

                Object.keys(detailedScores).forEach(cat => {
                    detailedScores[cat] = Math.round(detailedScores[cat] * 100) / 100;
                    totalScore += detailedScores[cat];
                });
                totalScore = Math.round(totalScore * 100) / 100;
                Object.keys(detailedScores).forEach(cat => {
                    if (detailedScores[cat] < (pgMap[cat] || 0)) isPassed = 0;
                });
                resolve({ totalScore, detailedScores, isPassed, pgMap, scoreMode });
            }
        })().catch((err) => {
            console.error('[Score] CRITICAL ERROR:', err);
            reject(err);
        });
    });
};

// Reconstruct exact questions given to a session
const reconstructQuestions = (sessionId, examId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT config FROM exams WHERE id = $1', [examId], (err, exam) => {
            if (err || !exam) return reject(new Error('Gagal memuat konfigurasi ujian.'));
            const config = JSON.parse(exam.config || '{}');

            db.all('SELECT id, is_random FROM categories', [], (err, categories) => {
                if (err) return reject(new Error('Gagal memuat aturan kategori.'));

                const randomMap = {};
                categories.forEach(c => randomMap[c.id] = c.is_random);

                db.all('SELECT * FROM questions', [], (err, allQuestions) => {
                    if (err) return reject(new Error('Gagal memuat bank soal.'));

                    const grouped = {};
                    allQuestions.forEach(q => {
                        if (!grouped[q.category]) grouped[q.category] = [];
                        grouped[q.category].push(q);
                    });

                    let finalQuestions = [];
                    Object.keys(grouped).forEach(cat => {
                        let catQuestions = grouped[cat];
                        if (randomMap[cat] !== 0) {
                            catQuestions = deterministicShuffle([...catQuestions], sessionId + cat);
                        }
                        const catConfig = config[cat];
                        const limit = typeof catConfig === 'object' ? Number(catConfig.count) : Number(catConfig);
                        if (limit > 0) catQuestions = catQuestions.slice(0, limit);
                        finalQuestions = finalQuestions.concat(catQuestions);
                    });

                    finalQuestions = deterministicShuffle(finalQuestions, sessionId + 'global');

                    const formattedQuestions = finalQuestions.map(q => ({
                        id: q.id,
                        category: q.category,
                        question: q.content,
                        image_url: q.image_url,
                        audio_url: q.audio_url,
                        options: deterministicShuffle(JSON.parse(q.options), sessionId + q.id)
                    }));

                    resolve(formattedQuestions);
                });
            });
        });
    });
};

// Serve Questions Logic
const serveQuestions = (sessionId, timeRemainingSeconds, examId, isSuspended, res) => {
    reconstructQuestions(sessionId, examId)
        .then(formattedQuestions => {
            db.all('SELECT question_id, selected_option_id, is_doubt FROM answers WHERE session_id = $1', [sessionId], (err, savedAnswers) => {
                if (err) return res.status(500).json({ error: 'Gagal memuat riwayat jawaban.' });

                const safeQuestions = (formattedQuestions || []).map(q => ({
                    ...q,
                    options: (q.options || []).map(o => ({ id: o.id, text: o.text }))
                }));

                res.json({
                    sessionId: sessionId,
                    examId: examId,
                    questions: safeQuestions,
                    savedAnswers: savedAnswers || [],
                    timeRemaining: timeRemainingSeconds,
                    isSuspended: !!isSuspended
                });
            });
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        });
};

module.exports = {
    deterministicShuffle,
    logAudit,
    calculateSessionScore,
    serveQuestions,
    reconstructQuestions,
    hashPassword,
    comparePassword
};
