import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

import { io } from 'socket.io-client';

const AdminContext = createContext();

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error('useAdmin must be used within an AdminProvider');
    return context;
};

export const AdminProvider = ({ children, API, adminHeaders }) => {
    const [exams, setExams] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [liveSessions, setLiveSessions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState({});
    const [activeTab, setActiveTabRaw] = useState(localStorage.getItem('admin_active_tab') || 'dashboard');
    const [loading, setLoading] = useState(false);
    const [socket, setSocket] = useState(null);
    const [adminUsername, setAdminUsername] = useState(localStorage.getItem('admin_username') || '');
    const [adminRole, setAdminRole] = useState(localStorage.getItem('admin_role') || 'pengawas');
    const [theme, setTheme] = useState(localStorage.getItem('admin_theme') || 'light');
    const [toast, setToast] = useState(null);
    const [timeOffset, setTimeOffset] = useState(0); // Offset in ms (Server - Client)

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const setActiveTab = (tab) => {
        setActiveTabRaw(tab);
        localStorage.setItem('admin_active_tab', tab);
    };

    // Missing States
    const [questions, setQuestions] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [results, setResults] = useState([]);
    const [auditTrail, setAuditTrail] = useState([]);
    const [templates, setTemplates] = useState([]);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('admin_theme', newTheme);
    }, [theme]);

    const fetchData = useCallback(async (target, params = {}) => {
        const headers = adminHeaders();
        if (!headers || !headers.Authorization) return;

        const isSilent = !!params.silent;
        if (!isSilent) setLoading(true);
        const h = { headers };
        try {
            if (target === 'monitoring' || target === 'dashboard' || !target) {
                const qs = params.examId ? `?examId=${encodeURIComponent(params.examId)}` : '';
                if (isSilent) {
                    const { data: ld } = await axios.get(`${API}/live-monitoring${qs}`, h);
                    setLiveSessions(ld?.sessions || (Array.isArray(ld) ? ld : []));
                    if (ld?.serverNow) setTimeOffset(new Date(ld.serverNow).getTime() - Date.now());
                } else {
                    const [ex, p, live] = await Promise.all([
                        axios.get(`${API}/exams`, h),
                        axios.get(`${API}/participants`, h),
                        axios.get(`${API}/live-monitoring${qs}`, h)
                    ]);
                    setExams(Array.isArray(ex.data) ? ex.data : []);
                    setParticipants(Array.isArray(p.data) ? p.data : []);
                    const ld = live.data;
                    setLiveSessions(ld?.sessions || (Array.isArray(ld) ? ld : []));
                    if (ld?.serverNow) setTimeOffset(new Date(ld.serverNow).getTime() - Date.now());
                }
            }
            if (target === 'soal') {
                const res = await axios.get(`${API}/questions`, h);
                setQuestions(res.data);
            }
            if (target === 'users') {
                const res = await axios.get(`${API}/users`, h);
                setAdminUsers(res.data);
            }
            if (target === 'hasil' || target === 'statistik') {
                const [resExams, resResults] = await Promise.all([
                    axios.get(`${API}/exams`, h),
                    axios.get(`${API}/export-results`, h)
                ]);
                setExams(Array.isArray(resExams.data) ? resExams.data : []);
                setResults(resResults.data);
            }
            if (target === 'audit') {
                const { page = 1, limit = 50 } = params;
                const res = await axios.get(`${API}/audit-logs?page=${page}&limit=${limit}`, h);
                setAuditTrail(res.data);
            }
            if (target === 'peserta') {
                const [resParticipants, resExams] = await Promise.all([
                    axios.get(`${API}/participants`, h),
                    axios.get(`${API}/exams`, h)
                ]);
                setParticipants(resParticipants.data);
                setExams(Array.isArray(resExams.data) ? resExams.data : []);
            }
            if (target === 'ujian') {
                const res = await axios.get(`${API}/exams`, h);
                setExams(res.data);
            }
            if (target === 'master') {
                const res = await axios.get(`${API}/categories`, h);
                setCategories(res.data);
            }
            if (target === 'settings' || target === 'pengaturan') {
                const [resSettings, resTemplates] = await Promise.all([
                    axios.get(`${API}/settings`, h),
                    axios.get(`${API}/appearance-templates`, h)
                ]);
                setSettings(resSettings.data);
                setTemplates(resTemplates.data);
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_role');
                localStorage.removeItem('admin_username');
                window.location.assign('/admin-login');
                return;
            }
            console.error('Fetch error:', err);
            showToast('Gagal sinkronisasi data', 'error');
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [API, adminHeaders, showToast]);

    useEffect(() => {
        if (activeTab && adminHeaders()?.Authorization) {
            // Autoload categories and settings once
            const headers = { headers: adminHeaders() };
            const onAuthFail = (err) => {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_role');
                    localStorage.removeItem('admin_username');
                    window.location.assign('/admin-login');
                }
            };
            axios.get(`${API}/categories`, headers).then(res => setCategories(res.data)).catch(onAuthFail);
            axios.get(`${API}/settings`, headers).then(res => setSettings(res.data)).catch(onAuthFail);
            axios.get(`${API}/appearance-templates`, headers).then(res => setTemplates(res.data)).catch(onAuthFail);
        }
    }, [API, adminHeaders]);

    // Use a ref to track the last fetch time specifically for socket updates
    const lastSocketFetchRef = React.useRef(0);

    useEffect(() => {
        const socketUrl = API.replace('/api/admin', '').replace('/api', '');
        const token = localStorage.getItem('admin_token');
        const s = io(socketUrl, {
            transports: ['websocket'],
            upgrade: false,
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            auth: { token }
        });

        setSocket(s);
        s.on('connect', () => {
            console.log('Socket.io connected (Websocket)');
            s.emit('admin_subscribe');
        });

        s.on('admin_update', (data) => {
            // DEBOUNCE: Don't fetch more than once every 3 seconds to prevent battery/resource drain
            const now = Date.now();
            if (now - lastSocketFetchRef.current < 3000) return;
            lastSocketFetchRef.current = now;

            const isLivePage = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin/live');
            
            if (isLivePage || data?.type === 'SESSION_STARTED' || data?.type === 'SESSION_FINISHED') {
                const examId = localStorage.getItem('live_monitor_exam_id') || undefined;
                fetchData('monitoring', { examId, silent: true });
                return;
            }

            if (activeTab !== 'peserta' && activeTab !== 'hasil') {
                fetchData(activeTab, { silent: true });
            }
        });

        s.on('dashboard_update', (data) => {
            if (data.type === 'ANSWER_UPDATE') {
                setLiveSessions(prev => (prev || []).map(session => {
                    if (session.participant_id === data.participantId) {
                        return {
                            ...session,
                            final_score_total: data.score,
                            category_scores: data.detailedScores || {},
                            answered_count: data.answered_count !== undefined ? data.answered_count : (Number(session.answered_count || 0) + 1)
                        };
                    }
                    return session;
                }));
            }
        });

        s.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        return () => {
            s.off('admin_update');
            s.disconnect();
        };
    }, [API, activeTab, fetchData]);

    const sendBroadcast = useCallback(({ examId, message, type = 'info' }) => {
        if (!socket) return;
        socket.emit('admin_broadcast', { examId, message, type });
        showToast('Pesan berhasil disiarkan');
    }, [socket, showToast]);

    const forceLogout = useCallback((participantId, reason = 'Admin mengakhiri sesi Anda.') => {
        if (!socket) return;
        socket.emit('admin_force_logout', { participantId, reason });
        showToast(participantId ? 'Peserta berhasil dikeluarkan' : 'Semua peserta berhasil dikeluarkan');
    }, [socket, showToast]);

    const updateSettings = async (newSettings) => {
        try {
            const h = { headers: adminHeaders() };
            await axios.put(`${API}/settings`, newSettings, h);
            setSettings(prev => ({ ...prev, ...newSettings }));
            showToast('Pengaturan sistem berhasil diperbarui');
            return true;
        } catch (_err) {
            void _err;
            showToast('Gagal memperbarui pengaturan', 'error');
            return false;
        }
    };

    const value = {
        exams, setExams,
        participants, setParticipants,
        liveSessions, setLiveSessions,
        categories, setCategories,
        settings, setSettings, updateSettings,
        templates, setTemplates,
        loading, setLoading, fetchData,
        activeTab, setActiveTab,
        theme, toggleTheme,
        sendBroadcast, forceLogout,
        adminUsername, setAdminUsername,
        adminRole, setAdminRole,
        questions, setQuestions,
        adminUsers, setAdminUsers,
        results, setResults,
        auditTrail, setAuditTrail,
        socket,
        API, adminHeaders, showToast,
        toast, setToast,
        timeOffset
    };

    return (
        <AdminContext.Provider value={value}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
                    background: toast.type === 'error' || toast.type === 'danger' ? '#ef4444' : (toast.type === 'warning' ? '#f59e0b' : '#10b981'),
                    color: 'white', padding: '1rem 1.5rem', borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    fontWeight: 700, animation: 'slideUp 0.3s ease',
                    minWidth: '280px'
                }}>
                    <div style={{ fontSize: '1.25rem' }}>
                        {toast.type === 'error' || toast.type === 'danger' ? '❌' : (toast.type === 'warning' ? '⚠️' : '✅')}
                    </div>
                    <div>{toast.msg}</div>
                    <button onClick={() => setToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 }}>✕</button>
                    <style>{`
                        @keyframes slideUp { 
                            from { transform: translateY(100%); opacity: 0; } 
                            to { transform: translateY(0); opacity: 1; } 
                        }
                    `}</style>
                </div>
            )}
        </AdminContext.Provider>
    );
};
