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
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmState, setConfirmState] = useState({ isOpen: false, type: 'danger', message: '', onConfirm: null, loading: false });

    // Toggle single selection
    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    // Toggle all visible selection
    const toggleSelectAll = () => {
        const visibleIds = filteredParticipants.map(p => p.id);
        const allSelected = visibleIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    const handleBulkReset = () => {
        if (selectedIds.length === 0) return;
        setConfirmState({
            isOpen: true,
            title: `Reset ${selectedIds.length} Sesi Peserta`,
            type: 'warning',
            message: `Apakah Anda yakin ingin me-reset sesi untuk ${selectedIds.length} peserta terpilih? Semua jawaban mereka akan dihapus dan mereka harus memulai dari awal.`,
            confirmText: 'Ya, Reset Semua',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    await axios.post(`${API}/participants/bulk-reset-session`, { ids: selectedIds }, { headers: adminHeaders() });
                    showToast(`${selectedIds.length} Sesi Berhasil Direset`);
                    setSelectedIds([]);
                    fetchData('peserta');
                    setConfirmState({ isOpen: false });
                } catch (_err) {
                    showToast('Gagal reset masal', 'danger');
                    setConfirmState(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;
        setConfirmState({
            isOpen: true,
            title: `Hapus ${selectedIds.length} Peserta`,
            type: 'danger',
            message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} peserta terpilih secara permanen? Seluruh riwayat ujian mereka akan hilang.`,
            confirmText: 'Ya, Hapus Semua',
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    await axios.post(`${API}/participants/bulk-delete`, { ids: selectedIds }, { headers: adminHeaders() });
                    showToast(`${selectedIds.length} Peserta Berhasil Dihapus`);
                    setSelectedIds([]);
                    fetchData('peserta');
                    setConfirmState({ isOpen: false });
                } catch (_err) {
                    showToast('Gagal hapus masal', 'danger');
                    setConfirmState(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

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
            header: (
                <input 
                    type="checkbox" 
                    onChange={toggleSelectAll}
                    checked={filteredParticipants.length > 0 && filteredParticipants.every(p => selectedIds.includes(p.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
            ),
            width: '40px',
            align: 'center',
            render: (p) => (
                <input 
                    type="checkbox" 
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
            )
        },
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
        <Card style={{ padding: '1.5rem', position: 'relative' }}>
            {/* BULK ACTION BAR */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '1.5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    background: theme.isDark ? '#1a1a2e' : 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    border: `1px solid ${theme.primary}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    animation: 'slide-down 0.3s ease-out'
                }}>
                    <div style={{ fontWeight: 800, color: theme.primary }}>{selectedIds.length} Peserta Terpilih</div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button variant="warning" onClick={handleBulkReset} style={{ fontSize: '0.85rem' }}>
                            Reset Sesi ({selectedIds.length})
                        </Button>
                        <Button variant="danger" onClick={handleBulkDelete} style={{ fontSize: '0.85rem' }}>
                            Hapus ({selectedIds.length})
                        </Button>
                        <Button variant="ghost" onClick={() => setSelectedIds([])} style={{ fontSize: '0.85rem' }}>
                            Batal
                        </Button>
                    </div>
                </div>
            )}

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
            
            <style>{`
                @keyframes slide-down {
                    from { transform: translate(-50%, -100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </Card>
    );
}
