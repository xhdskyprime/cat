import React, { useState } from 'react';
import axios from 'axios';
import { Card, Button, Badge, DataTable, ConfirmModal, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function UsersTab({ setModal }) {
    const {
        adminUsers, fetchData, API, adminHeaders, showToast, adminRole, loading
    } = useAdmin();

    const [confirmState, setConfirmState] = useState({ isOpen: false, user: null });

    if (adminRole !== 'superadmin') return null;

    const handleDeleteAction = async () => {
        const u = confirmState.user;
        if (!u) return;
        try {
            setConfirmState({ ...confirmState, loading: true });
            await axios.delete(`${API}/users/${u.id}`, { headers: adminHeaders() });
            showToast('Admin berhasil dihapus');
            fetchData('users');
            setConfirmState({ isOpen: false, user: null, loading: false });
        } catch (_e) {
            void _e;
            showToast('Gagal hapus admin', 'danger');
            setConfirmState({ ...confirmState, loading: false });
        }
    };

    const columns = [
        {
            header: 'Username',
            render: (u) => <span style={{ fontWeight: 700, fontSize: '1rem' }}>{u.username}</span>
        },
        {
            header: 'Role Access',
            render: (u) => (
                <Badge type={u.role === 'superadmin' ? 'danger' : 'primary'}>
                    {u.role.toUpperCase()}
                </Badge>
            ),
            align: 'center'
        },
        {
            header: 'Aksi',
            align: 'right',
            render: (u) => (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <Button variant="outline" onClick={() => setModal({ type: 'user', mode: 'edit', data: { ...u, password: '' } })} style={{ scale: '0.8', padding: '0.4rem 0.6rem' }}>
                        Edit
                    </Button>
                    {u.username !== 'superadmin' && (
                        <Button
                            variant="danger"
                            style={{ scale: '0.8', padding: '0.4rem 0.6rem' }}
                            onClick={() => setConfirmState({ isOpen: true, user: u })}
                        >
                            X
                        </Button>
                    )}
                </div>
            )
        }
    ];

    return (
        <>
            <Card style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <InfoNote title="Admin Users" style={{ maxWidth: '720px' }}>
                        Kelola akun admin untuk monitoring dan pengaturan sistem. Role superadmin memiliki akses penuh, pengawas hanya monitoring.
                    </InfoNote>
                    <Button onClick={() => setModal({ type: 'user', mode: 'add', data: { username: '', password: '', role: 'pengawas' } })}>
                        + Tambah Admin Baru
                    </Button>
                </div>

                <DataTable
                    columns={columns}
                    data={adminUsers}
                    loading={loading}
                    emptyMessage="Tidak ada user admin lain."
                />
            </Card>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ isOpen: false, user: null })}
                onConfirm={handleDeleteAction}
                title="Hapus Admin"
                message={`Peringatan: Admin ${confirmState.user?.username} akan dihapus secara permanen. Lanjutkan?`}
                loading={confirmState.loading}
            />
        </>
    );
}
