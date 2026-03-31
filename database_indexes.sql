-- =====================================================
-- PERFORMANCE INDEXES UNTUK SISTEM CAT
-- Jalankan sekali di PostgreSQL setelah schema utama
-- =====================================================

-- 1. Answers: Query paling sering (autosave setiap klik jawaban)
CREATE INDEX IF NOT EXISTS idx_answers_session_id ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);

-- 2. Exam Sessions: Lookup per peserta per ujian (login, start, monitoring)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_participant_id ON exam_sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);

-- 3. Questions: Query bank soal per ujian + kategori
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);

-- 4. Participants: Login lookup
CREATE INDEX IF NOT EXISTS idx_participants_nik ON participants(nik);
CREATE INDEX IF NOT EXISTS idx_participants_exam_id ON participants(exam_id);

-- 5. Audit Logs: Pagination query (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. Worker query: Auto-finalize expired sessions
CREATE INDEX IF NOT EXISTS idx_exam_sessions_auto_finalize 
  ON exam_sessions(status, is_suspended, end_time) 
  WHERE status = 'ongoing' AND is_suspended = FALSE;
