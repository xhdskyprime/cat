import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin, AdminProvider } from '../context/AdminContext';
import { getTheme, Button, Icons, AdminModal, Badge, Card, ConfirmModal } from '../components/admin/ui/AdminUI';
import MonitoringTab from '../components/admin/tabs/MonitoringTab';
import { exportBeritaAcara } from '../utils/pdfExport';
import axios from 'axios';

const API = `${import.meta.env.VITE_API_URL}/api/admin`;

export default function LiveMonitoringWrapper() {
    const navigate = useNavigate();
    const token = localStorage.getItem('admin_token');

    useEffect(() => {
        if (!token) {
            navigate('/admin-login');
        }
    }, [token, navigate]);

    const adminHeaders = useCallback(() => {
        const t = localStorage.getItem('admin_token');
        if (!t) return {};
        return { Authorization: `Bearer ${t}` };
    }, []);

    const showToast = (msg, type = 'success') => {
        console.log(`Toast: ${msg} (${type})`);
    };

    if (!token) return null;

    return (
        <AdminProvider API={API} adminHeaders={adminHeaders} showToast={showToast}>
            <LiveMonitoringPage />
        </AdminProvider>
    );
}

function LiveMonitoringPage() {
    const {
        theme: mode,
        fetchData,
        showToast,
        API,
        adminHeaders,
        loading,
        liveSessions,
        exams,
        participants,
        sendBroadcast
    } = useAdmin();
    const theme = getTheme(mode);
    const navigate = useNavigate();
    const [modal, setModal] = useState(null);
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [addTimeModal, setAddTimeModal] = useState({ isOpen: false, sessionId: null, minutes: 10, loading: false });
    const [selectedExamId, setSelectedExamId] = useState(localStorage.getItem('live_monitor_exam_id') || '');

    const selectedExam = selectedExamId ? exams.find(e => e.id === selectedExamId) : null;
    const scopedParticipants = selectedExamId ? participants.filter(p => p.exam_id === selectedExamId) : participants;
    const participantExamIdByParticipantId = useCallback(() => {
        const map = new Map();
        if (!Array.isArray(participants)) return map;
        participants.forEach(p => {
            if (p?.id) map.set(p.id, p.exam_id || null);
        });
        return map;
    }, [participants]);

    const scopedLiveSessions = selectedExamId
        ? liveSessions.filter(s => {
            const resolvedExamId = s.exam_id ?? participantExamIdByParticipantId().get(s.participant_id) ?? null;
            return resolvedExamId === selectedExamId;
        })
        : liveSessions;

    // Command Center Handlers
    const handlePause = async (sid) => {
        try {
            await axios.post(`${API}/sessions/${sid}/pause`, {}, { headers: adminHeaders() });
            showToast('Sesi Berhasil Dihentikan Sementara');
            fetchData('monitoring', { examId: selectedExamId || undefined });
        } catch (_e) { void _e; showToast('Gagal jeda sesi', 'error'); }
    };

    const handleResume = async (sid) => {
        try {
            await axios.post(`${API}/sessions/${sid}/resume`, {}, { headers: adminHeaders() });
            showToast('Sesi Berhasil Dilanjutkan');
            fetchData('monitoring', { examId: selectedExamId || undefined });
        } catch (_e) { void _e; showToast('Gagal lanjut sesi', 'error'); }
    };

    const handleAddTime = (sid) => {
        setAddTimeModal({ isOpen: true, sessionId: sid, minutes: 10, loading: false });
    };

    const handleAddTimeConfirm = async () => {
        const { sessionId, minutes } = addTimeModal;
        if (!minutes || minutes <= 0) return;
        setAddTimeModal(s => ({ ...s, loading: true }));
        try {
            await axios.post(`${API}/sessions/${sessionId}/add-time`, { minutes: parseInt(minutes) }, { headers: adminHeaders() });
            showToast(`Waktu +${minutes} menit berhasil ditambahkan`);
            fetchData('monitoring', { examId: selectedExamId || undefined });
            setAddTimeModal({ isOpen: false, sessionId: null, minutes: 10, loading: false });
        } catch (_e) {
            void _e;
            showToast('Gagal tambah waktu', 'error');
            setAddTimeModal(s => ({ ...s, loading: false }));
        }
    };

    const handleShowSessionReview = async (session) => {
        if (!session?.session_id) return;
        try {
            const res = await axios.get(`${API}/sessions/${session.session_id}/review`, { headers: adminHeaders() });
            setModal({
                type: 'review',
                title: `Review: ${session.nama}`,
                participant: session,
                data: res.data
            });
        } catch (_err) {
            void _err;
            showToast("Gagal memuat review", "danger");
        }
    };

    useEffect(() => {
        fetchData('monitoring', { examId: selectedExamId || undefined });
        const interval = setInterval(() => fetchData('monitoring', { examId: selectedExamId || undefined, silent: true }), 5000);
        return () => clearInterval(interval);
    }, [fetchData, selectedExamId]);

    useEffect(() => {
        if (!selectedExamId && Array.isArray(exams) && exams.length > 0) {
            const active = exams.find(e => e.is_active) || exams[0];
            if (active?.id) {
                setSelectedExamId(active.id);
                localStorage.setItem('live_monitor_exam_id', active.id);
            }
        }
    }, [exams, selectedExamId]);

    return (
        <div style={{
            minHeight: '100vh',
            background: theme.isDark ? '#0a0a0f' : '#f8fafc',
            color: theme.text,
            padding: '1.5rem',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            position: 'relative',
            overflowX: 'hidden'
        }}>
            {/* Background Glows */}
            <div style={{
                position: 'fixed', top: '-10%', left: '-10%', width: '40%', height: '40%',
                background: `${theme.primary}15`, filter: 'blur(120px)', borderRadius: '50%', zIndex: 0
            }} />
            <div style={{
                position: 'fixed', bottom: '-20%', right: '-10%', width: '50%', height: '50%',
                background: `${theme.secondary}10`, filter: 'blur(150px)', borderRadius: '50%', zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header Section */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    background: theme.surface + '80',
                    padding: '1.25rem 2rem',
                    borderRadius: '24px',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{
                            width: '48px', height: '48px', background: theme.gradPrimary,
                            borderRadius: '16px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: 'white', fontSize: '1.5rem',
                            boxShadow: `0 0 20px ${theme.primary}40`
                        }}>
                            <Icons.Activity />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>COMMAND CENTER</h1>
                                <Badge type="success" style={{ padding: '4px 12px', borderRadius: '100px', fontWeight: 800, animation: 'pulse-soft 2s infinite' }}>
                                    <span style={{ marginRight: '6px' }}>●</span> LIVE
                                </Badge>
                            </div>
                            <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '0.85rem', fontWeight: 500 }}>
                                Memantau {scopedLiveSessions.filter(s => s.status === 'ongoing').length} Peserta Aktif{selectedExam ? ` · ${selectedExam.title}` : ''}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '1rem', borderRight: `1px solid ${theme.border}`, paddingRight: '1rem' }}>
                            <div style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Link Peserta</div>
                            <div style={{ fontSize: '0.85rem', color: theme.primary, fontWeight: 600, fontFamily: 'monospace' }}>{window.location.origin}/login</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 280 }}>
                            <div style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Sesi Dipantau</div>
                            <select
                                value={selectedExamId}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setSelectedExamId(next);
                                    localStorage.setItem('live_monitor_exam_id', next);
                                }}
                                style={{
                                    background: theme.surfaceLight,
                                    border: `1px solid ${theme.border}`,
                                    color: theme.text,
                                    borderRadius: '12px',
                                    padding: '0.55rem 0.8rem',
                                    outline: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.85rem'
                                }}
                            >
                                <option value="">Semua Sesi</option>
                                {exams.map(ex => (
                                    <option key={ex.id} value={ex.id}>
                                        {ex.title} {ex.is_active ? '(Aktif)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Button variant="ghost" onClick={() => setShowBroadcast(true)} style={{ borderRadius: '12px', padding: '0.6rem 1.25rem' }}>
                            <Icons.Activity style={{ marginRight: '8px', width: 16 }} /> Siar
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                const activeExam = selectedExam || exams.find(e => e.is_active);
                                const stats = {
                                    totalParticipants: scopedParticipants.length,
                                    finishedCount: liveSessions.filter(s => s.status === 'finished').length,
                                    passedCount: liveSessions.filter(s => s.is_passed).length
                                };
                                exportBeritaAcara(activeExam || { title: 'Ujian CAT' }, stats);
                            }}
                            style={{ borderRadius: '12px', padding: '0.6rem 1.25rem' }}
                        >
                            📋 Laporan
                        </Button>
                        <Button variant="outline" onClick={() => fetchData('monitoring', { examId: selectedExamId || undefined })} style={{ borderRadius: '12px', padding: '0.6rem 1.25rem' }}>
                            <Icons.RefreshCw className={loading ? 'spin' : ''} style={{ marginRight: '8px', width: 16 }} />
                        </Button>
                        <Button variant="primary" onClick={() => navigate('/admin')} style={{ borderRadius: '12px', padding: '0.6rem 1.25rem' }}>
                            <Icons.Dashboard style={{ marginRight: '8px', width: 16 }} />
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="animate-fade-in">
                    <MonitoringTab
                        setModal={setModal}
                        examId={selectedExamId || undefined}
                        handleShowSessionReview={handleShowSessionReview}
                        handlePause={handlePause}
                        handleResume={handleResume}
                        handleAddTime={handleAddTime}
                    />
                </div>
            </div>

            {/* Local Modal for Review & Broadcast */}
            {modal && (
                <AdminModal
                    isOpen={!!modal}
                    onClose={() => setModal(null)}
                    title={modal.title}
                    maxWidth="1000px"
                >
                    {modal.type === 'review' && (
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Card style={{ flex: 1, padding: '1.25rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Skor</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: theme.primary }}>{modal.participant.final_score_total}</div>
                                </Card>
                                <Card style={{ flex: 1, padding: '1.25rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Status Kelulusan</div>
                                    <Badge type={modal.participant.is_passed ? 'success' : 'danger'} style={{ fontSize: '1rem', padding: '0.5rem 1.5rem', borderRadius: '12px' }}>
                                        {modal.participant.is_passed ? 'LULUS' : 'TIDAK LULUS'}
                                    </Badge>
                                </Card>
                            </div>

                            <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'grid', gap: '1rem', paddingRight: '0.5rem' }}>
                                {modal.data?.map((q, idx) => (
                                    <div key={idx} style={{
                                        padding: '1.25rem',
                                        background: theme.surfaceLight,
                                        borderRadius: '16px',
                                        border: `1px solid ${theme.border}`,
                                        transition: 'transform 0.2s',
                                    }} className="card-hover">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <Badge type="info" style={{ opacity: 0.8 }}>{q.category}</Badge>
                                            <span style={{ fontSize: '0.8rem', color: theme.textMuted }}>No. {idx + 1}</span>
                                        </div>
                                        <div style={{ fontWeight: 600, color: theme.text, marginBottom: '1rem', lineHeight: 1.5 }}>
                                            {idx + 1}. {q.question_text}
                                        </div>
                                        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                                            {(q.question_options || []).map(opt => {
                                                const isSelected = opt.id === q.selected_option_id;
                                                const maxScore = Math.max(...(q.question_options || []).map(o => o.score || 0), 1);
                                                const isRight = opt.score === maxScore && maxScore > 0;
                                                
                                                return (
                                                    <div key={opt.id} style={{
                                                        padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem',
                                                        background: isSelected ? (isRight ? theme.success + '15' : theme.danger + '15') : (isRight ? theme.success + '08' : 'transparent'),
                                                        border: `1px solid ${isSelected ? (isRight ? theme.success : theme.danger) + '30' : (isRight ? theme.success + '30' : theme.border + '40')}`,
                                                        color: isSelected ? (isRight ? theme.success : theme.danger) : (isRight ? theme.success : theme.textMuted),
                                                        display: 'flex', gap: '0.5rem', alignItems: 'center'
                                                    }}>
                                                        <strong style={{ minWidth: '1.2rem' }}>{opt.id}.</strong>
                                                        <span style={{ flex: 1 }}>{opt.text}</span>
                                                        {isSelected && (isRight ? ' ✓' : ' ✗')}
                                                        {!isSelected && isRight && q.selected_option_id && <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>(Benar)</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {!q.selected_option_id && (
                                            <div style={{ padding: '0.75rem', borderRadius: '10px', background: theme.danger + '10', border: `1px solid ${theme.danger}20`, color: theme.danger, fontSize: '0.8rem', textAlign: 'center', fontWeight: 600 }}>
                                                TIDAK DIJAWAB
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </AdminModal>
            )}

            <AdminModal
                isOpen={showBroadcast}
                onClose={() => setShowBroadcast(false)}
                title="Siarkan Pesan Ke Peserta"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setShowBroadcast(false)}>Batal</Button>
                        <Button
                            variant="primary"
                            disabled={!broadcastMsg.trim()}
                            onClick={() => {
                                sendBroadcast({ examId: selectedExamId || undefined, message: broadcastMsg });
                                setBroadcastMsg('');
                                setShowBroadcast(false);
                            }}
                        >
                            Kirim Sekarang
                        </Button>
                    </>
                )}
            >
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: theme.textMuted, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Pesan Pengumuman
                    </label>
                    <textarea
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        placeholder="Contoh: Waktu pengerjaan tersisa 5 menit lagi. Harap periksa kembali jawaban Anda."
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            background: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '16px',
                            padding: '1rem',
                            color: theme.text,
                            fontSize: '1rem',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '0.4rem' }}>
                        Pesan ini akan muncul seketika di layar semua peserta yang sedang ujian.
                    </div>
                </div>
            </AdminModal>

            {/* ── ADD TIME MODAL ─────────────── */}
            {addTimeModal.isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(10px)', zIndex: 1001,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }} onClick={() => setAddTimeModal(s => ({ ...s, isOpen: false }))}>
                    <div style={{
                        background: theme.surface, border: `1px solid ${theme.border}`,
                        borderRadius: '24px', width: '100%', maxWidth: '420px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ fontSize: '1.5rem' }}>⏱️</div>
                                <h3 style={{ margin: 0, color: theme.text, fontSize: '1.15rem', fontWeight: 700 }}>Tambah Waktu Ujian</h3>
                            </div>
                            <button onClick={() => setAddTimeModal(s => ({ ...s, isOpen: false }))}
                                style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                        </div>
                        <div style={{ padding: '2rem' }}>
                            <p style={{ color: theme.textMuted, fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                Masukkan tambahan waktu dalam menit. Peserta akan mendapat notifikasi otomatis.
                            </p>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    Durasi Tambahan (Menit)
                                </label>
                                <input type="number" min={1} max={999}
                                    value={addTimeModal.minutes}
                                    onChange={e => setAddTimeModal(s => ({ ...s, minutes: parseInt(e.target.value) || 1 }))}
                                    style={{
                                        width: '100%', padding: '0.875rem', fontSize: '1.5rem', fontWeight: 800,
                                        textAlign: 'center', background: theme.surfaceLight, color: theme.text,
                                        border: `2px solid ${theme.primary}`, borderRadius: '16px', outline: 'none', boxSizing: 'border-box'
                                    }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                                {[5, 10, 15, 30].map(m => (
                                    <button key={m} onClick={() => setAddTimeModal(s => ({ ...s, minutes: m }))}
                                        style={{
                                            flex: 1, padding: '0.625rem', borderRadius: '12px',
                                            background: addTimeModal.minutes === m ? theme.primary : theme.surfaceLight,
                                            color: addTimeModal.minutes === m ? 'white' : theme.textMuted,
                                            border: `1px solid ${addTimeModal.minutes === m ? theme.primary : theme.border}`,
                                            cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem'
                                        }}>+{m}m</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => setAddTimeModal(s => ({ ...s, isOpen: false }))}
                                    style={{ flex: 1, padding: '0.875rem', borderRadius: '12px', cursor: 'pointer', background: theme.surfaceLight, color: theme.textMuted, border: `1px solid ${theme.border}`, fontWeight: 600 }}>
                                    Batal
                                </button>
                                <button onClick={handleAddTimeConfirm} disabled={addTimeModal.loading}
                                    style={{
                                        flex: 2, padding: '0.875rem', borderRadius: '12px', cursor: 'pointer',
                                        background: addTimeModal.loading ? theme.textMuted : theme.primary,
                                        color: 'white', border: 'none', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                    }}>
                                    {addTimeModal.loading ? '⏳ Memproses...' : `✅ Tambah ${addTimeModal.minutes} Menit`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.2, 1, 0.2, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .card-hover:hover { transform: translateY(-2px); border-color: ${theme.primary}40 !important; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 10px; }
            `}</style>
        </div>
    );
}
