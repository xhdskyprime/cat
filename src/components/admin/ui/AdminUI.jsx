import React from 'react';
import { createPortal } from 'react-dom';
import { useAdmin } from '../../../context/AdminContext';

export const getTheme = (mode = 'light') => {
    const isDark = mode === 'dark';
    return {
        isDark,
        bg: isDark ? '#020617' : '#f8fafc',
        surface: isDark ? '#0f172a' : '#ffffff',
        surfaceLight: isDark ? '#1e293b' : '#f1f5f9',
        primary: '#6366f1',
        secondary: '#0ea5e9',
        accent: '#f43f5e',
        text: isDark ? '#f8fafc' : '#0f172a',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
        borderHover: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        glass: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        gradPrimary: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        gradSuccess: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        gradDanger: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
    };
};

// ─── ICONS (SVG) ──────────────────────────────────────
export const Icons = {
    Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Book: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
    Target: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    Database: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>,
    Trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>,
    Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
    Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    ChevronLeft: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
    ChevronRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
    Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    History: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"></path><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path></svg>,
    Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    RefreshCw: ({ className, style }) => <svg className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
};

// ─── REUSABLE UI COMPONENTS (DARK) ─────────────────────
export function Card({ children, style = {}, className = "" }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <div
            className={`card-hover animate-scale-up ${className}`}
            style={{
                background: theme.surface,
                borderRadius: '24px',
                border: `1px solid ${theme.border}`,
                padding: '2rem',
                boxShadow: theme.isDark
                    ? '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)'
                    : '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.4s cubic-bezier(0.2, 1, 0.2, 1)',
                ...style
            }}
        >
            {children}
        </div>
    );
}

export function StatCard({ label, value, icon, trend, trendType = 'up', style = {} }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <Card style={{ padding: '1.5rem', ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '14px', background: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: theme.primary, display: 'flex' }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '20px',
                        background: trendType === 'up' ? `${theme.success}15` : `${theme.danger}15`,
                        color: trendType === 'up' ? theme.success : theme.danger,
                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                        {trendType === 'up' ? '↑' : '↓'} {trend}
                    </div>
                )}
            </div>
            <div>
                <div style={{ color: theme.textMuted, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ color: theme.text, fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{value}</div>
            </div>
        </Card>
    );
}

export function VisualContainer({ title, subtitle, children, style = {} }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px', ...style }}>
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: theme.text, margin: 0 }}>{title}</h3>
                {subtitle && <p style={{ fontSize: '0.85rem', color: theme.textMuted, margin: '0.25rem 0 0 0' }}>{subtitle}</p>}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                {children}
            </div>
        </Card>
    );
}

export function Button({ children, onClick, variant = 'primary', style = {}, disabled = false, type = "button" }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    const variants = {
        primary: { bg: theme.gradPrimary, color: 'white', shadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' },
        secondary: { bg: theme.secondary, color: 'white', shadow: '0 10px 15px -3px rgba(14, 165, 233, 0.3)' },
        danger: { bg: theme.gradDanger, color: 'white', shadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)' },
        ghost: { bg: 'transparent', color: theme.text, border: `1px solid ${theme.border}` },
        outline: { bg: 'transparent', color: theme.primary, border: `2px solid ${theme.primary}` },
        success: { bg: theme.gradSuccess, color: 'white', shadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }
    };
    const v = variants[variant] || variants.primary;
    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            style={{
                background: v.bg,
                color: v.color,
                border: v.border || 'none',
                padding: '0.85rem 1.75rem',
                borderRadius: '16px',
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontSize: '0.875rem',
                boxShadow: v.shadow || 'none',
                letterSpacing: '0.01em',
                opacity: disabled ? 0.5 : 1,
                ...style
            }}
            onMouseOver={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.filter = 'brightness(1.1)'; } }}
            onMouseOut={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'none'; } }}
        >
            {children}
        </button>
    );
}

export function Input({ icon, ...props }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            {icon && (
                <div style={{ position: 'absolute', left: '1.25rem', color: theme.textMuted, pointerEvents: 'none', display: 'flex' }}>
                    {icon}
                </div>
            )}
            <input
                {...props}
                style={{
                    width: '100%',
                    background: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '16px',
                    padding: icon ? '0.85rem 1.25rem 0.85rem 3rem' : '0.85rem 1.25rem',
                    color: theme.text,
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)',
                    ...props.style
                }}
                onFocus={e => {
                    e.target.style.borderColor = theme.primary;
                    e.target.style.background = theme.isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
                    e.target.style.boxShadow = `0 0 0 4px ${theme.primary}15`;
                }}
                onBlur={e => {
                    e.target.style.borderColor = theme.border;
                    e.target.style.background = theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
                    e.target.style.boxShadow = 'none';
                }}
            />
        </div>
    );
}


export function Badge({ children, type = 'primary' }) {
    const colors = {
        primary: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8' },
        success: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
        danger: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
        warning: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
        info: { bg: 'rgba(14, 165, 233, 0.15)', text: '#38bdf8' },
        secondary: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' }
    };
    const c = colors[type] || colors.primary;
    return (
        <span style={{
            background: c.bg,
            color: c.text,
            padding: '0.4rem 0.8rem',
            borderRadius: '100px',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            border: `1px solid ${c.text}30`
        }}>
            {children}
        </span>
    );
}

export function InfoNote({ title, children, style = {} }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <div style={{
            background: theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${theme.border}`,
            borderRadius: '16px',
            padding: '0.9rem 1rem',
            color: theme.textMuted,
            lineHeight: 1.6,
            ...style
        }}>
            <span style={{ marginRight: '0.4rem' }}>💡</span>
            {title ? <strong style={{ color: theme.text }}>{title}</strong> : null}
            {title ? <span style={{ marginRight: '0.25rem' }}>:</span> : null}
            <span>{children}</span>
        </div>
    );
}

// ─── DATA TABLE ABSTRACTION ──────────────────────────
export function DataTable({ columns, data, loading, emptyMessage = "Tidak ada data", getRowKey }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: theme.textMuted }}>
                <div className="animate-pulse" style={{ fontSize: '1.2rem', fontWeight: 600 }}>Memuat data...</div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: theme.textMuted, border: `1px dashed ${theme.border}`, borderRadius: '16px' }}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                        {columns.map((col, i) => (
                            <th
                                key={i}
                                style={{
                                    padding: '1.25rem 1rem',
                                    color: theme.textMuted,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    textAlign: col.align || 'left',
                                    width: col.width || 'auto'
                                }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rowIndex) => (
                        <tr
                            key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
                            style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {columns.map((col, colIndex) => (
                                <td
                                    key={colIndex}
                                    style={{
                                        padding: '1.25rem 1rem',
                                        textAlign: col.align || 'left',
                                        verticalAlign: 'middle',
                                        color: theme.text,
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {col.render ? col.render(row, rowIndex) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── MODAL ABSTRACTION ───────────────────────────────
export function AdminModal({ isOpen, onClose, title, children, footer, width = '600px' }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    if (!isOpen) return null;

    const portalTarget = typeof document !== 'undefined' ? document.body : null;
    if (!portalTarget) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            background: theme.isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }} onClick={onClose}>
            <div
                className="animate-scale-up"
                style={{
                    background: theme.surface,
                    width: '100%',
                    maxWidth: width,
                    borderRadius: '28px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.text }}>{title}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto', color: theme.text }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{ padding: '1.5rem 2rem', background: theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        portalTarget
    );
}

// ─── FORM GROUP ABSTRACTION ─────────────────────────
export function FormGroup({ label, children, error, hint }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: theme.textMuted, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </label>
            {children}
            {hint && <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '0.4rem' }}>{hint}</div>}
            {error && <div style={{ fontSize: '0.75rem', color: theme.danger, marginTop: '0.4rem', fontWeight: 600 }}>{error}</div>}
        </div>
    );
}

// ─── CONFIRM MODAL ABSTRACTION ───────────────────────
export function ConfirmModal({ isOpen, onClose, onConfirm, title = "Konfirmasi", message, type = "danger", confirmText = "Ya, Lanjutkan", cancelText = "Batal", loading = false }) {
    const { theme: mode } = useAdmin();
    const theme = getTheme(mode);

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width="400px"
            footer={
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                    <Button variant="ghost" onClick={onClose} style={{ flex: 1 }} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button variant={type} onClick={onConfirm} style={{ flex: 1 }} disabled={loading}>
                        {loading ? 'Memproses...' : confirmText}
                    </Button>
                </div>
            }
        >
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: type === 'danger' ? `${theme.danger}15` : (type === 'warning' ? `${theme.warning}15` : `${theme.primary}15`),
                    color: type === 'danger' ? theme.danger : (type === 'warning' ? theme.warning : theme.primary),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    margin: '0 auto 1.5rem auto'
                }}>
                    {type === 'danger' ? '⚠️' : (type === 'warning' ? '⏳' : 'ℹ️')}
                </div>
                <p style={{ margin: 0, fontSize: '1rem', color: theme.text, lineHeight: 1.6, fontWeight: 500 }}>
                    {message}
                </p>
            </div>
        </AdminModal>
    );
}
