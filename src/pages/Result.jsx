import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';

export default function Result() {
    const { user, logout, API_URL } = useAuth();
    const { state, resetExam } = useExam();
    const navigate = useNavigate();
    const [publicSettings, setPublicSettings] = useState({});
    const [activeTemplate, setActiveTemplate] = useState(null);

    useEffect(() => {
        if (!user || (!state.isFinished && state.questions.length === 0)) {
            navigate('/login');
        }
    }, [user, state, navigate]);

    useEffect(() => {
        fetch(`${API_URL}/settings`)
            .then(r => r.ok ? r.json() : {})
            .then(d => setPublicSettings(d || {}))
            .catch(() => undefined);
    }, [API_URL]);

    useEffect(() => {
        fetch(`${API_URL}/active-template`)
            .then(r => r.ok ? r.json() : null)
            .then(d => setActiveTemplate(d && !d.error ? d : null))
            .catch(() => undefined);
    }, [API_URL]);

    const resultAvailable = state.resultAvailable === true;
    const scores = state.finalScores;
    const isDataReady = state.resultAvailable !== null;
    const pgMap = scores?.passingGrades || {};
    const scoreMode = scores?.scoreMode || 'category';
    const categories = Object.keys(scores?.detailed || {});
    const showCategoryDetails = resultAvailable && scoreMode !== 'total' && categories.length > 0;

    // Kalkulasi kelulusan per kategori atau total
    let calculatedLulus = true;
    if (scores) {
        if (scoreMode === 'total') {
            const totalPG = pgMap.TOTAL || 0;
            calculatedLulus = scores.total >= totalPG;
        } else {
            categories.forEach(catKey => {
                const score = scores.detailed[catKey];
                const pg = pgMap[catKey] || 0;
                if (score < pg) calculatedLulus = false;
            });
        }
    }
    const isLulusOverall = scores ? (categories.length > 0 ? calculatedLulus : scores.isPassed) : false;

    const totalDijawab = Object.values(state.answers || {}).filter(a => a?.optionId).length;
    const totalSoal = state.questions?.length || 0;
    const examTitle = state.examTitle || 'Ujian CAT';
    const nowStr = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isProcessing = resultAvailable && !state.finalScores && state.submitStatus === 'submitting';

    if (!user) return null;

    // Loading State saat data resultAvailable masih null (menunggu server)
    if (!isDataReady) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: 'white',
                fontFamily: 'Inter, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>Memuat hasil ujian...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const handleLogout = () => { resetExam(); logout(); navigate('/login'); };
    const handlePrint = () => window.print();

    // --- Category score rendering ---
    const getCategoryColor = (score, pg) => {
        if (!pg) return '#3b82f6';
        if (score >= pg) return '#10b981';
        return '#ef4444';
    };

    const template = activeTemplate || {
        id: 'medical',
        primary_color: '#0d9488',
        secondary_color: '#f59e0b'
    };

    const primary = template.primary_color || '#0d9488';
    const secondary = template.secondary_color || '#f59e0b';

    const firstName = (user?.nama || '').trim().split(/\s+/)[0] || 'PESERTA';
    const statusTone = !resultAvailable ? 'info' : (isLulusOverall ? 'success' : 'danger');
    const statusPalette = statusTone === 'success'
        ? { accent: '#10b981', soft: 'rgba(16, 185, 129, 0.12)', text: '#065f46' }
        : statusTone === 'danger'
            ? { accent: '#ef4444', soft: 'rgba(239, 68, 68, 0.10)', text: '#991b1b' }
            : { accent: primary, soft: 'rgba(99, 102, 241, 0.10)', text: '#1e293b' };

    return (
        <div className="animate-fade-in" style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1rem',
            fontFamily: "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif",
            background: `radial-gradient(1000px 700px at 20% 20%, ${primary}55 0%, rgba(2,6,23,0) 55%), radial-gradient(900px 700px at 80% 30%, ${secondary}22 0%, rgba(2,6,23,0) 60%), linear-gradient(135deg, ${primary} 0%, #0b1220 70%)`
        }}>
            <style>{`
                @media print {
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .result-card {
                        box-shadow: none !important;
                        max-width: 100% !important;
                        border: 1px solid #ddd !important;
                        border-radius: 0 !important;
                        background: white !important;
                    }
                }
                .print-only { display: none; }
                .result-card { transition: all 0.3s ease; }
                .score-bar-fill { transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
                @keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .score-number { animation: countUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            `}</style>

            <div className="result-card" style={{
                width: '100%',
                maxWidth: 860,
                background: '#ffffff',
                borderRadius: '36px',
                overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
                border: '1px solid rgba(15, 23, 42, 0.10)'
            }}>
                <div style={{
                    padding: '2.25rem 2.25rem 1.75rem',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    background: `linear-gradient(135deg, ${primary} 0%, #0f172a 70%)`
                }}>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        <div style={{ position: 'absolute', top: '-120px', left: '-140px', width: '420px', height: '420px', background: `${primary}55`, filter: 'blur(90px)', borderRadius: '50%' }} />
                        <div style={{ position: 'absolute', bottom: '-140px', right: '-160px', width: '520px', height: '520px', background: `${secondary}2d`, filter: 'blur(110px)', borderRadius: '50%' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', position: 'relative', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                            {publicSettings.institution_logo ? (
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    background: 'rgba(255,255,255,0.12)',
                                    borderRadius: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.18)'
                                }}>
                                    <img src={publicSettings.institution_logo} alt="Logo Instansi" style={{ height: 34, objectFit: 'contain' }} />
                                </div>
                            ) : (
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    background: 'rgba(255,255,255,0.12)',
                                    borderRadius: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 900,
                                    letterSpacing: '-0.02em',
                                    border: '1px solid rgba(255,255,255,0.18)'
                                }}>
                                    C
                                </div>
                            )}
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.18em', opacity: 0.75, textTransform: 'uppercase' }}>
                                    Laporan Hasil
                                </div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                                    {nowStr}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.16)',
                            border: '1px solid rgba(255,255,255,0.22)',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase'
                        }}>
                            <span style={{ width: 10, height: 10, borderRadius: 99, background: statusPalette.accent, boxShadow: `0 0 0 4px ${statusPalette.accent}25` }} />
                            {!resultAvailable ? 'Belum diumumkan' : (isLulusOverall ? 'Lulus' : 'Tidak lulus')}
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                            SELAMAT DATANG
                        </div>
                        <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '0.85rem' }}>
                            HALO,<br />{firstName}!
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '1rem', lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 700 }}>{examTitle}</span><br />
                            <span style={{ opacity: 0.85 }}>{user?.nama} · NIK {user?.nik}</span>
                        </div>
                    </div>
                </div>

                <div style={{
                    padding: '1.75rem 2.25rem 2.25rem',
                    background: '#ffffff',
                    borderTopLeftRadius: '36px',
                    borderTopRightRadius: '36px'
                }}>
                    {!resultAvailable ? (
                        <div style={{
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            background: '#f8fafc',
                            borderRadius: '24px',
                            border: '1px dashed #cbd5e1'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📢</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem' }}>Ujian Selesai</h3>
                            <p style={{ color: '#64748b', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto' }}>
                                Terima kasih, ujian Anda sudah selesai. Skor Anda sudah masuk ke sistem dan akan diumumkan nanti oleh panitia.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.25rem' }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            border: '1px solid rgba(2,6,23,0.08)',
                            boxShadow: '0 12px 30px rgba(2,6,23,0.06)',
                            padding: '1.5rem'
                        }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                Total Skor
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                <div className="score-number" style={{
                                    fontSize: '4.25rem',
                                    fontWeight: 900,
                                    lineHeight: 0.95,
                                    letterSpacing: '-0.04em',
                                    color: !resultAvailable ? '#0f172a' : statusPalette.accent
                                }}>
                                    {!resultAvailable ? '—' : (isProcessing ? '…' : scores.total)}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 700 }}>
                                    {totalDijawab}/{totalSoal} soal dijawab
                                </div>
                            </div>
                            <div style={{
                                marginTop: '1rem',
                                height: 10,
                                background: 'rgba(2,6,23,0.06)',
                                borderRadius: 99,
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${totalSoal ? Math.min(100, Math.round((totalDijawab / totalSoal) * 100)) : 0}%`,
                                    background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
                                    borderRadius: 99
                                }} />
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    {!resultAvailable ? 'Hasil belum diumumkan oleh panitia.' : (scoreMode === 'total' ? `Mode skor total · Batas lulus ${pgMap.TOTAL || 0}` : `Mode per kategori · ${categories.length} kategori dinilai`)}
                            </div>
                        </div>

                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            border: `1px solid ${statusPalette.accent}33`,
                            boxShadow: '0 12px 30px rgba(2,6,23,0.06)',
                            padding: '1.5rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', top: '-90px', right: '-90px', width: 220, height: 220, borderRadius: '50%', background: statusPalette.soft, filter: 'blur(2px)' }} />
                            </div>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: statusPalette.soft,
                                color: statusPalette.text,
                                border: `1px solid ${statusPalette.accent}25`,
                                padding: '0.5rem 0.75rem',
                                borderRadius: 999,
                                fontWeight: 900,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                fontSize: '0.72rem',
                                position: 'relative'
                            }}>
                                <span style={{ width: 10, height: 10, borderRadius: 99, background: statusPalette.accent }} />
                                {!resultAvailable ? 'Status' : 'Kelulusan'}
                            </div>
                            <div style={{ marginTop: '1rem', fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a', position: 'relative' }}>
                                {!resultAvailable ? 'BELUM DIUMUMKAN' : (isLulusOverall ? 'LULUS' : 'TIDAK LULUS')}
                            </div>
                            <div style={{ marginTop: '0.4rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 700, position: 'relative' }}>
                                {!resultAvailable ? 'Menunggu panitia membuka hasil ujian' : (scoreMode === 'total' ? 'Penilaian berdasarkan total skor' : 'Penilaian per kategori')}
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', position: 'relative' }}>
                                <div style={{ padding: '0.45rem 0.65rem', borderRadius: '12px', border: '1px solid rgba(2,6,23,0.08)', background: '#ffffff', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                                    {scoreMode === 'total' ? `Batas: ${pgMap.TOTAL || 0}` : `${categories.length} kategori`}
                                </div>
                                <div style={{ padding: '0.45rem 0.65rem', borderRadius: '12px', border: '1px solid rgba(2,6,23,0.08)', background: '#ffffff', fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                                    {isProcessing ? 'Memproses…' : 'Selesai'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {showCategoryDetails && (
                        <div style={{ marginTop: '1.25rem', background: 'white', borderRadius: '24px', border: '1px solid rgba(2,6,23,0.08)', boxShadow: '0 12px 30px rgba(2,6,23,0.06)', overflow: 'hidden' }}>
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(2,6,23,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>
                                    Detail Skor Per Kategori
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>
                                    {scoreMode === 'total' ? 'Mode total aktif' : 'Mode per kategori aktif'}
                                </div>
                            </div>
                            <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gap: '1rem' }}>
                                {categories.map(cat => {
                                    const score = scores.detailed[cat];
                                    const pg = pgMap[cat] || 0;
                                    const lulus = score >= pg;
                                    const pct = pg > 0 ? Math.min((score / pg) * 100, 100) : 100;
                                    const color = getCategoryColor(score, pg);
                                    return (
                                        <div key={cat} style={{ padding: '1rem', borderRadius: '18px', border: '1px solid rgba(2,6,23,0.06)', background: 'rgba(2,6,23,0.015)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                    <div style={{
                                                        background: color + '18',
                                                        color,
                                                        border: `1px solid ${color}25`,
                                                        fontWeight: 900,
                                                        fontSize: '0.78rem',
                                                        padding: '0.28rem 0.6rem',
                                                        borderRadius: '10px',
                                                        letterSpacing: '0.08em'
                                                    }}>
                                                        {cat}
                                                    </div>
                                                    {pg > 0 ? (
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                                                            Batas lulus: {pg}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                                                            Tidak ada batas kelulusan
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ fontWeight: 900, fontSize: '1.35rem', color }}>
                                                        {score}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 900,
                                                        padding: '0.35rem 0.65rem',
                                                        borderRadius: '12px',
                                                        background: lulus ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                                                        color: lulus ? '#065f46' : '#991b1b',
                                                        border: `1px solid ${lulus ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                                                        letterSpacing: '0.1em',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {lulus ? 'LULUS' : 'GAGAL'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: '0.85rem', height: 10, background: 'rgba(2,6,23,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                                                <div className="score-bar-fill" style={{
                                                    height: '100%',
                                                    width: `${pct}%`,
                                                    background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                                                    borderRadius: 99
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
            </>
        )}

                    <div style={{ marginTop: '1.25rem', background: 'white', borderRadius: '24px', border: '1px solid rgba(2,6,23,0.08)', boxShadow: '0 12px 30px rgba(2,6,23,0.06)' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(2,6,23,0.06)', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>
                            Identitas Peserta
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                                {[
                                    { label: 'Nama', value: user?.nama },
                                    { label: 'NIK', value: user?.nik },
                                    { label: 'No. Peserta', value: user?.nomorPeserta },
                                    { label: 'Waktu Selesai', value: nowStr },
                                ].map(item => (
                                    <div key={item.label} style={{ padding: '0.9rem 1rem', borderRadius: '16px', border: '1px solid rgba(2,6,23,0.06)', background: 'rgba(2,6,23,0.015)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                                        <div style={{ marginTop: '0.35rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{item.value || '-'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="no-print" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={handlePrint} style={{
                        flex: 1, minWidth: 160, padding: '0.875rem 1.5rem',
                        background: '#0f172a', color: 'white', border: 'none',
                        borderRadius: '16px', fontWeight: 800, fontSize: '0.95rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s ease',
                    }}
                        onMouseOver={e => e.currentTarget.style.background = '#111827'}
                        onMouseOut={e => e.currentTarget.style.background = '#0f172a'}
                    >
                        🖨️ Cetak Bukti
                    </button>
                    <button onClick={handleLogout} style={{
                        flex: 1, minWidth: 160, padding: '0.875rem 1.5rem',
                        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
                        color: 'white', border: 'none',
                        borderRadius: '16px', fontWeight: 900, fontSize: '0.95rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s ease',
                    }}>
                        Selesai & Keluar →
                    </button>
                </div>

                    <div className="print-only" style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.8 }}>
                                <p>Dokumen ini dicetak secara otomatis oleh sistem CAT.</p>
                                <p>Dicetak pada: {nowStr}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderTop: '1px solid #000', width: 200, paddingTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                                    Tanda Tangan Panitia
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
