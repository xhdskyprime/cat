import React, { useState } from 'react';
import axios from 'axios';
import { Card, Button, Badge, getTheme, DataTable, ConfirmModal, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function MasterTab({ setModal }) {
    const {
        categories, fetchData, API, adminHeaders, showToast, loading, theme: mode
    } = useAdmin();
    const theme = getTheme(mode);

    const [confirmState, setConfirmState] = useState({ isOpen: false, category: null, loading: false });

    const handleDeleteConfirm = async () => {
        setConfirmState(s => ({ ...s, loading: true }));
        try {
            await axios.delete(`${API}/categories/${confirmState.category.id}`, { headers: adminHeaders() });
            showToast('Kategori berhasil dihapus');
            fetchData('master');
            setConfirmState({ isOpen: false, category: null, loading: false });
        } catch (_e) {
            void _e;
            showToast('Gagal hapus kategori', 'danger');
            setConfirmState(s => ({ ...s, loading: false }));
        }
    };

    const columns = [
        {
            header: 'ID / Kode',
            render: (c) => <span style={{ fontWeight: 800, color: theme.secondary }}>{c.id}</span>
        },
        { header: 'Nama Kategori', key: 'name' },
        {
            header: 'Acak Soal',
            render: (c) => (
                <Badge type={c.is_random !== 0 ? 'success' : 'info'}>
                    {c.is_random !== 0 ? '🎲 ACAK' : '⬇️ URUT'}
                </Badge>
            ),
            align: 'center'
        },
        {
            header: 'Order',
            key: 'sort_order',
            align: 'center'
        },
        {
            header: 'Aksi',
            align: 'right',
            render: (c) => (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <Button variant="outline" onClick={() => setModal({ type: 'master', mode: 'edit', data: c })} style={{ scale: '0.8', padding: '0.4rem 0.6rem' }}>
                        Edit
                    </Button>
                    <Button
                        variant="danger"
                        style={{ scale: '0.8', padding: '0.4rem 0.6rem' }}
                        onClick={() => setConfirmState({ isOpen: true, category: c, loading: false })}
                    >
                        X
                    </Button>
                </div>
            )
        }
    ];

    return (
        <>
            <Card style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
                    <InfoNote title="Data Master Kategori" style={{ maxWidth: '720px' }}>
                        Data kategori digunakan untuk pengelompokan soal dan pengaturan acak/urut. Aturan kelulusan dan bobot skor diatur per Sesi Ujian.
                    </InfoNote>
                    <Button onClick={() => setModal({ type: 'master', mode: 'add', data: { id: '', name: '', is_random: 1, sort_order: 0 } })}>
                        + Tambah Kategori Baru
                    </Button>
                </div>

                <DataTable
                    columns={columns}
                    data={categories}
                    loading={loading}
                    emptyMessage="Tidak ada kategori tersedia."
                />
            </Card>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ isOpen: false, category: null, loading: false })}
                onConfirm={handleDeleteConfirm}
                title="Hapus Kategori"
                message={`Kategori "${confirmState.category?.name}" akan dihapus secara permanen beserta semua konfigurasi terkait. Lanjutkan?`}
                loading={confirmState.loading}
            />
        </>
    );
}
