-- SQL SCHEMA UNTUK SISTEM UJIAN CAT CPNS (SUPABASE)

-- 1. Tabel Master Peserta (Independen dari Supabase Auth, Admin yg register)
CREATE TABLE public.participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nomor_peserta VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Di-hash saat insert (dummy auth)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Master Jadwal Ujian
CREATE TABLE public.exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    token VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabel Bank Soal
CREATE TABLE public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    category VARCHAR(10) NOT NULL, -- TWK, TIU, TKP
    content TEXT NOT NULL,
    options JSONB NOT NULL, -- Format: [{"id": "a", "text": "opsi A", "score": 5}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Sesi Ujian Aktif (Jantung Realtime / Anti-Cheat)
CREATE TABLE public.exam_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL, -- Dihitung server: start_time + duration
    status VARCHAR(20) DEFAULT 'ongoing', -- 'ongoing', 'finished', 'violation'
    violation_count INTEGER DEFAULT 0,
    final_score_twk INTEGER DEFAULT 0,
    final_score_tiu INTEGER DEFAULT 0,
    final_score_tkp INTEGER DEFAULT 0,
    final_score_total INTEGER DEFAULT 0,
    is_passed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_id, exam_id) -- 1 peserta hanya 1 sesi ujian spesifik
);

-- 5. Tabel Perekaman Jawaban (Autosave per klik)
CREATE TABLE public.answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option_id VARCHAR(50),
    is_doubt BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, question_id) -- Hanya 1 jawaban aktif per soal per sesi (upsert)
);

-- EXTENSIONS & SECURITY POLICIES (RLS)

-- Aktifkan Row Level Security
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Policy Sederhana (Sementara izinkan anon/client access untuk dev offline-auth)
-- Nanti akan kita kunci menggunakan auth JWT peserta
CREATE POLICY "Allow public read exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Allow public read questions" ON public.questions FOR SELECT USING (true);

-- Izinkan Upsert Answers (Autosave)
CREATE POLICY "Allow participant to upsert answers" 
ON public.answers FOR ALL USING (true);

CREATE POLICY "Allow participant to manage sessions" 
ON public.exam_sessions FOR ALL USING (true);

CREATE POLICY "Allow participant to fetch profile" 
ON public.participants FOR SELECT USING (true);
