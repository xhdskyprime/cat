-- =====================================================
-- SQL SCHEMA LENGKAP UNTUK SISTEM UJIAN CAT
-- PostgreSQL 14+
-- =====================================================

-- 1. Tabel Master Admin (RBAC)
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'pengawas', -- 'superadmin' atau 'pengawas'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Master Jadwal Ujian
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    token VARCHAR(20) NOT NULL,
    config JSONB DEFAULT '{}',           -- Konfigurasi scoring per kategori
    is_active BOOLEAN DEFAULT true,
    show_result BOOLEAN DEFAULT true,
    allow_review BOOLEAN DEFAULT false,
    max_attempts INTEGER DEFAULT 1,
    schedule_start TIMESTAMP WITH TIME ZONE,
    schedule_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Master Peserta
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nomor_peserta VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Master Kategori Soal
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(10) PRIMARY KEY,           -- TWK, TIU, TKP, dll
    name VARCHAR(100) NOT NULL,
    passing_grade INTEGER DEFAULT 0,
    full_score INTEGER DEFAULT 100,
    is_random BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0
);

-- 5. Tabel Bank Soal
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    category VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    options JSONB NOT NULL,               -- [{id, text, score}, ...]
    image_url TEXT,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabel Sesi Ujian (Jantung Realtime)
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ongoing',         -- ongoing, finished
    is_suspended BOOLEAN DEFAULT false,
    remaining_seconds_at_pause INTEGER,
    extra_time INTEGER DEFAULT 0,
    fs_violations INTEGER DEFAULT 0,
    tab_violations INTEGER DEFAULT 0,
    last_socket_id VARCHAR(100),
    final_score_total INTEGER DEFAULT 0,
    category_scores JSONB DEFAULT '{}',
    is_passed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_id, exam_id)
);

-- 7. Tabel Jawaban (Autosave per klik)
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option_id VARCHAR(50),
    is_correct BOOLEAN DEFAULT false,
    is_doubt BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, question_id)
);

-- 8. Tabel Audit Log
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabel Settings (Key-Value)
CREATE TABLE IF NOT EXISTS public.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Tabel Appearance Templates
CREATE TABLE IF NOT EXISTS public.appearance_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    primary_color VARCHAR(20),
    secondary_color VARCHAR(20),
    illustration_url TEXT,
    headline TEXT,
    sub_headline TEXT,
    tagline TEXT,
    is_custom BOOLEAN DEFAULT false
);

-- =====================================================
-- ROW LEVEL SECURITY (Mode Development)
-- =====================================================
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Policy: Izinkan semua akses (sementara untuk development)
-- PERKETAT sebelum production!
CREATE POLICY "dev_allow_all_participants" ON public.participants FOR ALL USING (true);
CREATE POLICY "dev_allow_all_exams" ON public.exams FOR ALL USING (true);
CREATE POLICY "dev_allow_all_questions" ON public.questions FOR ALL USING (true);
CREATE POLICY "dev_allow_all_sessions" ON public.exam_sessions FOR ALL USING (true);
CREATE POLICY "dev_allow_all_answers" ON public.answers FOR ALL USING (true);
