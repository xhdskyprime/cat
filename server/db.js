const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'cat.db');

// Inisialisasi Database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // OPTIMIZATION FOR CONCURRENCY (Support 100+ Participants)
        db.configure('busyTimeout', 5000);
        db.run('PRAGMA busy_timeout=5000');
        db.run('PRAGMA journal_mode=WAL');
        db.run('PRAGMA synchronous=NORMAL');
        db.run('PRAGMA cache_size=-64000'); // 64MB Cache
        db.run('PRAGMA temp_store=MEMORY');
        createTables();
    }
});

// Fungsi Membuat Tabel jika belum ada
function createTables() {
    db.serialize(() => {
        // 0. Admins (RBAC)
        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'pengawas', 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.all("SELECT id FROM admins LIMIT 1", (err, rows) => {
            if (!err && rows.length === 0) {
                const defaultPass = process.env.ADMIN_PASSWORD || 'admin123';
                const crypto = require('crypto');
                const bcrypt = require('bcryptjs');
                const hashedPass = bcrypt.hashSync(defaultPass, 10);
                db.run("INSERT INTO admins (id, username, password_hash, role) VALUES (?, ?, ?, ?)", [crypto.randomUUID(), 'admin', hashedPass, 'superadmin']);
                console.log('Migrated admins: Seeded default superadmin');
            }
        });

        // 1. Peserta & Mapping Sesi
        db.run(`CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            nik TEXT UNIQUE NOT NULL,
            nomor_peserta TEXT UNIQUE NOT NULL,
            nama TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            exam_id TEXT, -- Mapping Sesi (Peserta terdaftar di ujian mana)
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (exam_id) REFERENCES exams (id)
        )`);

        // Migration: Tambahkan exam_id ke participants jika belum ada (antisipasi db lama)
        db.all("PRAGMA table_info(participants)", (err, rows) => {
            if (!err && rows && !rows.find(r => r.name === 'exam_id')) {
                db.run("ALTER TABLE participants ADD COLUMN exam_id TEXT");
                console.log('Migrated participants: added exam_id column');
            }
        });

        db.serialize(() => {
            // 1.1 Master Data Kategori
            db.run(`CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                passing_grade INTEGER DEFAULT 0,
                full_score INTEGER DEFAULT 100, 
                is_random INTEGER DEFAULT 1, 
                sort_order INTEGER DEFAULT 0
            )`);

            // Migration Categories
            db.all("PRAGMA table_info(categories)", (err, rows) => {
                if (err || !rows) return;
                if (!rows.find(r => r.name === 'full_score')) {
                    db.run("ALTER TABLE categories ADD COLUMN full_score INTEGER DEFAULT 100");
                    console.log('Migrated categories: added full_score column');
                }
                if (!rows.find(r => r.name === 'is_random')) {
                    db.run("ALTER TABLE categories ADD COLUMN is_random INTEGER DEFAULT 1");
                    console.log('Migrated categories: added is_random column');
                }
            });

            // 2. Ujian Tersedia
            db.run(`CREATE TABLE IF NOT EXISTS exams (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                duration_minutes INTEGER NOT NULL DEFAULT 90,
                token TEXT NOT NULL,
                config TEXT, 
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Migration Exams
            db.all("PRAGMA table_info(exams)", (err, rows) => {
                if (err || !rows) return;
                if (!rows.find(r => r.name === 'config')) {
                    db.run("ALTER TABLE exams ADD COLUMN config TEXT");
                    console.log('Migrated exams: added config column');
                }
                if (!rows.find(r => r.name === 'schedule_start')) {
                    db.run("ALTER TABLE exams ADD COLUMN schedule_start DATETIME");
                    console.log('Migrated exams: added schedule_start column');
                }
                if (!rows.find(r => r.name === 'schedule_end')) {
                    db.run("ALTER TABLE exams ADD COLUMN schedule_end DATETIME");
                    console.log('Migrated exams: added schedule_end column');
                }
                if (!rows.find(r => r.name === 'show_result')) {
                    db.run("ALTER TABLE exams ADD COLUMN show_result INTEGER DEFAULT 1");
                    console.log('Migrated exams: added show_result column');
                }
                if (!rows.find(r => r.name === 'allow_review')) {
                    db.run("ALTER TABLE exams ADD COLUMN allow_review INTEGER DEFAULT 0");
                    console.log('Migrated exams: added allow_review column');
                }
                if (!rows.find(r => r.name === 'max_attempts')) {
                    db.run("ALTER TABLE exams ADD COLUMN max_attempts INTEGER DEFAULT 1");
                    console.log('Migrated exams: added max_attempts column');
                }
            });
        });

        // 3. Bank Soal
        db.run(`CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            exam_id TEXT,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            options TEXT NOT NULL, -- JSON String
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (exam_id) REFERENCES exams (id)
        )`);

        // Migration: Tambahkan exam_id, image_url, audio_url ke questions jika belum ada
        db.all("PRAGMA table_info(questions)", (err, rows) => {
            if (!err && rows) {
                if (!rows.find(r => r.name === 'exam_id')) {
                    db.run("ALTER TABLE questions ADD COLUMN exam_id TEXT");
                    console.log('Migrated questions: added exam_id column');
                }
                if (!rows.find(r => r.name === 'image_url')) {
                    db.run("ALTER TABLE questions ADD COLUMN image_url TEXT");
                    db.run("ALTER TABLE questions ADD COLUMN audio_url TEXT");
                    console.log('Migrated questions: added image_url & audio_url columns');
                }
            }
        });

        // 4. Sesi Ujian (Server Realtime)
        db.run(`CREATE TABLE IF NOT EXISTS exam_sessions (
            id TEXT PRIMARY KEY,
            participant_id TEXT NOT NULL,
            exam_id TEXT NOT NULL,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME NOT NULL,
            status TEXT DEFAULT 'ongoing',
            violation_count INTEGER DEFAULT 0,
            final_score_twk INTEGER DEFAULT 0,
            final_score_tiu INTEGER DEFAULT 0,
            final_score_tkp INTEGER DEFAULT 0,
            final_score_total INTEGER DEFAULT 0,
            category_scores TEXT, -- Simpan JSON skor per kategori
            is_passed INTEGER DEFAULT 0,
            last_socket_id TEXT,
            FOREIGN KEY (participant_id) REFERENCES participants (id),
            FOREIGN KEY (exam_id) REFERENCES exams (id),
            UNIQUE(participant_id, exam_id)
        )`);

        // Migration: Tambahkan category_scores, is_suspended, extra_time ke exam_sessions jika belum ada
        db.all("PRAGMA table_info(exam_sessions)", (err, rows) => {
            if (!err && rows) {
                if (!rows.find(r => r.name === 'category_scores')) {
                    db.run("ALTER TABLE exam_sessions ADD COLUMN category_scores TEXT");
                    console.log('Migrated exam_sessions: added category_scores column');
                }
                if (!rows.find(r => r.name === 'is_suspended')) {
                    db.run("ALTER TABLE exam_sessions ADD COLUMN is_suspended INTEGER DEFAULT 0");
                    db.run("ALTER TABLE exam_sessions ADD COLUMN extra_time INTEGER DEFAULT 0");
                    console.log('Migrated exam_sessions: added is_suspended & extra_time columns');
                }
                if (!rows.find(r => r.name === 'remaining_seconds_at_pause')) {
                    db.run("ALTER TABLE exam_sessions ADD COLUMN remaining_seconds_at_pause INTEGER DEFAULT 0");
                    console.log('Migrated exam_sessions: added remaining_seconds_at_pause column');
                }
                if (!rows.find(r => r.name === 'fs_violations')) {
                    db.run("ALTER TABLE exam_sessions ADD COLUMN fs_violations INTEGER DEFAULT 0");
                    console.log('Migrated exam_sessions: added fs_violations column');
                }
                if (!rows.find(r => r.name === 'tab_violations')) {
                    db.run("ALTER TABLE exam_sessions ADD COLUMN tab_violations INTEGER DEFAULT 0");
                    console.log('Migrated exam_sessions: added tab_violations column');
                }
            }
        });

        // 5. Rekaman Jawaban
        db.run(`CREATE TABLE IF NOT EXISTS answers (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            selected_option_id TEXT,
            is_correct INTEGER DEFAULT 0,
            is_doubt INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES exam_sessions (id),
            FOREIGN KEY (question_id) REFERENCES questions (id),
            UNIQUE(session_id, question_id)
        )`);

        // Migration Answers
        db.all("PRAGMA table_info(answers)", (err, rows) => {
            if (err || !rows) return;
            if (!rows.find(r => r.name === 'is_correct')) {
                db.run("ALTER TABLE answers ADD COLUMN is_correct INTEGER DEFAULT 0");
                console.log('Migrated answers: added is_correct column');
            }
        });

        // 6. Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL,
            action TEXT NOT NULL, -- e.g. 'CREATE_QUESTION', 'RESET_SESSION'
            target_type TEXT, -- e.g. 'questions', 'participants'
            target_id TEXT,
            details TEXT, -- JSON String payload
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 7. System Settings
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 8. Appearance Templates
        db.run(`CREATE TABLE IF NOT EXISTS appearance_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            primary_color TEXT NOT NULL,
            secondary_color TEXT NOT NULL,
            illustration_url TEXT NOT NULL,
            headline TEXT NOT NULL,
            sub_headline TEXT NOT NULL,
            tagline TEXT NOT NULL,
            is_custom INTEGER DEFAULT 0
        )`);

        // 9. Indexes for Performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_exam_sessions_participant ON exam_sessions(participant_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions(exam_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_participants_exam ON participants(exam_id)`);

        console.log('Tables initialized correctly and indexes checked.');
        seedTemplates();
        seedDumpData();
    });
}

function seedTemplates() {
    const templates = [
        {
            id: 'education',
            name: 'Pendidikan (Generasi Juara)',
            primary: '#4f46e5',
            secondary: '#fbbf24',
            illustration: '/login_illustration.png',
            headline: 'Generasi Juara!',
            sub_headline: 'Siapkan dirimu untuk <b>asesmen hari ini.</b><br />Masuk dengan akun kamu ya.',
            tagline: 'BE READY, BE EXTRAORDINARY!'
        },
        {
            id: 'medical',
            name: 'Kesehatan (BLUD Perawat)',
            primary: '#0d9488',
            secondary: '#f59e0b',
            illustration: '/nurse_v3.png',
            headline: 'Tenaga Kesehatan Hebat!',
            sub_headline: 'Portal seleksi <b>Tenaga Kesehatan BLUD.</b><br />Siapkan kompetensi terbaikmu.',
            tagline: 'SAVE LIVES, SERVE BETTER!'
        },
        {
            id: 'recruitment',
            name: 'Rekrutmen Profesional',
            primary: '#1d4ed8',
            secondary: '#10b981',
            illustration: '/corporate_illustration.png',
            headline: 'Talenta Profesional!',
            sub_headline: 'Portal resmi rekrutmen dan seleksi <b>Pegawai Profesional.</b><br />Gunakan akun yang telah terdaftar.',
            tagline: 'WORK HARD, GROW FASTER!'
        }
    ];

    templates.forEach(t => {
        db.run(`INSERT OR IGNORE INTO appearance_templates (id, name, primary_color, secondary_color, illustration_url, headline, sub_headline, tagline) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [t.id, t.name, t.primary, t.secondary, t.illustration, t.headline, t.sub_headline, t.tagline]);
        // Also update existing rows so changes take effect on existing databases
        db.run(`UPDATE appearance_templates SET name=?, primary_color=?, secondary_color=?, illustration_url=?, headline=?, sub_headline=?, tagline=? WHERE id=? AND is_custom = 0`,
            [t.name, t.primary, t.secondary, t.illustration, t.headline, t.sub_headline, t.tagline, t.id]);
    });

    // Set default setting if not exists
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('active_template', 'medical')");
    // Explicitly transition from old default if found
    db.run("UPDATE settings SET value = 'medical' WHERE key = 'active_template' AND value = 'education'");

    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'CAT SYSTEM')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_version_label', 'v2.5')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('support_contact_text', 'Hubungi Admin')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('support_contact_url', '')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_tab_violations', '3')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('require_fullscreen', '1')");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('max_fs_violations', '3')");
}


function seedDumpData() {
    // Seed Master Data Kategori
    const categories = [
        { id: 'TWK', name: 'Tes Wawasan Kebangsaan', pg: 65, full: 150, order: 1, random: 1 },
        { id: 'TIU', name: 'Tes Intelegensia Umum', pg: 80, full: 175, order: 2, random: 1 },
        { id: 'TKP', name: 'Tes Karakteristik Pribadi', pg: 166, full: 225, order: 3, random: 1 }
    ];
    categories.forEach(c => {
        db.run('INSERT OR IGNORE INTO categories (id, name, passing_grade, full_score, is_random, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [c.id, c.name, c.pg, c.full, c.random, c.order]);
    });
    console.log('Master categories checked/seeded.');
}

module.exports = db;
