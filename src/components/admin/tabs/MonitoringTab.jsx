import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Card, Button, Badge, Icons, DataTable,
    StatCard, getTheme, Input, InfoNote,
    AdminModal, FormGroup, ConfirmModal
} from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function MonitoringTab({
    setModal: _setModal,
    examId,
    handleShowSessionReview,
    handlePause,
    handleResume,
    handleAddTime
}) {
    const {
        liveSessions, participants, fetchData, API, adminHeaders, showToast, theme: mode, loading, adminRole: _adminRole, timeOffset
    } = useAdmin();

    const theme = getTheme(mode);
    const [confirmState, setConfirmState] = useState({ isOpen: false, message: '', onConfirm: null, loading: false });
    const [now, setNow] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    const participantExamIdByParticipantId = useMemo(() => {
        const map = new Map();
        if (!Array.isArray(participants)) return map;
        participants.forEach(p => {
            if (p?.id) map.set(p.id, p.exam_id || null);
        });
        return map;
    }, [participants]);

    const scopedParticipants = useMemo(() => {
        if (!examId) return participants;
        if (!Array.isArray(participants)) return [];
        return participants.filter(p => p.exam_id === examId);
    }, [participants, examId]);

    const scopedLiveSessions = useMemo(() => {
        if (!Array.isArray(liveSessions)) return [];
        if (!examId) return liveSessions;
        return liveSessions.filter(s => {
            const resolvedExamId = s.exam_id ?? participantExamIdByParticipantId.get(s.participant_id) ?? null;
            return resolvedExamId === examId;
        });
    }, [liveSessions, examId, participantExamIdByParticipantId]);

    // Filter sessions based on search term
    const filteredSessions = useMemo(() => {
        const sorted = [...scopedLiveSessions].sort((a, b) => (Number(b.final_score_total) || 0) - (Number(a.final_score_total) || 0));
        if (!searchTerm.trim()) return sorted;

        const term = searchTerm.toLowerCase().trim();
        return sorted.filter(s =>
            (s.nama || '').toLowerCase().includes(term) ||
            (s.nik || '').toLowerCase().includes(term) ||
            (s.nomor_peserta || '').toLowerCase().includes(term)
        );
    }, [scopedLiveSessions, searchTerm]);

    // Update real-time for countdowns
    useEffect(() => {
        const timer = setInterval(() => {
            // Synchronize with server time using offset
            setNow(new Date(Date.now() + (timeOffset || 0)));
        }, 1000);
        return () => clearInterval(timer);
    }, [timeOffset]);

    const formatTimeRemaining = (endTimeStr) => {
        const diff = new Date(endTimeStr) - now;
        if (diff <= 0) return '00:00:00';
        const s = Math.floor(diff / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const handleForceFinish = (s, isExpired) => {
        setConfirmState({
            isOpen: true,
            title: isExpired ? 'Selesaikan Paksa (Waktu Habis)' : 'Hentikan Paksa Ujian',
            message: isExpired
                ? `Waktu ujian ${s.nama} telah habis. Selesaikan sesi ini secara paksa untuk memproses skor akhir?`
                : `Apakah Anda yakin ingin menghentikan paksa ujian ${s.nama}? Peserta tidak akan bisa melanjutkan ujian ini lagi.`,
            confirmText: isExpired ? 'Ya, Selesaikan' : 'Ya, Hentikan Paksa',
            type: isExpired ? 'warning' : 'danger',
            onConfirm: () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                axios.post(`${API}/sessions/${s.session_id}/force-finish`, {}, { headers: adminHeaders() })
                    .then(() => {
                        showToast('Sesi Berhasil Dihentikan');
                        fetchData('monitoring', { examId: examId || undefined });
                        setConfirmState({ isOpen: false });
                    })
                    .catch(() => {
                        showToast('Gagal hentikan sesi', 'error');
                        setConfirmState(prev => ({ ...prev, loading: false }));
                    });
            }
        });
    };


    // Pagination logic
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;
    
    const paginatedSessions = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSessions.slice(start, start + pageSize);
    }, [filteredSessions, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredSessions.length / pageSize);

    // Reset to page 1 if search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="stagger-entry">
            <InfoNote title="Command Center" style={{ marginBottom: '1.5rem' }}>
                Pantau progres peserta secara live, jeda/lanjut sesi, tambah waktu, dan lakukan tindakan pengawasan bila diperlukan. Gunakan pencarian untuk menemukan peserta dengan cepat.
            </InfoNote>
            {/* KPI STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    label="Total Peserta"
                    value={scopedParticipants.length}
                    icon={<Icons.Users />}
                    trend="+12%"
                />
                <StatCard
                    label="Ujian Berjalan"
                    value={scopedLiveSessions.filter(s => s.status === 'ongoing').length}
                    icon={<Icons.Activity />}
                    trend="Live"
                    trendType="up"
                />
                <StatCard
                    label="Selesai"
                    value={scopedLiveSessions.filter(s => s.status === 'finished').length}
                    icon={<Icons.Trophy />}
                />
                <StatCard
                    label="Rata-rata Skor"
                    value={Math.round(scopedLiveSessions.reduce((acc, s) => acc + (Number(s.final_score_total) || Number(s.score) || 0), 0) / (scopedLiveSessions.length || 1))}
                    icon={<Icons.Target />}
                />
            </div>

            <Card style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '10px', background: theme.primary + '15', color: theme.primary, display: 'flex' }}>
                            <Icons.Activity size={18} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Monitor Live</h3>
                        <Badge type="secondary" style={{ borderRadius: '6px', fontSize: '0.65rem' }}>{filteredSessions.length} Peserta</Badge>
                    </div>

                    <div style={{ width: '300px' }}>
                        <Input
                            placeholder="Cari Nama/NIK/No Peserta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Icons.Search />}
                            style={{ padding: '0.6rem 1rem 0.6rem 2.8rem', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <DataTable
                        columns={[
                            {
                                header: 'Rank',
                                align: 'center',
                                width: '60px',
                                render: (_, idx) => {
                                    const rank = ((currentPage - 1) * pageSize) + idx + 1;
                                    return (
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '6px',
                                            background: rank === 1 ? theme.gradPrimary : (theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                            color: rank === 1 ? 'white' : theme.text,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.75rem', fontWeight: 800,
                                            margin: '0 auto'
                                        }}>
                                            {rank}
                                        </div>
                                    );
                                }
                            },
                            {
                                header: 'Peserta',
                                render: (s) => (
                                    <div style={{ padding: '0.4rem 0' }}>
                                        <div style={{ fontWeight: 800, color: theme.text, fontSize: '1rem', letterSpacing: '-0.01em' }}>{s.nama}</div>
                                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: '0.7rem', color: theme.primary, fontWeight: 700, background: theme.primary + '15', padding: '0 6px', borderRadius: '4px' }}>{s.nik}</div>
                                            <div style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: 700 }}>{s.nomor_peserta}</div>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                header: 'Status',
                                align: 'center',
                                render: (s) => {
                                    const isExpired = s.status === 'ongoing' && now > new Date(s.end_time);
                                    return (
                                        <Badge type={s.status === 'finished' ? 'success' : (s.is_suspended ? 'warning' : (isExpired ? 'danger' : 'info'))}>
                                            {s.status === 'finished' ? 'SELESAI' : (s.is_suspended ? 'TERJEDA' : (isExpired ? 'WAKTU HABIS' : 'ONGOING'))}
                                        </Badge>
                                    );
                                }
                            },
                            {
                                header: 'Progress',
                                align: 'center',
                                render: (s) => {
                                    const progress = s.total_questions > 0 ? (s.answered_count / s.total_questions) * 100 : 0;
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', minWidth: '100px' }}>
                                            <div style={{ width: '100%', height: '6px', background: theme.surfaceLight, borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: theme.gradPrimary, transition: 'width 0.5s ease' }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: theme.textMuted }}>{s.answered_count} / {s.total_questions}</div>
                                        </div>
                                    );
                                }
                            },
                            {
                                header: 'Waktu Sisa',
                                align: 'center',
                                render: (s) => {
                                    const isExpired = s.status === 'ongoing' && now > new Date(s.end_time);
                                    if (s.status === 'finished') return <span style={{ color: theme.textMuted, fontSize: '0.8rem' }}>Selesai</span>;
                                    if (s.is_suspended) return <span style={{ color: theme.warning, fontWeight: 700 }}>PAUSED</span>;

                                    const timeStr = formatTimeRemaining(s.end_time);
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{
                                                fontSize: '1rem',
                                                fontWeight: 800,
                                                fontFamily: 'monospace',
                                                color: isExpired ? theme.danger : theme.text,
                                                animation: isExpired ? 'pulse-soft 1s infinite' : 'none'
                                            }}>
                                                {timeStr}
                                            </div>
                                            {s.extra_time > 0 && <div style={{ fontSize: '0.65rem', color: theme.success, fontWeight: 800 }}>+{s.extra_time}m</div>}
                                        </div>
                                    );
                                }
                            },
                            {
                                header: 'Pelanggaran',
                                align: 'center',
                                render: (s) => (
                                    <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.6rem', color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>FS</div>
                                            <Badge type={s.fs_violations > 0 ? 'danger' : 'secondary'} style={{ minWidth: '24px', fontSize: '0.7rem', padding: '2px 6px' }}>
                                                {s.fs_violations || 0}
                                            </Badge>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.6rem', color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Tab</div>
                                            <Badge type={s.tab_violations > 0 ? 'warning' : 'secondary'} style={{ minWidth: '24px', fontSize: '0.7rem', padding: '2px 6px' }}>
                                                {s.tab_violations || 0}
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                header: 'Skor',
                                align: 'center',
                                render: (s) => (
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: theme.primary }}>{s.final_score_total || '0'}</div>
                                    </div>
                                )
                            },
                            {
                                header: 'Aksi',
                                align: 'center',
                                render: (s) => {
                                    const isExpired = s.status === 'ongoing' && now > new Date(s.end_time);
                                    return (
                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                            <Button variant="ghost" onClick={() => handleShowSessionReview(s)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>Review</Button>
                                            {s.status === 'ongoing' && (
                                                <>
                                                    {s.is_suspended ? (
                                                        <Button variant="success" onClick={() => handleResume(s.session_id)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>Lanjut</Button>
                                                    ) : (
                                                        <Button variant="warning" onClick={() => handlePause(s.session_id)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>Jeda</Button>
                                                    )}
                                                    <Button variant="outline" onClick={() => handleAddTime(s.session_id)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>+Waktu</Button>
                                                    <Button variant={isExpired ? "warning" : "danger"} onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleForceFinish(s, isExpired);
                                                    }} style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>
                                                        {isExpired ? 'Done' : 'Stop'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    );
                                }
                            }
                        ]}
                        data={paginatedSessions}
                        loading={loading && filteredSessions.length === 0}
                        getRowKey={(s, idx) => s.session_id || s.participant_id || idx}
                        emptyMessage={searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : "Tidak ada sesi ujian aktif saat ini"}
                    />
                </div>

                {/* Pagination UI */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '1.5rem',
                        padding: '1rem 0.5rem 0.5rem 0.5rem',
                        borderTop: `1px solid ${theme.border}`
                    }}>
                        <div style={{ fontSize: '0.8rem', color: theme.textMuted }}>
                            Menampilkan <strong style={{ color: theme.text }}>{paginatedSessions.length}</strong> dari <strong style={{ color: theme.text }}>{filteredSessions.length}</strong> peserta
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                variant="ghost"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                style={{ padding: '0.5rem 1rem', borderRadius: '10px' }}
                            >
                                <Icons.ChevronLeft />
                            </Button>
                            
                            {[...Array(totalPages)].map((_, i) => {
                                const pageNum = i + 1;
                                // Only show current, first, last, and pages around current
                                if (
                                    pageNum === 1 ||
                                    pageNum === totalPages ||
                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: currentPage === pageNum ? theme.gradPrimary : 'transparent',
                                                color: currentPage === pageNum ? 'white' : theme.text,
                                                fontWeight: 800,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                    return <span key={pageNum} style={{ alignSelf: 'center', color: theme.textMuted }}>...</span>;
                                }
                                return null;
                            })}

                            <Button
                                variant="ghost"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                style={{ padding: '0.5rem 1rem', borderRadius: '10px' }}
                            >
                                <Icons.ChevronRight />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                type={confirmState.type}
                confirmText={confirmState.confirmText}
                loading={confirmState.loading}
            />
        </div>
    );
}
