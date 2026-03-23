import React, { useState, useEffect } from 'react';
import { Card, Badge, getTheme, DataTable, Button, Icons, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function AuditTab() {
    const { auditTrail, fetchData, loading, theme: mode } = useAdmin();
    const theme = getTheme(mode);
    const [page, setPage] = useState(1);
    const limit = 50;

    // auditTrail now comes as { data: [], total: 0, page: 1, limit: 50 }
    const logs = auditTrail?.data || [];
    const total = auditTrail?.total || 0;
    const totalPages = Math.ceil(total / limit);

    useEffect(() => {
        fetchData('audit', { page, limit });
    }, [page, fetchData]);

    const columns = [
        {
            header: 'Waktu Aktifitas',
            render: (log) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(log.created_at).toLocaleDateString('id-ID')}</span>
                    <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>{new Date(log.created_at).toLocaleTimeString('id-ID')}</span>
                </div>
            )
        },
        {
            header: 'Operator',
            render: (log) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: theme.primary + '20', color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                        <Icons.Users style={{ width: 12 }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.admin_id}</span>
                </div>
            )
        },
        {
            header: 'Aksi',
            render: (log) => {
                const isDelete = log.action.includes('DELETE');
                const isCreate = log.action.includes('CREATE');
                const isUpdate = log.action.includes('UPDATE');
                return (
                    <Badge type={isDelete ? 'danger' : (isCreate ? 'success' : (isUpdate ? 'warning' : 'info'))}>
                        {log.action}
                    </Badge>
                );
            }
        },
        {
            header: 'Target',
            render: (log) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.target_type}</span>
                    <span style={{ fontSize: '0.7rem', color: theme.textMuted, fontFamily: 'monospace' }}>#{log.target_id}</span>
                </div>
            )
        },
        {
            header: 'Detail Log',
            render: (log) => (
                <div style={{ maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: theme.textMuted }} title={log.details}>
                    {log.details || '-'}
                </div>
            )
        }
    ];

    return (
        <div className="stagger-entry">
            <Card style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Icons.Activity style={{ color: theme.primary }} /> Jejak Audit Sistem
                        </h3>
                        <InfoNote title="Audit Logs" style={{ maxWidth: '720px' }}>
                            Mencatat aktivitas admin seperti create/update/delete untuk membantu pelacakan perubahan dan investigasi bila ada masalah.
                        </InfoNote>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>
                        Menampilkan <b>{logs.length}</b> dari <b>{total}</b> aktifitas
                    </div>
                </div>

                <DataTable
                    columns={columns}
                    data={logs}
                    loading={loading}
                    emptyMessage="Belum ada catatan aktifitas."
                />

                {totalPages > 1 && (
                    <div style={{ padding: '1.5rem', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
                        <Button
                            variant="outline"
                            disabled={page === 1 || loading}
                            onClick={() => setPage(p => p - 1)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            <Icons.Activity style={{ transform: 'rotate(180deg)', marginRight: '8px', width: 14 }} /> Sebelumnya
                        </Button>

                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: theme.textMuted }}>
                            Halaman <span style={{ color: theme.primary }}>{page}</span> dari {totalPages}
                        </div>

                        <Button
                            variant="outline"
                            disabled={page === totalPages || loading}
                            onClick={() => setPage(p => p + 1)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            Selanjutnya <Icons.Activity style={{ marginLeft: '8px', width: 14 }} />
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
