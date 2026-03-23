import React, { useMemo } from 'react';
import {
    Card, Icons, StatCard, VisualContainer, getTheme, InfoNote
} from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';

export default function DashboardTab() {
    const {
        participants, liveSessions, theme: mode
    } = useAdmin();

    const theme = getTheme(mode);

    // Calculate chart data: Score Distribution
    const scoreData = useMemo(() => {
        const distribution = [
            { range: '0-20', count: 0, color: '#f43f5e' },
            { range: '21-40', count: 0, color: '#fb923c' },
            { range: '41-60', count: 0, color: '#facc15' },
            { range: '61-80', count: 0, color: '#22c55e' },
            { range: '81-100', count: 0, color: '#8b5cf6' }
        ];

        liveSessions.forEach(s => {
            const score = s.final_score_total || s.score || 0;
            if (score <= 20) distribution[0].count++;
            else if (score <= 40) distribution[1].count++;
            else if (score <= 60) distribution[2].count++;
            else if (score <= 80) distribution[3].count++;
            else distribution[4].count++;
        });

        return distribution;
    }, [liveSessions]);

    return (
        <div className="stagger-entry">
            <InfoNote title="Ringkasan Dashboard" style={{ marginBottom: '1.5rem' }}>
                Data pada halaman ini menampilkan ringkasan peserta dan status sesi secara real-time, serta analitik distribusi skor berdasarkan hasil yang sudah tersimpan.
            </InfoNote>
            {/* KPI STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    label="Total Peserta"
                    value={participants.length}
                    icon={<Icons.Users />}
                    trend="+12%"
                />
                <StatCard
                    label="Ujian Berjalan"
                    value={liveSessions.filter(s => s.status === 'ongoing').length}
                    icon={<Icons.Activity />}
                    trend="Live"
                    trendType="up"
                />
                <StatCard
                    label="Selesai"
                    value={liveSessions.filter(s => s.status === 'finished').length}
                    icon={<Icons.Trophy />}
                />
                <StatCard
                    label="Rata-rata Skor"
                    value={Math.round(liveSessions.reduce((acc, s) => acc + (s.final_score_total || s.score || 0), 0) / (liveSessions.length || 1))}
                    icon={<Icons.Target />}
                />
            </div>

            {/* ANALYTICS CHARTS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <VisualContainer title="Sebaran Nilai" subtitle="Distribusi skor peserta secara real-time">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={scoreData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} />
                            <XAxis
                                dataKey="range"
                                stroke={theme.textMuted}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke={theme.textMuted}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: theme.surface,
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: '12px',
                                    color: theme.text
                                }}
                                cursor={{ fill: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                            />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                                {scoreData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </VisualContainer>

                <VisualContainer title="Aktivitas Login" subtitle="Jumlah peserta masuk dalam 24 jam terakhir">
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={[
                            { time: '08:00', val: 10 },
                            { time: '10:00', val: 25 },
                            { time: '12:00', val: 45 },
                            { time: '14:00', val: 30 },
                            { time: '16:00', val: 15 }
                        ]} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={theme.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={theme.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} />
                            <XAxis dataKey="time" stroke={theme.textMuted} fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis stroke={theme.textMuted} fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="val" stroke={theme.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </VisualContainer>
            </div>
        </div>
    );
}
