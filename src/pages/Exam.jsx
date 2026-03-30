import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { useAntiCheat } from '../utils/useAntiCheat';
import { Timer, AlertTriangle, Maximize, Pause, Wifi, WifiOff, MapPin, Clipboard, User, Award, CheckCircle2, MoreHorizontal, LogOut, ChevronLeft, ChevronRight, Plus, Minus, Search } from 'lucide-react';

export default function Exam() {
    const { user, API_URL } = useAuth();
    const navigate = useNavigate();
    const [publicSettings, setPublicSettings] = useState({}); // Moved up to avoid ReferenceError
    const [isStartingExam, setIsStartingExam] = useState(false);
    const [startError, setStartError] = useState('');
    const [showConfirmFinish, setShowConfirmFinish] = useState(false);

    const requireFullscreen = String(publicSettings?.require_fullscreen ?? '1') !== '0';
    const maxFsViolations = Number(publicSettings?.max_fs_violations ?? 3);
    const { violationCount, maxViolation } = useAntiCheat(publicSettings?.max_tab_violations);
    const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
    const [fsViolationCount, setFsViolationCount] = useState(0);
    const tabViolationRef = useRef(0);
    const fsViolationRef = useRef(0);
    const initialFsPenaltyAppliedRef = useRef(false);
    const {
        state, startExam, endExam,
        setAnswer, toggleDoubt, goToQuestion, nextQuestion, prevQuestion, acknowledgeMessage, syncStatus, setClientMessage
    } = useExam();

    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [fontSize, setFontSize] = useState(1.1); // rem units - default lebih besar untuk keterbacaan

    useEffect(() => {
        tabViolationRef.current = violationCount;
    }, [violationCount]);

    useEffect(() => {
        fsViolationRef.current = fsViolationCount;
    }, [fsViolationCount]);

    useEffect(() => {
        initialFsPenaltyAppliedRef.current = false;
    }, [state.sessionId]);

    // Fetch public settings (e.g., institution logo)
    useEffect(() => {
        const fetchPublicSettings = async () => {
            try {
                const response = await fetch(`${API_URL}/settings`); // Matches server route
                if (response.ok) {
                    const data = await response.json();
                    setPublicSettings(data);
                } else {
                    console.error('Failed to fetch public settings');
                }
            } catch (error) {
                console.error('Error fetching public settings:', error);
            }
        };
        fetchPublicSettings();
    }, [API_URL]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-start ujian saat masuk halaman (hanya run sekali saat mount)
    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (state.isExamStarted || state.isFinished || isStartingExam) return;

        const initExam = async () => {
            console.log('[Exam UI] initExam starting...');
            setIsStartingExam(true);
            setStartError('');

            // Safety timeout to prevent infinite loading
            const safetyTimer = setTimeout(() => {
                setIsStartingExam(false);
            }, 5000);

            const res = await startExam();
            clearTimeout(safetyTimer);

            console.log('[Exam UI] startExam result:', res);
            setIsStartingExam(false);
            if (!res?.success) {
                setStartError(res?.message || 'Gagal memulai ujian.');
                return;
            }

            // Request fullscreen setelah ujian dimulai
            if (requireFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
                try {
                    console.log('[Exam UI] Requesting fullscreen...');
                    await document.documentElement.requestFullscreen();
                } catch (_e) {
                    void _e;
                }
            }
        };
        initExam();
    }, [user, navigate, state.isExamStarted, state.isFinished, isStartingExam, startExam, requireFullscreen]);

    // ── Handle Ctrl+Shift+R/Refresh: Cek fullscreen saat mount ──
    useEffect(() => {
        console.log('[Exam UI] Refresh check effect running. isExamStarted:', state.isExamStarted);
        if (!requireFullscreen) {
            setShowFullscreenOverlay(false);
            return;
        }
        // Jika ujian sudah berjalan tapi tidak fullscreen, tampilkan overlay
        if (state.isExamStarted && !state.isFinished) {
            const timer = setTimeout(() => {
                const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
                console.log('[Exam UI] Fullscreen check after 1000ms. isFS:', isFS);
                if (!isFS) {
                    setShowFullscreenOverlay(true);
                    if (!initialFsPenaltyAppliedRef.current) {
                        initialFsPenaltyAppliedRef.current = true;
                        setFsViolationCount(prev => {
                            const newCount = prev + 1;
                            syncStatus(true, newCount, tabViolationRef.current);
                            return newCount;
                        });
                    }
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [state.isExamStarted, state.isFinished, syncStatus, requireFullscreen]);

    useEffect(() => {
        if (!requireFullscreen) return;
        if (!state.isExamStarted || state.isFinished) return;
        const limit = Number(maxFsViolations) || 0;
        if (limit > 0 && fsViolationCount >= limit) {
            setClientMessage(`Pelanggaran fullscreen mencapai batas (${limit}x). Ujian diakhiri.`, 'danger');
            endExam();
        }
    }, [requireFullscreen, maxFsViolations, fsViolationCount, state.isExamStarted, state.isFinished, endExam, setClientMessage]);

    // Deteksi Fullscreen Exit SELAMA ujian berlangsung
    useEffect(() => {
        if (!requireFullscreen) return;
        const handleFS = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            if (state.isExamStarted && !state.isFinished) {
                if (!isFS) {
                    setShowFullscreenOverlay(true);
                    setFsViolationCount(prev => {
                        const newCount = prev + 1;
                        syncStatus(true, newCount, tabViolationRef.current);
                        return newCount;
                    });
                } else {
                    setShowFullscreenOverlay(false);
                    // AUTO-RESUME JIKA MASUK FULLSCREEN
                    syncStatus(false, fsViolationRef.current, tabViolationRef.current);
                }
            }
        };
        document.addEventListener('fullscreenchange', handleFS);
        document.addEventListener('webkitfullscreenchange', handleFS);
        return () => {
            document.removeEventListener('fullscreenchange', handleFS);
            document.removeEventListener('webkitfullscreenchange', handleFS);
        };
    }, [state.isExamStarted, state.isFinished, syncStatus, requireFullscreen]);

    // Cleanup overlay saat ujian selesai
    useEffect(() => {
        if (state.isFinished) setShowFullscreenOverlay(false);
    }, [state.isFinished]);

    // Sync violations whenever tab violation changes
    useEffect(() => {
        if (state.isExamStarted && !state.isFinished && violationCount > 0) {
            syncStatus(state.isSuspended, fsViolationCount, violationCount);
        }
    }, [violationCount, state.isExamStarted, state.isFinished, state.isSuspended, fsViolationCount, syncStatus]);

    // Redirect ke hasil saat selesai
    useEffect(() => {
        if (state.isFinished) {
            const doExit = async () => {
                if (document.fullscreenElement) {
                    try { await document.exitFullscreen(); } catch (_e) { void _e; }
                }
                navigate('/result');
            };
            doExit();
        }
    }, [state.isFinished, navigate]);

    // Toggle fullscreen — selalu tutup overlay agar ujian tetap bisa diakses
    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            try {
                await document.documentElement.requestFullscreen();
                // handleFS akan otomatis panggil syncStatus(false)
            } catch (e) {
                // Browser menolak fullscreen (misal: mode dev, pengaturan browser)
                console.warn('Fullscreen denied:', e);
                setShowFullscreenOverlay(false);
                // Tetap coba resume kalau pun ditolak, supaya user tidak stuck 
                // tapi sebaiknya stay paused sampai FS berhasil (opsional)
                syncStatus(false);
            }
        } else {
            try { await document.exitFullscreen(); } catch (_e) { void _e; }
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (state.isFinished || !state.isExamStarted) return;

            const key = e.key.toUpperCase();
            const currentQ = state.questions[state.currentIndex];
            if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
                const optIndex = key.charCodeAt(0) - 65;
                const opt = currentQ?.options[optIndex];
                if (opt) setAnswer(opt.id); // FIXED: only opt.id
            } else if (e.key === 'ArrowRight') {
                nextQuestion();
            } else if (e.key === 'ArrowLeft') {
                prevQuestion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.currentIndex, state.questions, state.isExamStarted, state.isFinished, setAnswer, nextQuestion, prevQuestion]);

    // ── Loading State ──────────────────────────────────────────
    if (isStartingExam) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⏳</div>
                    <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>Menyiapkan Ujian...</h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>Sedang mengambil soal dari database aman</p>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    if (startError) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: '2rem' }}>
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '24px', padding: '3rem', maxWidth: 480, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>❌</div>
                    <h2 style={{ color: 'white', marginBottom: '1rem' }}>Gagal Memulai Ujian</h2>
                    <div style={{ background: 'rgba(239,68,68,0.2)', padding: '1rem', borderRadius: '12px', color: '#fca5a5', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
                        {startError}
                        {startError.includes('bank soal') && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>(Hubungi Admin untuk mengisi soal ujian ini)</div>}
                    </div>
                    <button onClick={() => navigate('/login')}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', padding: '1rem 2.5rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                        Kembali ke Portal Login
                    </button>
                </div>
            </div>
        );
    }

    if (!state.isExamStarted) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏱️</div>
                    <h3>Menginisialisasi Sesi...</h3>
                </div>
            </div>
        );
    }

    if (state.questions.length === 0) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', padding: '2rem' }}>
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '24px', padding: '3rem', maxWidth: 480, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📭</div>
                    <h2 style={{ color: 'white', marginBottom: '1rem' }}>Soal Tidak Ditemukan</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', lineHeight: 1.6 }}>
                        Sesi ujian ini belum memiliki daftar soal yang aktif. Silakan lapor ke panitia/admin untuk memeriksa konfigurasi bank soal.
                    </p>
                    <button onClick={() => navigate('/login')}
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '1rem 2rem', fontWeight: 700, cursor: 'pointer' }}>
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    // ── Helpers ───────────────────────────────────────────────
    const formatTime = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const currentQ = state.questions[state.currentIndex];
    const currentAnswer = state.answers[state.currentIndex];

    const timeIsVeryLow = state.timeRemaining <= 60; // 1 menit

    const answeredCount = Object.values(state.answers).filter(a => a?.optionId).length;
    const doubtCount = Object.values(state.answers).filter(a => a?.isDoubt).length;
    const unansweredCount = state.questions.length - answeredCount;

    const handleFinish = async () => {
        setShowConfirmFinish(false);
        await endExam();
    };

    // ── Confirm Dialog ────────────────────────────────────────
    if (showConfirmFinish) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '20px', padding: '2.5rem', maxWidth: 440, width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <h3 style={{ color: '#0f172a', marginBottom: '0.75rem' }}>Selesaikan Ujian?</h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{answeredCount}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Dijawab</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{doubtCount}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ragu-ragu</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>{unansweredCount}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Belum Dijawab</div>
                            </div>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                            Setelah submit, Anda <strong>tidak dapat</strong> kembali ke soal. Pastikan jawaban sudah benar.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => setShowConfirmFinish(false)} style={{ flex: 1, padding: '0.875rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, background: 'white' }}>
                            Kembali Periksa
                        </button>
                        <button onClick={handleFinish} style={{ flex: 1, padding: '0.875rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                            Ya, Selesaikan
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Exam UI ──────────────────────────────────────────
    return (
        <div className="batik-light" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

            {/* Main Wrapper Card */}
            <div style={{
                width: '100%', maxWidth: '1440px', height: 'calc(100vh - 3rem)',
                background: '#f8fafc', borderRadius: '32px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 40px 100px -20px rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.7)'
            }}>

                {/* Header Area */}
                <header style={{ padding: '1.25rem 2.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {/* Logo Instansi */}
                        {publicSettings.institution_logo ? (
                            <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={publicSettings.institution_logo} alt="Instansi" style={{ height: '40px', objectFit: 'contain' }} />
                            </div>
                        ) : (
                            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', boxShadow: '0 4px 10px rgba(59,130,246,0.3)' }}>
                                <User size={28} />
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>IDENTITAS PESERTA</div>
                            <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.02em', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                                {user?.nama || 'NAMA PESERTA'}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>NIK:</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>{user?.nik || '-'}</span>
                                </div>
                                <div style={{ width: '1px', height: '10px', background: '#e2e8f0', alignSelf: 'center' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>NO:</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>{user?.nomorPeserta || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.4rem', borderRadius: '100px', gap: '0.5rem' }}>
                            <button onClick={() => setFontSize(Math.min(fontSize + 0.1, 1.5))} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontWeight: 700, fontSize: '1rem' }}>A+</button>
                            <button onClick={() => setFontSize(Math.max(fontSize - 0.1, 0.8))} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontWeight: 700, fontSize: '0.8rem' }}>A-</button>
                        </div>
                        {violationCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fef2f2', padding: '0.4rem 0.75rem', borderRadius: '100px', border: '1px solid #fecaca' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#dc2626' }}>PELANGGARAN: {violationCount}/{maxViolation}</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Sub Header row (Badges & Timer) */}
                <div style={{ margin: '1.5rem 2rem', background: 'white', borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.5rem 0.5rem 1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        {/* Category Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem' }}>📋</div>
                            <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>KATEGORI</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{currentQ?.category}</div>
                            </div>
                        </div>
                        {/* Total Soal */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem' }}>📝</div>
                            <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>TOTAL SOAL</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{state.questions.length}</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: isOnline ? '#ecfdf5' : '#fef2f2', padding: '0.4rem 1rem', borderRadius: '100px' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444' }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isOnline ? '#059669' : '#b91c1c' }}>{isOnline ? 'STABIL' : 'OFFLINE'}</span>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: state.saveStatus === 'error' ? '#fef2f2' : (state.saveStatus === 'saving' ? '#fffbeb' : '#ecfdf5'),
                                padding: '0.4rem 1rem', borderRadius: '100px'
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: state.saveStatus === 'error' ? '#ef4444' : (state.saveStatus === 'saving' ? '#f59e0b' : '#10b981')
                                }} />
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 800,
                                    color: state.saveStatus === 'error' ? '#b91c1c' : (state.saveStatus === 'saving' ? '#b45309' : '#059669')
                                }}>
                                    {state.saveStatus === 'saving' ? 'MENYIMPAN' : (state.saveStatus === 'error' ? 'GAGAL SIMPAN' : 'TERSIMPAN')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timer Pill */}
                    <div style={{
                        background: timeIsVeryLow ? '#b91c1c' : '#ef4444', color: 'white', padding: '0.6rem 1.5rem',
                        borderRadius: '100px', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center',
                        gap: '0.75rem', boxShadow: '0 4px 10px rgba(239,68,68,0.3)',
                        animation: timeIsVeryLow ? 'pulse 1s ease-in-out infinite' : 'none'
                    }}>
                        {formatTime(state.timeRemaining)} ⏱️
                    </div>
                </div>

                {/* 2-Column Content Area */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '2rem', padding: '0 2rem 2rem', overflow: 'hidden' }}>

                    {/* Left Panel (Content) */}
                    <main style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingLeft: '1.5rem', paddingRight: '0.5rem', paddingBottom: '2rem' }}>

                        {/* Title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ width: '6px', height: '24px', background: '#3b82f6', borderRadius: '4px' }} />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#475569', margin: 0, letterSpacing: '0.05em' }}>HALAMAN SOAL</h2>
                        </div>

                        {/* Question Box */}
                        <div style={{
                            background: 'white', borderRadius: '24px', padding: '2.5rem 3rem', position: 'relative',
                            marginBottom: '2.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', marginTop: '1.5rem'
                        }}>
                            {/* Number Badge Absolute */}
                            <div style={{
                                position: 'absolute', top: '-1rem', left: '-1rem', width: '48px', height: '48px',
                                background: '#3b82f6', borderRadius: '16px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 800,
                                boxShadow: '0 8px 15px -3px rgba(59,130,246,0.4)', border: '4px solid #e0f2fe'
                            }}>
                                {state.currentIndex + 1}
                            </div>

                            {/* Image */}
                            {currentQ?.image_url && (
                                <div style={{ marginBottom: '2rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                                    <img src={currentQ.image_url} alt="Gambar Soal" style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', background: '#f8fafc' }} />
                                </div>
                            )}

                            <div style={{ fontSize: `${fontSize}rem`, color: '#1e293b', fontWeight: 500, lineHeight: 1.75, letterSpacing: '0.01em' }}>
                                {currentQ?.question}
                            </div>

                            {/* Audio */}
                            {currentQ?.audio_url && (
                                <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audio Soal:</label>
                                    <audio controls style={{ width: '100%', height: '40px', outline: 'none' }}>
                                        <source src={currentQ.audio_url} type="audio/mpeg" />
                                        Browser tidak mendukung audio.
                                    </audio>
                                </div>
                            )}
                        </div>

                        {/* Options List - Dynamic Layout */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: currentQ?.options?.every(o => (o.text || '').length < 30) ? 'repeat(auto-fit, minmax(350px, 1fr))' : '1fr',
                            gap: '1rem',
                            marginBottom: '3rem'
                        }}>
                            {currentQ?.options?.map((opt, idx) => {
                                const label = String.fromCharCode(65 + idx);
                                const isSelected = currentAnswer?.optionId === opt.id;
                                const isShort = (opt.text || '').length < 30;

                                return (
                                    <button
                                        key={opt.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('[Exam UI] Option clicked:', opt.id);
                                            setAnswer(opt.id);
                                        }}
                                        className={`exam-option-card-new ${isSelected ? 'selected' : ''}`}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '1.25rem', width: '100%',
                                            padding: isShort ? '1rem 1.5rem' : '1.25rem 1.5rem', textAlign: 'left',
                                            borderRadius: '16px', // Changed from 100px to 16px for better multi-line support
                                            border: isSelected ? '2px solid #6366f1' : '2px solid white',
                                            background: isSelected ? '#e0e7ff' : 'white',
                                            cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: isSelected ? '0 10px 20px -5px rgba(99, 102, 241, 0.3)' : '0 4px 10px rgba(0,0,0,0.03)',
                                            minHeight: '60px'
                                        }}
                                    >
                                        <span style={{
                                            width: '36px', height: '36px', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px',
                                            fontWeight: 800, fontSize: '1rem',
                                            background: isSelected ? '#6366f1' : '#f1f5f9',
                                            color: isSelected ? 'white' : '#94a3b8',
                                            border: isSelected ? 'none' : '1px solid #e2e8f0',
                                            transition: 'all 0.2s'
                                        }}>{label}</span>
                                        <span style={{ flex: 1, fontSize: `${fontSize}rem`, lineHeight: '1.5', color: isSelected ? '#3730a3' : '#334155', fontWeight: isSelected ? 700 : 500 }}>
                                            {opt.text}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* End of Left Panel Content */}
                        <div style={{ marginTop: 'auto' }} />

                    </main>

                    {/* Right Panel (Grid) */}
                    <aside style={{ background: 'white', borderRadius: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', height: '100%', overflow: 'hidden' }}>

                        <div style={{ padding: '2rem 1.5rem 1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.2rem', color: '#64748b' }}>📍</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>Navigasi Soal</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>{answeredCount}/{state.questions.length} SELESAI</span>
                            </div>
                        </div>

                        <div style={{ flex: 1, padding: '0 1.5rem 1.5rem', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                                {state.questions.map((_, idx) => {
                                    const ans = state.answers[idx];
                                    const isCurrent = state.currentIndex === idx;
                                    const isAnswered = ans?.optionId;
                                    const isDoubt = ans?.isDoubt;

                                    let bg = 'white', color = '#94a3b8', borderBottom = '4px solid #f1f5f9', border = '1px solid #f1f5f9';

                                    if (isCurrent) {
                                        bg = '#fcd34d'; color = 'white'; borderBottom = '4px solid #d97706'; border = 'none'; // Yellow/Orange
                                    } else if (isDoubt) {
                                        bg = '#fef3c7'; color = '#d97706'; borderBottom = '4px solid #fcd34d'; border = 'none';
                                    } else if (isAnswered) {
                                        bg = '#10b981'; color = 'white'; borderBottom = '4px solid #059669'; border = 'none'; // Green
                                    }

                                    return (
                                        <button key={idx} onClick={() => goToQuestion(idx)}
                                            className="exam-nav-grid-btn"
                                            style={{
                                                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: bg, color, border, borderBottom, borderRadius: '12px',
                                                fontWeight: 800, fontSize: idx >= 99 ? '0.85rem' : '1.1rem', cursor: 'pointer',
                                                transition: 'all 0.1s'
                                            }}>
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn-3d grey-btn" onClick={prevQuestion} disabled={state.currentIndex === 0} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderBottom: '4px solid #cbd5e1', cursor: state.currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: state.currentIndex === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    ← Sebelumnya
                                </button>
                                <button className="btn-3d green-btn" onClick={nextQuestion} disabled={state.currentIndex === state.questions.length - 1} style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', background: '#10b981', color: 'white', border: 'none', borderBottom: '4px solid #059669', cursor: state.currentIndex === state.questions.length - 1 ? 'not-allowed' : 'pointer', opacity: state.currentIndex === state.questions.length - 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    Selanjutnya →
                                </button>
                            </div>

                            <button className="btn-3d doubt-btn" onClick={() => toggleDoubt(state.currentIndex)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem', background: currentAnswer?.isDoubt ? '#fef3c7' : 'white', color: currentAnswer?.isDoubt ? '#d97706' : '#94a3b8', border: 'none', borderBottom: `4px solid ${currentAnswer?.isDoubt ? '#f59e0b' : '#e2e8f0'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                {currentAnswer?.isDoubt ? '🟡 Ragu-Ragu Aktif' : 'Tandai Ragu'}
                            </button>

                            <button onClick={() => setShowConfirmFinish(true)} className="btn-3d red-btn" style={{ width: '100%', padding: '0.6rem', background: '#ef4444', color: 'white', fontWeight: 800, fontSize: '0.85rem', borderRadius: '12px', border: 'none', borderBottom: '3px solid #b91c1c', cursor: 'pointer', marginTop: '0.25rem' }}>
                                Selesaikan Ujian
                            </button>
                        </div>

                    </aside>

                </div>
            </div>

            {/* PAUSE OVERLAY */}
            {state.isSuspended && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(12px)', zIndex: 10001,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '32px', padding: '3rem',
                        maxWidth: 500, width: '100%', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: '4px solid #f59e0b',
                        animation: 'slideUp 0.5s ease-out'
                    }}>
                        <div style={{ fontSize: '5rem', marginBottom: '1.5rem', animation: 'pulse-soft 2s infinite' }}>⏸️</div>
                        <h2 style={{ color: '#0f172a', marginBottom: '1rem', fontWeight: 800 }}>Ujian Ditangguhkan</h2>
                        <p style={{ color: '#64748b', marginBottom: '2.5rem', lineHeight: 1.6, fontSize: '1.1rem' }}>
                            Sesi ujian Anda sedang <strong>DIJEDA</strong> oleh pengawas. <br />
                            Waktu ujian terhenti sementara dan akan dilanjutkan kembali sesuai instruksi panitia.
                        </p>
                        <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '16px', color: '#b45309', fontWeight: 600, fontSize: '0.95rem' }}>
                            Harap tunggu di tempat Anda.
                        </div>
                    </div>
                </div>
            )}

            {/* FULLSCREEN OVERLAY — Truly Blocking */}
            {requireFullscreen && showFullscreenOverlay && !state.isFinished && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                    zIndex: 10002,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
                    animation: 'none',
                    userSelect: 'none'
                }}>
                    {/* Decorative blobs */}
                    <div style={{ position: 'absolute', top: '10%', left: '5%', width: 300, height: 300, background: 'rgba(239,68,68,0.08)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 400, height: 400, background: 'rgba(99,102,241,0.06)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />

                    <div style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: '32px', padding: '3.5rem 3rem',
                        maxWidth: 520, width: '100%', textAlign: 'center',
                        border: '2px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 0 60px rgba(239, 68, 68, 0.15), 0 25px 50px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(20px)',
                    }}>
                        {/* Animated warning icon */}
                        <div style={{
                            width: 100, height: 100, background: 'rgba(239, 68, 68, 0.15)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 2rem',
                            border: '2px solid rgba(239,68,68,0.5)',
                            fontSize: '3.5rem',
                            animation: 'pulse-red 1.5s ease-in-out infinite'
                        }}>
                            🚫
                        </div>

                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                            PELANGGARAN KEAMANAN UJIAN
                        </div>
                        <h2 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
                            Mode Layar Penuh Diperlukan
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '1.5rem', lineHeight: 1.7, fontSize: '1rem' }}>
                            Anda keluar dari mode <strong style={{ color: 'white' }}>layar penuh</strong> yang diwajibkan selama ujian.
                            Tindakan ini telah <strong style={{ color: '#fca5a5' }}>tercatat sebagai pelanggaran</strong> oleh sistem pengawas.
                        </p>

                        {/* Violation counter (showing fullscreen violations only) */}
                        {fsViolationCount > 0 && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
                                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                                padding: '0.625rem 1.25rem', borderRadius: '100px', marginBottom: '2rem'
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1s infinite' }} />
                                <span style={{ color: '#fca5a5', fontWeight: 800, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
                                    PELANGGARAN FULLSCREEN KE-{fsViolationCount}
                                </span>
                            </div>
                        )}

                        <button
                            onClick={toggleFullscreen}
                            style={{
                                width: '100%', padding: '1.25rem 2rem',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white', border: 'none', borderRadius: '20px',
                                fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
                                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                letterSpacing: '0.02em'
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <span style={{ fontSize: '1.3rem' }}>⛶</span>
                            Masuk Kembali ke Layar Penuh
                        </button>

                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: '1.5rem', lineHeight: 1.5 }}>
                            Dengan menekan tombol di atas, Anda menyatakan kesiapan melanjutkan ujian.<br />
                            Pelanggaran berulang akan dilaporkan ke pengawas.
                        </p>
                    </div>
                </div>
            )}

            {/* ── BROADCAST NOTIFICATION OVERLAY ────────────────────────── */}
            {state.serverMessage && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 10005,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(20px)',
                    animation: 'fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div className="stagger-entry" style={{
                        maxWidth: '550px', width: '90%', padding: '3.5rem',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: '40px', border: '2px solid rgba(99, 102, 241, 0.3)',
                        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.5), 0 18px 36px -18px rgba(0, 0, 0, 0.5), inset 0 0 100px rgba(99, 102, 241, 0.05)',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Decorative background element */}
                        <div style={{
                            position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px',
                            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
                            pointerEvents: 'none'
                        }} />

                        <div style={{
                            width: '80px', height: '80px', background: 'rgba(99, 102, 241, 0.15)',
                            borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 2rem', border: '1px solid rgba(99, 102, 241, 0.3)',
                            fontSize: '2.5rem'
                        }}>
                            {state.serverMessage.type === 'danger' ? '⛔' : (state.serverMessage.type === 'warning' ? '⚠️' : '📢')}
                        </div>

                        <h2 style={{
                            fontSize: '1.25rem', fontWeight: 800, color: '#6366f1',
                            textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem'
                        }}>
                            {state.serverMessage.type === 'danger' ? 'Pelanggaran' : (state.serverMessage.type === 'warning' ? 'Peringatan' : 'Informasi')}
                        </h2>

                        <div style={{
                            fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.5, color: 'white',
                            marginBottom: '2.5rem', wordBreak: 'break-word'
                        }}>
                            "{state.serverMessage.message}"
                        </div>

                        <button
                            onClick={acknowledgeMessage}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                color: 'white', border: 'none', padding: '1.2rem 3rem',
                                borderRadius: '20px', fontSize: '1.1rem', fontWeight: 800,
                                cursor: 'pointer', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                width: '100%'
                            }}
                            onMouseOver={(e) => e.target.style.transform = 'translateY(-3px)'}
                            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                        >
                            Saya Mengerti
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
                @keyframes pulse-red { 0%,100%{ box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50%{ box-shadow: 0 0 0 16px rgba(239,68,68,0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .stagger-entry { animation: slideUp 0.6s cubic-bezier(0.2, 1, 0.2, 1) both; }
                @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                /* Visual Enhancements */
                .exam-option-card-new:hover:not(.selected) {
                    transform: translateY(-2px);
                    border-color: #cbd5e1 !important;
                    box-shadow: 0 10px 20px -10px rgba(0,0,0,0.08) !important;
                }
                .exam-option-card-new:active {
                    transform: translateY(0);
                }
                
                .btn-3d:active:not(:disabled) {
                    transform: translateY(4px);
                    border-bottom-width: 0px !important;
                    margin-top: 4px;
                }
                .btn-3d:hover:not(:disabled) {
                    filter: brightness(1.05);
                }

                .exam-nav-grid-btn:hover {
                    filter: brightness(1.1);
                    transform: translateY(-2px);
                }
                .exam-nav-grid-btn:active {
                    transform: translateY(2px);
                    border-bottom-width: 0px !important;
                }
            `}</style>
        </div>
    );
}
