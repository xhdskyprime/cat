import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Card, Button, Badge, getTheme, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const value = n / (1024 ** i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatSeconds = (s) => {
    const n = Math.max(0, Number(s || 0));
    const d = Math.floor(n / 86400);
    const h = Math.floor((n % 86400) / 3600);
    const m = Math.floor((n % 3600) / 60);
    if (d > 0) return `${d}h ${h}j ${m}m`;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
};

export default function OpsTab() {
    const { API, adminHeaders, showToast, theme: mode, socket } = useAdmin();
    const theme = getTheme(mode);

    const [metrics, setMetrics] = useState(null);
    const [status, setStatus] = useState({ ok: true, failCount: 0, lastOkAt: null, lastErrAt: null });
    const [logType, setLogType] = useState('error');
    const [logLines, setLogLines] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [notifEnabled, setNotifEnabled] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
    const lastDownNotifyAtRef = useRef(0);

    const opsAPI = useMemo(() => `${API}/ops`, [API]);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await axios.get(`${opsAPI}/metrics`, { headers: adminHeaders() });
            setMetrics(res.data);
            setStatus(s => ({ ...s, ok: true, failCount: 0, lastOkAt: Date.now() }));
        } catch (_e) {
            void _e;
            setStatus(s => ({ ...s, ok: false, failCount: (s.failCount || 0) + 1, lastErrAt: Date.now() }));
        }
    }, [adminHeaders, opsAPI]);

    const fetchLogs = useCallback(async (type = logType) => {
        setLogsLoading(true);
        try {
            const res = await axios.get(`${opsAPI}/logs`, { headers: adminHeaders(), params: { type, lines: 250 } });
            setLogLines(res.data?.lines || []);
        } catch (_e) {
            void _e;
            showToast('Gagal memuat log', 'error');
        } finally {
            setLogsLoading(false);
        }
    }, [adminHeaders, logType, opsAPI, showToast]);

    const clearLogs = useCallback(async (type = logType) => {
        if (!window.confirm(`Yakin ingin menghapus semua log ${type.toUpperCase()}?`)) return;
        try {
            await axios.post(`${opsAPI}/clear-logs`, { type }, { headers: adminHeaders() });
            showToast(`Log ${type} berhasil dibersihkan`, 'success');
            fetchLogs(type);
        } catch (_e) {
            void _e;
            showToast('Gagal menghapus log', 'error');
        }
    }, [adminHeaders, logType, opsAPI, showToast, fetchLogs]);

    useEffect(() => {
        fetchMetrics();
        fetchLogs('error');
        const id = setInterval(fetchMetrics, 5000);
        return () => clearInterval(id);
    }, [fetchLogs, fetchMetrics]);

    useEffect(() => {
        fetchLogs(logType);
    }, [fetchLogs, logType]);

    useEffect(() => {
        if (status.ok) return;
        if (status.failCount < 2) return;
        const now = Date.now();
        if (now - lastDownNotifyAtRef.current < 20000) return;
        lastDownNotifyAtRef.current = now;
        showToast('Ops: koneksi ke server bermasalah (server down / network)', 'warning');
        if (notifEnabled && typeof Notification !== 'undefined') {
            try {
                new Notification('CAT Ops Alert', { body: 'Koneksi ke server bermasalah (Ops monitor gagal mengambil metrics).' });
            } catch (_e) {
                void _e;
            }
        }
    }, [status.ok, status.failCount, notifEnabled, showToast]);

    useEffect(() => {
        if (!socket) return;
        const handler = (payload) => {
            const msg = payload?.message || 'Ops alert';
            showToast(`Ops: ${msg}`, payload?.level === 'error' ? 'danger' : 'warning');
            if (notifEnabled && typeof Notification !== 'undefined') {
                try {
                    new Notification('CAT Ops Alert', { body: msg });
                } catch (_e) {
                    void _e;
                }
            }
        };
        socket.on('ops_alert', handler);
        return () => {
            socket.off('ops_alert', handler);
        };
    }, [socket, notifEnabled, showToast]);

    const enableNotifications = async () => {
        if (typeof Notification === 'undefined') {
            showToast('Browser tidak mendukung notifikasi', 'warning');
            return;
        }
        try {
            const perm = await Notification.requestPermission();
            setNotifEnabled(perm === 'granted');
            if (perm === 'granted') showToast('Notifikasi diaktifkan', 'success');
            else showToast('Notifikasi ditolak', 'warning');
        } catch (_e) {
            void _e;
            showToast('Gagal meminta izin notifikasi', 'error');
        }
    };

    const sysMemPct = useMemo(() => {
        const total = metrics?.os?.totalmem;
        const free = metrics?.os?.freemem;
        if (!total || !free) return null;
        const used = total - free;
        return Math.min(100, Math.max(0, (used / total) * 100));
    }, [metrics]);

    const procMem = metrics?.processMemory || {};
    const disk = metrics?.disk || null;
    const sockets = metrics?.sockets?.connected;
    const load = metrics?.os?.loadavg || [];
    const cpuCores = metrics?.os?.cpus || 0;

    return (
        <div className="stagger-entry" style={{ display: 'grid', gap: '1.5rem' }}>
            <Card style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ color: theme.primary, fontWeight: 900 }}>Ops Monitor</span>
                            <Badge type={status.ok ? 'success' : 'danger'}>{status.ok ? 'ONLINE' : 'OFFLINE'}</Badge>
                        </h3>
                        <InfoNote title="Monitoring Operasional" style={{ maxWidth: '980px' }}>
                            Menampilkan CPU/RAM/Disk, koneksi socket, kesehatan DB, serta log aplikasi. Gunakan tombol notifikasi untuk alarm cepat jika server bermasalah.
                        </InfoNote>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="outline" onClick={fetchMetrics} disabled={!adminHeaders()?.Authorization}>
                            Refresh Metrics
                        </Button>
                        <Button variant={notifEnabled ? 'success' : 'outline'} onClick={enableNotifications}>
                            {notifEnabled ? 'Notifikasi Aktif' : 'Aktifkan Notifikasi'}
                        </Button>
                    </div>
                </div>
            </Card>

            {!status.ok && status.failCount >= 2 && (
                <Card style={{ padding: '1.5rem', border: `1px solid ${theme.danger}55`, background: theme.isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                            <div style={{ fontWeight: 900, color: theme.danger, fontSize: '1rem' }}>Server tidak terjangkau</div>
                            <div style={{ color: theme.textMuted, fontSize: '0.85rem' }}>
                                Gagal mengambil metrics {status.failCount}x. Cek server backend, firewall, atau jaringan.
                            </div>
                        </div>
                        <Button variant="danger" onClick={fetchMetrics}>Coba Lagi</Button>
                    </div>
                </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Uptime</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>{metrics ? formatSeconds(metrics.node?.uptimeSec) : '—'}</div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>{metrics ? `PID ${metrics.node?.pid}` : '—'}</div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>CPU Load</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                        {metrics ? `${(load[0] ?? 0).toFixed(2)} / ${(load[1] ?? 0).toFixed(2)} / ${(load[2] ?? 0).toFixed(2)}` : '—'}
                    </div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>
                        {metrics ? `${cpuCores} core` : '—'}
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>RAM Sistem</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                        {metrics ? `${formatBytes((metrics.os?.totalmem || 0) - (metrics.os?.freemem || 0))} / ${formatBytes(metrics.os?.totalmem || 0)}` : '—'}
                    </div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>
                        {metrics && sysMemPct !== null ? `${sysMemPct.toFixed(0)}%` : '—'}
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>RAM Proses</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                        {metrics ? `${formatBytes(procMem.rss || 0)}` : '—'}
                    </div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>
                        {metrics ? `Heap ${formatBytes(procMem.heapUsed || 0)} / ${formatBytes(procMem.heapTotal || 0)}` : '—'}
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Disk</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                        {disk ? `${formatBytes(disk.total - (disk.available ?? disk.free))} / ${formatBytes(disk.total)}` : '—'}
                    </div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>
                        {disk ? `Free ${formatBytes(disk.available ?? disk.free)}` : '—'}
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: theme.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>DB</div>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 900 }}>
                        {metrics ? `${metrics.db?.ok ? 'OK' : 'ERR'} · ${Number(metrics.db?.pingMs || 0)}ms` : '—'}
                    </div>
                    <div style={{ marginTop: '0.4rem', color: theme.textMuted, fontSize: '0.85rem' }}>
                        {typeof sockets === 'number' ? `${sockets} socket` : '—'}
                    </div>
                </Card>
            </div>

            <Card style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 900 }}>Logs</div>
                        <Badge type={logType === 'error' ? 'danger' : (logType === 'app' ? 'info' : 'secondary')}>
                            {logType.toUpperCase()}
                        </Badge>
                        <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>
                            {metrics?.ts ? `Terakhir update: ${new Date(metrics.ts).toLocaleString('id-ID')}` : ''}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant={logType === 'error' ? 'danger' : 'outline'} onClick={() => setLogType('error')}>Error</Button>
                        <Button variant={logType === 'app' ? 'primary' : 'outline'} onClick={() => setLogType('app')}>App</Button>
                        <Button variant={logType === 'access' ? 'secondary' : 'outline'} onClick={() => setLogType('access')}>Access</Button>
                        <Button variant="outline" onClick={() => fetchLogs(logType)} disabled={logsLoading}>
                            {logsLoading ? 'Memuat...' : 'Refresh'}
                        </Button>
                        <Button variant="danger" onClick={() => clearLogs(logType)} title="Hapus semua log tipe ini">
                            🗑️ Clear
                        </Button>
                        <Button variant="danger" onClick={() => clearLogs('all')} title="Hapus SEMUA log" style={{ opacity: 0.7 }}>
                            Clear All
                        </Button>
                    </div>
                </div>

                <div style={{
                    marginTop: '1rem',
                    border: `1px solid ${theme.border}`,
                    background: theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: '16px',
                    padding: '1rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.78rem',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    maxHeight: '420px',
                    overflowY: 'auto',
                    color: theme.text
                }}>
                    {logLines.length ? logLines.join('\n') : 'Tidak ada log.'}
                </div>
            </Card>
        </div>
    );
}
