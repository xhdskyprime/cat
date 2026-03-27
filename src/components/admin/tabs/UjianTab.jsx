import React from 'react';
import { Card, Button, Badge, getTheme, DataTable, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function UjianTab({ setModal }) {
    const { exams, loading, theme: mode, API, adminHeaders, showToast, fetchData } = useAdmin();
    const theme = getTheme(mode);

    const handleDeleteExam = async (id, title) => {
        if (!window.confirm(`Yakin ingin menghapus Sesi Ujian "${title}" beserta riwayatnya?`)) return;
        try {
            const res = await API.delete(`/admin/exams/${id}`, { headers: adminHeaders });
            if (res.data.success) {
                showToast('Sesi ujian dihapus', 'success');
                fetchData('exams');
            } else {
                showToast(res.data.error || 'Gagal menghapus', 'error');
            }
        } catch (e) {
            showToast('Terjadi kesalahan koneksi', 'error');
        }
    };


    const parseConfig = (cfg) => {
        try {
            return typeof cfg === 'string' ? JSON.parse(cfg || '{}') : (cfg || {});
        } catch (e) {
            void e;
            return {};
        }
    };

    const columns = [
        {
            header: 'ID Sesi',
            render: (e) => <span style={{ fontFamily: 'monospace', fontWeight: 900, color: theme.primary, background: theme.surfaceLight, padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{e.id}</span>,
            width: '100px',
            align: 'center'
        },
        {
            header: 'Event / Title',
            render: (e) => (
                <div style={{ padding: '0.4rem 0' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: theme.text }}>{e.title}</div>
                    <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>{e.description}</div>
                </div>
            )
        },
        {
            header: 'Token Access',
            render: (e) => <code style={{ letterSpacing: '2px', fontWeight: 900, color: theme.secondary, background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: `1px solid ${theme.border}` }}>{e.token}</code>,
            align: 'center'
        },
        {
            header: 'Durasi',
            render: (e) => <span style={{ fontWeight: 600 }}>{e.duration_minutes} Menit</span>,
            align: 'center'
        },
        {
            header: 'Aturan Kelulusan',
            render: (e) => {
                const cfg = parseConfig(e.config);
                const mode = cfg.score_mode === 'total' ? 'total' : 'category';
                if (mode === 'total') {
                    const pass = Number(cfg.total_pass || 0);
                    const full = Number(cfg.total_full || 0);
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                            <Badge type="info">TOTAL</Badge>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                Lulus ≥ {pass}{full ? ` / ${full}` : ''}
                            </span>
                        </div>
                    );
                }
                const entries = Object.entries(cfg || {})
                    .filter(([k, v]) => k && k !== 'score_mode' && k !== 'total_pass' && k !== 'total_full' && v && typeof v === 'object')
                    .map(([k, v]) => ({ id: k, pass: Number(v.pass || 0) }))
                    .filter(x => x.pass > 0);
                const preview = entries.slice(0, 3).map(x => `${x.id}≥${x.pass}`).join(', ');
                const title = entries.map(x => `${x.id}≥${x.pass}`).join(', ');
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }} title={title || ''}>
                        <Badge type="primary">PER KATEGORI</Badge>
                        <span style={{ fontSize: '0.75rem', color: theme.textMuted, fontWeight: 700 }}>
                            {preview || 'Atur di pengaturan sesi'}
                        </span>
                    </div>
                );
            },
            align: 'center'
        },
        {
            header: 'Status Sesi',
            render: (e) => <Badge type={e.is_active ? 'success' : 'danger'}>{e.is_active ? 'TERBUKA' : 'DITUTUP'}</Badge>,
            align: 'center'
        },
        {
            header: 'Pengumuman',
            render: (e) => (
                <Badge type={e.show_result !== 0 ? 'info' : 'secondary'}>
                    {e.show_result !== 0 ? 'SKOR TAMPIL' : 'SKOR DISEMBUNYIKAN'}
                </Badge>
            ),
            align: 'center'
        },
        {
            header: 'Aksi',
            align: 'right',
            render: (e) => (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <Button variant="outline" onClick={() => {
                        const data = { ...e };
                        if (data.show_result === undefined || data.show_result === null) data.show_result = 1;
                        setModal({ type: 'exam', mode: 'edit', data });
                    }} style={{ scale: '0.9' }}>
                        ⚙️ Pengaturan
                    </Button>
                    <Button variant="outline" onClick={() => handleDeleteExam(e.id, e.title)} style={{ scale: '0.9', color: '#ff4d4f', borderColor: '#ff4d4f' }}>
                        🗑️ Hapus
                    </Button>
                </div>
            )
        }
    ];

    return (
        <Card style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <InfoNote title="Sesi Ujian" style={{ maxWidth: '720px' }}>
                    Atur token akses, durasi, status buka/tutup, serta konfigurasi kategori per sesi. Peserta hanya bisa masuk ke sesi yang dibuka dan sesuai mapping.
                </InfoNote>
                <Button onClick={() => setModal({ type: 'exam', mode: 'add' })}>
                    + Buat Sesi Ujian Baru
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={exams}
                loading={loading}
                emptyMessage="Belum ada sesi ujian yang dibuat."
            />
        </Card>
    );
}
