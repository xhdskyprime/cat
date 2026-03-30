import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AdminProvider, useAdmin } from '../context/AdminContext';
import { Card, Button, Input, Badge, Icons, getTheme } from '../components/admin/ui/AdminUI';

// Import Tab Components
import DashboardTab from '../components/admin/tabs/DashboardTab';
import PesertaTab from '../components/admin/tabs/PesertaTab';
import UsersTab from '../components/admin/tabs/UsersTab';
import SoalTab from '../components/admin/tabs/SoalTab';
import UjianTab from '../components/admin/tabs/UjianTab';
import MasterTab from '../components/admin/tabs/MasterTab';
import HasilTab from '../components/admin/tabs/HasilTab';
import AuditTab from '../components/admin/tabs/AuditTab';
import SettingsTab from '../components/admin/tabs/SettingsTab';
import OpsTab from '../components/admin/tabs/OpsTab';

const API = `${import.meta.env.VITE_API_URL}/api/admin`;

export default function AdminDashboardWrapper() {
    const navigate = useNavigate();
    const token = localStorage.getItem('admin_token');

    useEffect(() => {
        if (!token) {
            navigate('/admin-login');
        }
    }, [token, navigate]);

    const adminHeaders = useCallback(() => {
        const t = localStorage.getItem('admin_token');
        if (!t) return {};
        return { Authorization: `Bearer ${t}` };
    }, []);

    if (!token) return null;

    return (
        <AdminProvider API={API} adminHeaders={adminHeaders}>
            <AdminDashboard />
        </AdminProvider>
    );
}

function AdminDashboard() {
    const navigate = useNavigate();
    const {
        exams, fetchData, activeTab, setActiveTab,
        categories,
        adminRole, loading, setLoading, adminHeaders,
        theme: mode, toggleTheme, showToast,
        settings
    } = useAdmin();

    const theme = getTheme(mode);

    const [modal, setModal] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_username');
        navigate('/admin-login');
    }, [navigate]);

    // Use context fetchData
    useEffect(() => {
        fetchData(activeTab);
        const timer = setInterval(() => {
            if (activeTab === 'dashboard') fetchData(activeTab);
        }, 10000);
        return () => clearInterval(timer);
    }, [fetchData, activeTab]);

    const handleDownloadTemplate = async (target) => {
        try {
            const endpoint = target === 'participants' ? 'template-participants' : 'template-questions';
            const response = await axios.get(`${API}/${endpoint}`, {
                headers: adminHeaders(),
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `template_${target === 'participants' ? 'peserta' : 'soal'}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            showToast('Gagal mengunduh template', 'error');
            console.error(e);
        }
    };

    const handleShowSessionReview = useCallback(async (session) => {
        if (!session?.session_id) {
            showToast('ID Sesi tidak ditemukan', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API}/sessions/${session.session_id}/review`, { headers: adminHeaders() });
            setModal({
                type: 'sessionReview',
                title: `Review Hasil: ${session.nama}`,
                participant: session,
                data: res.data
            });
        } catch (_err) {
            void _err;
            showToast("Gagal memuat review sesi", "danger");
        } finally {
            setLoading(false);
        }
    }, [adminHeaders]);

    const allSidebarItems = [
        { id: 'live', label: 'Live Monitoring', icon: <Icons.Activity />, roles: ['superadmin', 'pengawas'], isExternal: true },
        { id: 'dashboard', label: 'Dashboard', icon: <Icons.Dashboard />, roles: ['superadmin', 'pengawas'] },
        { id: 'hasil', label: 'Hasil Ujian', icon: <Icons.Trophy />, roles: ['superadmin', 'pengawas'] },
        { id: 'peserta', label: 'Peserta', icon: <Icons.Users />, roles: ['superadmin', 'pengawas'] },
        {
            id: 'master', label: 'Master Data', icon: <Icons.Database />, roles: ['superadmin', 'pengawas'], subItems: [
                { id: 'master', label: 'Kategori Soal', icon: <Icons.Database />, roles: ['superadmin'] },
                { id: 'soal', label: 'Bank Soal', icon: <Icons.Book />, roles: ['superadmin'] },
                { id: 'ujian', label: 'Sesi Ujian', icon: <Icons.Target />, roles: ['superadmin', 'pengawas'] }
            ]
        },
        {
            id: 'pengaturan', label: 'Settings & Logs', icon: <Icons.Settings />, roles: ['superadmin'], subItems: [
                { id: 'users', label: 'Admin Users', icon: <Icons.Users />, roles: ['superadmin'] },
                { id: 'ops', label: 'Ops Monitor', icon: <Icons.Activity />, roles: ['superadmin'] },
                { id: 'pengaturan', label: 'General Settings', icon: <Icons.Settings />, roles: ['superadmin'] },
                { id: 'audit', label: 'Audit Logs', icon: <Icons.History />, roles: ['superadmin'] }
            ]
        }
    ];

    const sidebarItems = allSidebarItems.filter(item => item.roles.includes(adminRole));

    const activeItem = useMemo(() => {
        let found = null;
        sidebarItems.forEach(item => {
            if (item.id === activeTab) found = item;
            if (item.subItems) {
                const sub = item.subItems.find(s => s.id === activeTab);
                if (sub) found = sub;
            }
        });
        return found;
    }, [sidebarItems, activeTab]);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent', color: theme.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {/* Mobile Sidebar Trigger */}
            <div style={{
                position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000
            }} className="mobile-only-flex">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{
                        width: '60px', height: '60px', borderRadius: '30px', padding: 0,
                        background: theme.gradPrimary, color: 'white', border: 'none',
                        boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                >
                    {isSidebarOpen ? '✕' : <Icons.Menu />}
                </button>
            </div>

            <style>{`
                .mobile-only-flex { display: none; }
                @media (max-width: 1024px) {
                    .mobile-only-flex { display: flex; }
                    .hide-on-mobile { display: none !important; }
                    .sidebar-responsive {
                        position: fixed !important;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        z-index: 1000;
                        transform: ${isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)'};
                        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                        width: 280px !important;
                    }
                    .main-content-responsive {
                        margin-left: 0 !important;
                        padding: 1.5rem !important;
                    }
                }
                @media (min-width: 1025px) {
                    .sidebar-responsive {
                        width: ${isCollapsed ? '90px' : '280px'} !important;
                    }
                }
                .sidebar-responsive {
                    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                /* Advanced Animations */
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .animate-scale-up { animation: scaleUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                
                .stagger-entry > * { opacity: 0; animation: slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                .stagger-entry > *:nth-child(1) { animation-delay: 0.05s; }
                .stagger-entry > *:nth-child(2) { animation-delay: 0.1s; }
                .stagger-entry > *:nth-child(3) { animation-delay: 0.15s; }
                .stagger-entry > *:nth-child(4) { animation-delay: 0.2s; }
                .stagger-entry > *:nth-child(5) { animation-delay: 0.25s; }
                .stagger-entry > *:nth-child(6) { animation-delay: 0.3s; }
                
                .card-hover:hover {
                    transform: translateY(-5px) scale(1.01);
                    box-shadow: 0 25px 40px -15px rgba(0, 0, 0, 0.4) !important;
                    border-color: ${theme.primary}40 !important;
                }
                
                .nav-item {
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }
                .nav-item::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 0;
                    height: 2px;
                    background: ${theme.gradPrimary};
                    transition: width 0.3s ease;
                }
                .nav-item.active::after { width: 100%; }
                
                .glass-pan {
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    background: ${theme.glass};
                }
                
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${theme.surfaceLight}; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: ${theme.textMuted}; }
            `}</style>

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999 }}
                />
            )}

            {/* SIDEBAR */}
            <aside className="sidebar-responsive" style={{ background: theme.surface, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, width: isCollapsed ? '80px' : '280px', overflow: 'hidden' }}>
                <div style={{ padding: isCollapsed ? '2rem 1rem' : '2rem', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', transition: 'padding 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 40, height: 40, background: theme.primary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>C</div>
                        {!isCollapsed && <h1 style={{ fontSize: '1.25rem', margin: 0, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>CAT ADMIN</h1>}
                    </div>
                    {!isCollapsed && (
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="hide-on-mobile"
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: 'none', color: theme.textMuted,
                                borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', display: 'flex'
                            }}
                        >
                            <Icons.ChevronLeft />
                        </button>
                    )}
                </div>

                {isCollapsed && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }} className="hide-on-mobile">
                        <button
                            onClick={() => setIsCollapsed(false)}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: 'none', color: theme.textMuted,
                                borderRadius: '8px', padding: '0.4rem', cursor: 'pointer'
                            }}
                        >
                            <Icons.ChevronRight />
                        </button>
                    </div>
                )}

                <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto' }}>
                    {sidebarItems.map(item => {
                        const isAnySubActive = item.subItems?.some(sub => sub.id === activeTab);
                        const isGroupActive = activeTab === item.id || isAnySubActive;

                        return (
                            <div key={item.id}>
                                <button
                                    onClick={() => {
                                        if (item.isExternal) {
                                            navigate('/admin/live');
                                        } else {
                                            setActiveTab(item.id);
                                        }
                                        setIsSidebarOpen(false);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                        padding: '0.85rem 1rem', borderRadius: '14px', border: 'none',
                                        background: isGroupActive ? (theme.isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)') : 'transparent',
                                        color: isGroupActive ? theme.primary : theme.textMuted,
                                        cursor: 'pointer', transition: 'all 0.2s', width: '100%',
                                        textAlign: 'left', fontWeight: isGroupActive ? 700 : 500
                                    }}
                                >
                                    <div style={{ color: isGroupActive ? theme.primary : theme.textMuted }}>{item.icon}</div>
                                    {!isCollapsed && <span style={{ fontSize: '0.9rem' }}>{item.label}</span>}
                                    {isGroupActive && !isCollapsed && (
                                        <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: theme.primary }} />
                                    )}
                                </button>

                                {item.subItems && !isCollapsed && isGroupActive && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem 0 0.5rem 2.5rem' }}>
                                        {item.subItems
                                            .filter(sub => sub.roles ? sub.roles.includes(adminRole) : true)
                                            .map(sub => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => { setActiveTab(sub.id); setIsSidebarOpen(false); }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                        padding: '0.5rem 0.75rem', borderRadius: '10px', border: 'none',
                                                        background: activeTab === sub.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                        color: activeTab === sub.id ? theme.primary : theme.textMuted,
                                                        cursor: 'pointer', transition: 'all 0.2s', width: '100%',
                                                        textAlign: 'left', fontSize: '0.8rem', fontWeight: activeTab === sub.id ? 700 : 500
                                                    }}
                                                >
                                                    <span style={{ opacity: 0.7 }}>{sub.label}</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div style={{ padding: '0.75rem', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                        onClick={toggleTheme}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            padding: '0.75rem 1rem', borderRadius: '12px', border: 'none',
                            background: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            color: theme.text, cursor: 'pointer', transition: 'all 0.2s', width: '100%'
                        }}
                    >
                        <div style={{ width: 22 }}>{theme.isDark ? '☀️' : '🌙'}</div>
                        {!isCollapsed && <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{theme.isDark ? 'Light' : 'Dark'} Mode</span>}
                    </button>
                </div>

                <div style={{ padding: '1rem', borderTop: `1px solid ${theme.border}` }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem 1rem', borderRadius: '12px',
                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                            border: 'none', cursor: 'pointer', fontWeight: 600,
                            justifyContent: isCollapsed ? 'center' : 'flex-start'
                        }}
                    >
                        <Icons.Logout />
                        {!isCollapsed && <span>Keluar</span>}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="main-content-responsive" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '2.5rem',
                background: theme.isDark
                    ? `radial-gradient(circle at 50% 50%, ${theme.surface} 0%, ${theme.bg} 100%)`
                    : theme.bg,
                position: 'relative'
            }}>
                {/* Subtle Batik Overlay */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url("/batik.png")', backgroundSize: '500px',
                    opacity: theme.isDark ? 0.02 : 0.04, mixBlendMode: 'overlay', pointerEvents: 'none',
                    zIndex: 0
                }} />
                {/* Loading Overlay */}
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                        <div className="spinner" />
                    </div>
                )}
                <header style={{ marginBottom: '3rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.8s ease' }}>
                    <div className="animate-slide-up">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <Badge type="success" style={{ animation: 'pulse-soft 2s infinite' }}>System Live</Badge>
                            <span style={{ fontSize: '0.8rem', color: theme.textMuted, fontWeight: 500 }}>{settings?.app_version_label || 'v2.5'}</span>
                        </div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', margin: 0, color: theme.text }}>
                            {activeItem?.label || 'Dashboard'}
                        </h2>
                    </div>
                </header>

                {/* TAB CONTENT */}
                {activeTab === 'live' && <div style={{ textAlign: 'center', padding: '4rem' }}><Button onClick={() => navigate('/admin/live')}>Buka Monitoring Live</Button></div>}
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'peserta' && <PesertaTab setModal={setModal} handleDownloadTemplate={handleDownloadTemplate} />}
                {activeTab === 'users' && adminRole === 'superadmin' && <UsersTab setModal={setModal} />}
                {activeTab === 'soal' && <SoalTab setModal={setModal} />}
                {activeTab === 'ujian' && <UjianTab setModal={setModal} />}
                {activeTab === 'master' && <MasterTab setModal={setModal} />}
                {activeTab === 'hasil' && <HasilTab handleShowSessionReview={handleShowSessionReview} />}
                {activeTab === 'audit' && adminRole === 'superadmin' && <AuditTab />}
                {activeTab === 'ops' && adminRole === 'superadmin' && <OpsTab />}
                {activeTab === 'pengaturan' && adminRole === 'superadmin' && <SettingsTab setModal={setModal} />}
            </main >

            {/* MODAL SYSTEM */}
            {
                modal && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(10px)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                        animation: 'fadeIn 0.2s ease'
                    }} onClick={() => { setModal(null); setImportFile(null); }}>
                        <div style={{
                            background: theme.surface, border: `1px solid ${theme.border}`,
                            borderRadius: '24px', width: '100%', maxWidth: modal.type === 'question' ? '800px' : '500px',
                            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            animation: 'slideUp 0.3s ease'
                        }} onClick={e => e.stopPropagation()}>

                            {/* Modal Header */}
                            <div style={{ padding: '1.5rem 2rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, color: theme.text, fontSize: '1.25rem' }}>
                                    {
                                        modal.type === 'participant' ? (modal.mode === 'add' ? 'Tambah Peserta' : 'Edit Peserta') :
                                            modal.type === 'question' ? (modal.mode === 'add' ? 'Tambah Soal' : 'Edit Soal') :
                                                modal.type === 'exam' ? (modal.mode === 'add' ? 'Sesi Baru' : 'Edit Sesi') :
                                                    modal.type === 'master' ? (modal.mode === 'add' ? 'Tambah Kategori' : 'Edit Kategori') :
                                                        modal.type === 'user' ? (modal.mode === 'add' ? 'Tambah User' : 'Edit User') :
                                                            modal.type === 'sessionReview' ? `Review Hasil: ${modal.participant?.nama}` :
                                                                'Import Data Excel'
                                    }
                                </h3>
                                <button onClick={() => { setModal(null); setImportFile(null); }} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                                {modal.type === 'participant' && (
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>NAMA LENGKAP</label>
                                            <Input placeholder="Contoh: Lutfi Legacy" value={modal.data?.nama || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, nama: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>NIK (16 DIGIT)</label>
                                            <Input placeholder="NIK" value={modal.data?.nik || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, nik: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>NOMOR PESERTA</label>
                                            <Input placeholder="Nomor Ujian" value={modal.data?.nomor_peserta || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, nomor_peserta: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>MAPPING SESI</label>
                                            <select value={modal.data?.exam_id || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, exam_id: e.target.value } })} style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.75rem', color: theme.text, borderRadius: '12px', width: '100%' }}>
                                                <option value="">-- Bebas (Bisa Login Dimana Saja) --</option>
                                                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                                            </select>
                                        </div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={modal.data?.is_active} onChange={e => setModal({ ...modal, data: { ...modal.data, is_active: e.target.checked } })} />
                                            <span>Status Aktif (Bisa Login)</span>
                                        </label>
                                    </div>
                                )}

                                {modal.type === 'user' && (
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>USERNAME</label>
                                            <Input placeholder="Username Admin" value={modal.data?.username || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, username: e.target.value } })} disabled={modal.mode === 'edit' && modal.data?.username === 'superadmin'} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>PASSWORD {modal.mode === 'edit' ? '(Kosongkan jika tidak ubah)' : ''}</label>
                                            <Input type="password" placeholder="Password" value={modal.data?.password || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, password: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>ROLE</label>
                                            <select value={modal.data?.role || 'pengawas'} onChange={e => setModal({ ...modal, data: { ...modal.data, role: e.target.value } })} disabled={modal.data?.username === 'superadmin'} style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.75rem', color: theme.text, borderRadius: '12px', width: '100%' }}>
                                                <option value="pengawas">Pengawas (Monitoring Saja)</option>
                                                <option value="superadmin">Superadmin (Akses Penuh)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {modal.type === 'question' && (
                                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>KATEGORI</label>
                                                <select value={modal.data?.category || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, category: e.target.value } })} style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.75rem', color: theme.text, borderRadius: '12px', width: '100%' }}>
                                                    <option value="" disabled>Pilih Kategori</option>
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.id} - {c.name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>IMAGE URL (Opsional)</label>
                                                <Input
                                                    placeholder="https://example.com/image.jpg"
                                                    value={modal.data?.image_url || ''}
                                                    onChange={e => setModal({ ...modal, data: { ...modal.data, image_url: e.target.value } })}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>AUDIO URL (Opsional)</label>
                                                <Input
                                                    placeholder="https://example.com/audio.mp3"
                                                    value={modal.data?.audio_url || ''}
                                                    onChange={e => setModal({ ...modal, data: { ...modal.data, audio_url: e.target.value } })}
                                                />
                                            </div>
                                        </div>

                                        {modal.data?.image_url && (
                                            <div style={{
                                                width: '100%', height: '200px', borderRadius: '16px', overflow: 'hidden',
                                                border: `1px solid ${theme.border}`, position: 'relative', background: theme.bg
                                            }}>
                                                <img
                                                    src={modal.data.image_url}
                                                    alt="Preview"
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>ISI PERTANYAAN</label>
                                            <textarea placeholder="Ketik soal di sini..." value={modal.data?.content || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, content: e.target.value } })} style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '1rem', color: theme.text, borderRadius: '12px', minHeight: '120px', width: '100%', fontSize: '0.95rem', lineHeight: 1.5, fontFamily: 'inherit' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '1rem', fontWeight: 600 }}>PILIHAN JAWABAN (Pilih 1 Jawaban Benar)</label>
                                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                {(modal.data?.options || []).map((opt, i) => (
                                                    <div key={opt.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <div 
                                                            onClick={() => {
                                                                const options = (modal.data?.options || []).map(o => ({ ...o, score: o.id === opt.id ? 1 : 0 }));
                                                                setModal({ ...modal, data: { ...modal.data, options } });
                                                            }}
                                                            style={{ 
                                                                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                                background: opt.score > 0 ? theme.success : theme.surfaceLight, 
                                                                borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800, 
                                                                color: opt.score > 0 ? 'white' : theme.primary,
                                                                cursor: 'pointer', transition: 'all 0.2s', border: `1px solid ${opt.score > 0 ? theme.success : theme.border}`
                                                            }}>
                                                            {opt.id}
                                                        </div>
                                                        <Input placeholder={`Teks Pilihan ${opt.id}`} value={opt.text} onChange={e => {
                                                            const options = [...(modal.data?.options || [])];
                                                            options[i] = { ...options[i], text: e.target.value };
                                                            setModal({ ...modal, data: { ...modal.data, options } });
                                                        }} />
                                                        <Button 
                                                            variant={opt.score > 0 ? 'success' : 'outline'}
                                                            onClick={() => {
                                                                const options = (modal.data?.options || []).map(o => ({ ...o, score: o.id === opt.id ? 1 : 0 }));
                                                                setModal({ ...modal, data: { ...modal.data, options } });
                                                            }}
                                                            style={{ fontSize: '0.7rem', minWidth: '90px' }}
                                                        >
                                                            {opt.score > 0 ? '✓ Benar' : 'Salah'}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {modal.type === 'import' && (
                                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                                        <h4 style={{ color: theme.text, marginBottom: '0.5rem' }}>Import dari Excel ({modal.target})</h4>
                                        <p style={{ color: theme.textMuted, fontSize: '0.875rem', marginBottom: '2rem' }}>Pastikan file .xlsx Anda sesuai dengan template yang disediakan.</p>



                                        {!importFile ? (
                                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600, textAlign: 'left' }}>TARGET SESI UJIAN (Opsional)</label>
                                                    <select
                                                        value={modal.data?.exam_id || ''}
                                                        onChange={e => setModal({ ...modal, data: { ...modal.data, exam_id: e.target.value } })}
                                                        style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.75rem', color: theme.text, borderRadius: '12px', width: '100%', outline: 'none' }}
                                                    >
                                                        <option value="">-- Pilih Sesi (Default: Sesi Aktif Pertama) --</option>
                                                        {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title} ({ex.id})</option>)}
                                                    </select>
                                                </div>

                                                <label style={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                    padding: '3rem 2rem', border: `2px dashed ${theme.border}`,
                                                    borderRadius: '24px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)',
                                                    transition: 'all 0.3s ease',
                                                    borderWidth: '2px'
                                                }} onMouseEnter={e => e.currentTarget.style.borderColor = theme.primary} onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                                                    <input type="file" accept=".xlsx" onChange={e => setImportFile(e.target.files[0])} style={{ display: 'none' }} />
                                                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📁</div>
                                                    <span style={{ color: theme.primary, fontWeight: 700, fontSize: '1rem' }}>Pilih File Excel</span>
                                                    <span style={{ color: theme.textMuted, fontSize: '0.75rem', marginTop: '0.5rem' }}>Klik untuk mencari file</span>
                                                </label>
                                            </div>
                                        ) : (

                                            <div style={{ background: theme.surfaceLight, padding: '1.5rem', borderRadius: '16px', border: `1px solid ${theme.primary}` }}>
                                                <div style={{ fontSize: '0.9rem', color: theme.text, fontWeight: 600, marginBottom: '0.5rem' }}>{importFile.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>{(importFile.size / 1024).toFixed(1)} KB</div>
                                                <Button variant="ghost" onClick={() => setImportFile(null)} style={{ marginTop: '1rem', fontSize: '0.75rem', color: theme.danger }}>Ganti File</Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {modal.type === 'master' && (
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>KODE (ID)</label>
                                            <Input placeholder="CONTOH: TWK" value={modal.data?.id || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, id: e.target.value.toUpperCase() } })} disabled={modal.mode === 'edit'} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>NAMA KATEGORI</label>
                                            <Input placeholder="Nama Lengkap Kategori" value={modal.data?.name || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, name: e.target.value } })} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
                                                <input type="checkbox" checked={modal.data?.is_random !== 0} onChange={e => setModal({ ...modal, data: { ...modal.data, is_random: e.target.checked ? 1 : 0 } })} style={{ width: '1.2rem', height: '1.2rem' }} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Acak Soal (Shuffle)</span>
                                            </label>
                                        </div>
                                        <div style={{ marginTop: '1rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>URUTAN TAMPIL</label>
                                            <Input type="number" value={modal.data?.sort_order || 0} onChange={e => setModal({ ...modal, data: { ...modal.data, sort_order: Number(e.target.value) } })} />
                                        </div>
                                    </div>
                                )}

                                {modal.type === 'exam' && (
                                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>JUDUL UJIAN</label>
                                            <Input placeholder="Simulasi CAT Gelombang 1" value={modal.data?.title || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, title: e.target.value } })} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>TOKEN / PIN MASUK</label>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Input
                                                        placeholder="TOKEN"
                                                        value={modal.data?.token || ''}
                                                        onChange={e => setModal({ ...modal, data: { ...modal.data, token: e.target.value.toUpperCase() } })}
                                                        style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '2px' }}
                                                    />
                                                    <Button variant="ghost" onClick={() => {
                                                        const randToken = Math.random().toString(36).substring(2, 8).toUpperCase();
                                                        setModal({ ...modal, data: { ...modal.data, token: randToken } });
                                                    }} title="Generate PIN Baru">🎲</Button>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>DURASI (MENIT)</label>
                                                <Input type="number" value={modal.data?.duration_minutes || 100} onChange={e => setModal({ ...modal, data: { ...modal.data, duration_minutes: Number(e.target.value) } })} />
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <label style={{ fontSize: '0.75rem', color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Konfigurasi & Aturan Kelulusan</label>
                                                <div style={{ display: 'flex', gap: '0.5rem', background: theme.surfaceLight, padding: '4px', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                                                    <button
                                                        onClick={() => {
                                                            const newConfig = typeof modal.data?.config === 'string' ? JSON.parse(modal.data.config || '{}') : (modal.data?.config || {});
                                                            newConfig.score_mode = 'category';
                                                            setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                        }}
                                                        style={{
                                                            padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                                            background: (modal.data?.config?.score_mode !== 'total') ? theme.gradPrimary : 'transparent',
                                                            color: (modal.data?.config?.score_mode !== 'total') ? 'white' : theme.textMuted
                                                        }}>Per Kategori</button>
                                                    <button
                                                        onClick={() => {
                                                            const newConfig = typeof modal.data?.config === 'string' ? JSON.parse(modal.data.config || '{}') : (modal.data?.config || {});
                                                            newConfig.score_mode = 'total';
                                                            if (!newConfig.total_pass) newConfig.total_pass = 50;
                                                            if (!newConfig.total_full) newConfig.total_full = 100;
                                                            setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                        }}
                                                        style={{
                                                            padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                                            background: (modal.data?.config?.score_mode === 'total') ? theme.gradPrimary : 'transparent',
                                                            color: (modal.data?.config?.score_mode === 'total') ? 'white' : theme.textMuted
                                                        }}>Skor Total</button>
                                                </div>
                                            </div>

                                            {modal.data?.config?.score_mode === 'total' && (
                                                <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', borderColor: theme.primary + '40' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.7rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 700 }}>PASSING GRADE TOTAL</label>
                                                            <Input
                                                                type="number"
                                                                value={modal.data.config.total_pass || 0}
                                                                onChange={e => setModal({ ...modal, data: { ...modal.data, config: { ...modal.data.config, total_pass: Number(e.target.value) } } })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.7rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 700 }}>FULL SCORE TOTAL</label>
                                                            <Input
                                                                type="number"
                                                                value={modal.data.config.total_full || 0}
                                                                onChange={e => setModal({ ...modal, data: { ...modal.data, config: { ...modal.data.config, total_full: Number(e.target.value) } } })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: theme.textMuted }}>* Dalam mode ini, bobot per soal otomatis dihitung dari (Full Score Total / Jumlah Seluruh Soal).</p>
                                                </Card>
                                            )}

                                            <div style={{ display: 'grid', gap: '1rem' }}>
                                                {categories.map(cat => {
                                                    const currentConfig = typeof modal.data?.config === 'string'
                                                        ? JSON.parse(modal.data.config || '{}')
                                                        : (modal.data?.config || {});

                                                    const isEnabled = currentConfig[cat.id] !== undefined;
                                                    const configData = typeof currentConfig[cat.id] === 'object'
                                                        ? currentConfig[cat.id]
                                                        : { count: Number(currentConfig[cat.id]) || 0, pass: 0, full: 100 };

                                                    return (
                                                        <Card key={cat.id} style={{
                                                            padding: '1rem 1.25rem',
                                                            background: isEnabled ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                                                            border: `1px solid ${isEnabled ? theme.primary + '30' : theme.border}`,
                                                            opacity: isEnabled ? 1 : 0.7
                                                        }}>
                                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: (isEnabled && currentConfig.score_mode !== 'total') ? '1.25rem' : (isEnabled ? '0.5rem' : 0) }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, cursor: 'pointer' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isEnabled}
                                                                        onChange={e => {
                                                                            const newConfig = { ...currentConfig };
                                                                            if (e.target.checked) {
                                                                                newConfig[cat.id] = { count: 30, pass: cat.passing_grade || 0, full: cat.full_score || 0 };
                                                                            } else {
                                                                                delete newConfig[cat.id];
                                                                            }
                                                                            setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                                        }}
                                                                        style={{ width: '1.1rem', height: '1.1rem' }}
                                                                    />
                                                                    <span style={{ fontSize: '1rem', fontWeight: 800, color: isEnabled ? theme.primary : theme.text }}>{cat.name}</span>
                                                                    <Badge type="secondary" style={{ fontSize: '0.65rem' }}>{cat.id}</Badge>
                                                                </label>
                                                                {isEnabled && currentConfig.score_mode === 'total' && (
                                                                    <div style={{ width: '120px' }}>
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="Jumlah Soal"
                                                                            value={configData.count}
                                                                            onChange={e => {
                                                                                const newConfig = { ...currentConfig, [cat.id]: { ...configData, count: Number(e.target.value) } };
                                                                                setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                                            }}
                                                                            style={{ height: '32px', fontSize: '0.8rem' }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {isEnabled && currentConfig.score_mode !== 'total' && (
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '0.65rem', color: theme.textMuted, marginBottom: '0.3rem', fontWeight: 700 }}>JUMLAH SOAL</label>
                                                                        <Input
                                                                            type="number"
                                                                            value={configData.count}
                                                                            onChange={e => {
                                                                                const newConfig = { ...currentConfig, [cat.id]: { ...configData, count: Number(e.target.value) } };
                                                                                setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                                            }}
                                                                            style={{ height: '36px', fontSize: '0.85rem' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '0.65rem', color: theme.textMuted, marginBottom: '0.3rem', fontWeight: 700 }}>PASS. GRADE</label>
                                                                        <Input
                                                                            type="number"
                                                                            value={configData.pass}
                                                                            onChange={e => {
                                                                                const newConfig = { ...currentConfig, [cat.id]: { ...configData, pass: Number(e.target.value) } };
                                                                                setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                                            }}
                                                                            style={{ height: '36px', fontSize: '0.85rem' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '0.65rem', color: theme.textMuted, marginBottom: '0.3rem', fontWeight: 700 }}>FULL SCORE</label>
                                                                        <Input
                                                                            type="number"
                                                                            value={configData.full}
                                                                            onChange={e => {
                                                                                const newConfig = { ...currentConfig, [cat.id]: { ...configData, full: Number(e.target.value) } };
                                                                                setModal({ ...modal, data: { ...modal.data, config: newConfig } });
                                                                            }}
                                                                            style={{ height: '36px', fontSize: '0.85rem' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                            <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: theme.textMuted, background: 'rgba(0,0,0,0.05)', padding: '0.75rem', borderRadius: '8px', borderLeft: `3px solid ${theme.primary}` }}>
                                                💡 {modal.data?.config?.score_mode === 'total' ? 'Mode Skor Total Aktif. Kelulusan hanya ditentukan dari total poin minimal yang didapat.' : 'Mode Per Kategori Aktif. Peserta wajib melewati Passing Grade tiap kategori.'}
                                            </p>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: theme.textMuted, marginBottom: '0.5rem', fontWeight: 600 }}>DESKRIPSI (OPSIONAL)</label>
                                            <textarea placeholder="Keterangan ujian..." value={modal.data?.description || ''} onChange={e => setModal({ ...modal, data: { ...modal.data, description: e.target.value } })} style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.75rem', color: theme.text, borderRadius: '12px', width: '100%', minHeight: '80px', fontFamily: 'inherit' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={modal.data?.is_active} onChange={e => setModal({ ...modal, data: { ...modal.data, is_active: e.target.checked } })} />
                                                <span style={{ fontSize: '0.85rem' }}>Sesi ini dibuka</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={modal.data?.show_result !== 0} onChange={e => setModal({ ...modal, data: { ...modal.data, show_result: e.target.checked ? 1 : 0 } })} />
                                                <span style={{ fontSize: '0.85rem' }}>Tampilkan Hasil & Skor</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {modal.type === 'statDetail' && (
                                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                                        <div style={{ background: theme.surfaceLight, padding: '1.25rem', borderRadius: '16px', borderLeft: `4px solid ${theme.primary}` }}>
                                            <div style={{ fontSize: '0.7rem', color: theme.primary, fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pertanyaan ({modal.question.category})</div>
                                            <div style={{ fontSize: '0.95rem', color: theme.text, lineHeight: 1.6 }}>{modal.question.content}</div>
                                        </div>

                                        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: `2px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.surface, zIndex: 10 }}>
                                                        <th style={{ padding: '1rem', color: theme.textMuted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Peserta</th>
                                                        <th style={{ padding: '1rem', color: theme.textMuted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Jawaban Dipilih</th>
                                                        <th style={{ padding: '1rem', color: theme.textMuted, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}>Skor</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {modal.data?.map((row, idx) => {
                                                        const selectedOpt = row.question_options.find(o => o.id === row.selected_option_id);
                                                        const maxScore = Math.max(...row.question_options.map(o => o.score || 0), 1);
                                                        const isCorrect = selectedOpt && selectedOpt.score === maxScore && maxScore > 0;

                                                        return (
                                                            <tr key={idx} style={{ borderBottom: `1px solid ${theme.border}` }}>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ fontWeight: 600 }}>{row.participant_name}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>{row.nik}</div>
                                                                </td>
                                                                <td style={{ padding: '1rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{
                                                                            width: '24px', height: '24px', borderRadius: '6px',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            background: isCorrect ? theme.success + '20' : theme.danger + '20',
                                                                            color: isCorrect ? theme.success : theme.danger,
                                                                            fontSize: '0.75rem', fontWeight: 800, border: `1px solid ${isCorrect ? theme.success : theme.danger}40`
                                                                        }}>
                                                                            {row.selected_option_id || '?'}
                                                                        </span>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontSize: '0.85rem' }}>{selectedOpt?.text || '(Tidak dijawab)'}</span>
                                                                            {!isCorrect && (
                                                                                <span style={{ fontSize: '0.7rem', color: theme.success, fontWeight: 600 }}>
                                                                                    Benar: {row.question_options.find(o => o.score === maxScore && maxScore > 0)?.id || '-'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                                    <Badge type={isCorrect ? 'success' : (selectedOpt?.score > 0 ? 'warning' : 'danger')}>
                                                                        {selectedOpt?.score || 0} PTS
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {(!modal.data || modal.data.length === 0) && (
                                                        <tr>
                                                            <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: theme.textMuted }}>Belum ada peserta yang menjawab soal ini.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {modal.type === 'sessionReview' && (
                                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem',
                                            background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '16px', border: `1px solid ${theme.border}`
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: theme.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>Total Skor</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: theme.primary }}>{modal.participant?.final_score_total || 0}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: theme.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>Status</div>
                                                <Badge type={modal.participant?.is_passed ? 'success' : 'danger'}>{modal.participant?.is_passed ? 'LULUS' : 'TIDAK LULUS'}</Badge>
                                            </div>
                                        </div>

                                        <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'grid', gap: '1rem' }}>
                                            {modal.data?.map((q, idx) => {
                                                const selectedOpt = q.question_options.find(o => o.id === q.selected_option_id);
                                                const maxScore = Math.max(...q.question_options.map(o => o.score || 0), 1);
                                                const isCorrect = selectedOpt && selectedOpt.score === maxScore && maxScore > 0;

                                                return (
                                                    <div key={idx} style={{
                                                        padding: '1.25rem', background: theme.surfaceLight, borderRadius: '16px',
                                                        border: `1px solid ${q.selected_option_id ? (isCorrect ? theme.success + '40' : theme.danger + '40') : theme.border}`,
                                                        opacity: q.selected_option_id ? 1 : 0.6
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'flex-start' }}>
                                                            <Badge type="info">{q.category}</Badge>
                                                            {q.selected_option_id ? (
                                                                <Badge type={isCorrect ? 'success' : 'danger'}>{isCorrect ? 'BENAR' : 'SALAH'} (+{selectedOpt?.score || 0})</Badge>
                                                            ) : (
                                                                <Badge type="secondary">TIDAK DIJAWAB</Badge>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', color: theme.text, marginBottom: '1rem', lineHeight: 1.5 }}>
                                                            <strong>{idx + 1}.</strong> {q.question_text}
                                                        </div>
                                                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                            {q.question_options.map(opt => {
                                                                const isSelected = opt.id === q.selected_option_id;
                                                                const isRightAnswer = opt.score === maxScore && maxScore > 0;
                                                                return (
                                                                    <div key={opt.id} style={{
                                                                        padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem',
                                                                        background: isSelected ? (isCorrect ? theme.success + '20' : theme.danger + '20') : (isRightAnswer ? theme.success + '10' : 'transparent'),
                                                                        border: `1px solid ${isSelected ? (isCorrect ? theme.success : theme.danger) + '40' : (isRightAnswer ? theme.success + '40' : 'transparent')}`,
                                                                        color: isSelected ? (isCorrect ? theme.success : theme.danger) : (isRightAnswer ? theme.success : theme.textMuted),
                                                                        display: 'flex', gap: '0.5rem'
                                                                    }}>
                                                                        <strong>{opt.id}.</strong> {opt.text}
                                                                        {isSelected && (isCorrect ? ' ✓' : ' ✗')}
                                                                        {!isSelected && isRightAnswer && q.selected_option_id && ' (Jawaban Benar)'}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: '1.5rem 2rem', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                <Button variant="ghost" onClick={() => { setModal(null); setImportFile(null); }}>Batal</Button>

                                {modal.type !== 'statDetail' && modal.type !== 'sessionReview' && (
                                    modal.type === 'import' ? (
                                        <Button disabled={!importFile} onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const formData = new FormData();
                                                formData.append('file', importFile);
                                                if (modal.data?.exam_id) formData.append('exam_id', modal.data.exam_id);
                                                await axios.post(`${API}/import-${modal.target}`, formData, {
                                                    headers: { ...adminHeaders(), 'Content-Type': 'multipart/form-data' }
                                                });

                                                setModal(null); setImportFile(null);
                                                fetchData(modal.target === 'participants' ? 'peserta' : 'soal');
                                                showToast('Import Berhasil');
                                            } catch (_e) { void _e; showToast('Gagal Import. Cek format file.'); }
                                            finally { setLoading(false); }
                                        }}>Mulai Import</Button>
                                    ) : (
                                        <Button onClick={async () => {
                                            setLoading(true);
                                            try {
                                                const endpoint = modal.type === 'participant' ? 'participants' :
                                                    modal.type === 'question' ? 'questions' :
                                                        modal.type === 'exam' ? 'exams' :
                                                            modal.type === 'user' ? 'users' : 'categories';

                                                if (modal.mode === 'add') await axios.post(`${API}/${endpoint}`, modal.data, { headers: adminHeaders() });
                                                else await axios.put(`${API}/${endpoint}/${modal.data.id}`, modal.data, { headers: adminHeaders() });

                                                setModal(null);
                                                fetchData(activeTab);
                                                showToast('Data Berhasil Disimpan');
                                            } catch (err) {
                                                showToast(err.response?.data?.error || 'Gagal menyimpan data');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}>Simpan</Button>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
