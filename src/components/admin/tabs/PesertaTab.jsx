import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Card, Button, Badge, Input, getTheme, DataTable, ConfirmModal, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function PesertaTab({ setModal, handleDownloadTemplate }) {
    const {
        participants, exams, fetchData, API, adminHeaders, showToast, loading, theme: mode
    } = useAdmin();
    const theme = getTheme(mode);

    const [search, setSearch] = useState('');
    const [confirmState, setConfirmState] = useState({ isOpen: false, type: 'danger', message: '', onConfirm: null, loading: false });

    const filteredParticipants = useMemo(() => {
        if (!search) return participants;
        const lowSearch = search.toLowerCase();
        return participants.filter(p =>
            p.nama?.toLowerCase().includes(lowSearch) ||
            p.nomor_peserta?.toLowerCase().includes(lowSearch) ||
            p.nik?.includes(lowSearch)
        );
    }, [participants, search]);

    const handleResetAction = (p) => {
        setConfirmState({
            isOpen: true,
            title: 'Reset Sesi Peserta',
            type: 'warning',
            message: `Apakah Anda yakin ingin me-reset sesi untuk ${p.nama}? Semua jawaban yang tersimpan akan dihapus dan peserta dapat login ulang dari awal.`,
            confirmText: 'Ya, Reset Sesi',
            onConfirm: () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                axios.post(`${API}/participants/${p.id}/reset-session`, {}, { headers: adminHeaders() })
                    .then(() => {
                        showToast('Sesi Berhasil Direset');
                        fetchData('peserta');
                        setConfirmState({ isOpen: false });
                    })
                    .catch(() => {
                        showToast('Gagal reset', 'danger');
                        setConfirmState(prev => ({ ...prev, loading: false }));
                    });
            }
        });
    };

    const handleDeleteAction = (p) => {
        setConfirmState({
            isOpen: true,
            title: 'Hapus Peserta',
            type: 'danger',
            message: `Hapus peserta ${p.nama}? Data peserta dan seluruh riwayat ujiannya akan hilang permanen.`,
            confirmText: 'Hapus Permanen',
            onConfirm: () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                axios.delete(`${API}/participants/${p.id}`, { headers: adminHeaders() })
                    .then(() => {
                        showToast('Berhasil dihapus');
                        fetchData('peserta');
                        setConfirmState({ isOpen: false });
                    })
                    .catch(() => {
                        showToast('Gagal hapus', 'danger');
                        setConfirmState(prev => ({ ...prev, loading: false }));
                    });
            }
        });
    };

    const columns = [
        {
            header: 'Nama / NIK / ID',
            render: (p) => (
                <div style={{ padding: '0.4rem 0' }}>
                    <div style={{ fontWeight: 600 }}>{p.nama}</div>
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>{p.nik}</div>
                    <div 
                        style={{ 
                            fontSize: '0.65rem', 
                            color: theme.textMuted, 
                            fontFamily: 'monospace', 
                            marginTop: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        onClick={() => {
                            navigator.clipboard.writeText(p.id);
                            showToast('ID Peserta Berhasil Disalin');
                        }}
                        title="Klik untuk salin ID"
                    >
                        ID: {p.id}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    </div>
                </div>
            )
        },
        { header: 'No Ujian', key: 'nomor_peserta' },
        {
            header: 'Mapping Sesi',
            render: (p) => p.exam_title ? <Badge type="info">{p.exam_title}</Badge> : <span style={{ color: theme.textMuted, fontSize: '0.8rem' }}>Semua Sesi</span>
        },
        {
            header: 'Status',
            render: (p) => <Badge type={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
        },
        {
            header: 'Aksi',
            align: 'right',
            render: (p) => (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); setModal({ type: 'participant', mode: 'edit', data: p }); }} style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}>
                        Edit
                    </Button>
                    <Button
                        variant="outline"
                        style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', border: `1px solid ${theme.warning}`, color: theme.warning, minWidth: '70px' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResetAction(p);
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="danger"
                        style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAction(p);
                        }}
                    >
                        X
                    </Button>
                </div>
            )
        }
    ];

    const totalPeserta = Array.isArray(participants) ? participants.length : 0;
    const umumCount = Array.isArray(participants) ? participants.filter(p => !p.exam_id).length : 0;
    const pesertaPerSesi = Array.isArray(exams)
        ? exams.map(ex => ({
            id: ex.id,
            title: ex.title,
            count: participants.filter(p => p.exam_id === ex.id).length
        })).sort((a, b) => b.count - a.count)
        : [];

    return (
        <Card style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ flex: '0 0 320px', maxWidth: '320px' }}>
                    <Input
                        placeholder="Cari peserta..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto', alignItems: 'center' }}>
                    <Button variant="outline" onClick={() => handleDownloadTemplate('participants')}>
                        Template Excel
                    </Button>
                    <Button variant="outline" onClick={() => setModal({ type: 'import', target: 'participants' })}>
                        Import Excel
                    </Button>
                    <Button onClick={() => setModal({ type: 'participant', mode: 'add' })}>
                        + Peserta
                    </Button>
                </div>
            </div>

            <InfoNote title="Manajemen Peserta" style={{ marginBottom: '1rem' }}>
                Gunakan fitur mapping sesi untuk membatasi peserta hanya bisa login pada sesi tertentu. Peserta tanpa mapping (UMUM) dapat ikut ke sesi mana pun yang dibuka.
            </InfoNote>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <Badge type="primary">TOTAL: {totalPeserta}</Badge>
                <Badge type="secondary">UMUM: {umumCount}</Badge>
                {pesertaPerSesi.map((s, i) => (
                    <Badge key={s.id} type={i % 3 === 0 ? 'info' : i % 3 === 1 ? 'success' : 'warning'}>
                        {s.title}: {s.count}
                    </Badge>
                ))}
            </div>

            <DataTable
                columns={columns}
                data={filteredParticipants}
                loading={loading}
                emptyMessage="Tidak ada data peserta."
            />

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
        </Card>
    );
}
