import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = `${import.meta.env.VITE_API_URL}/api/admin`;

const theme = {
    bg: '#020617',
    surface: '#0f172a',
    surfaceLight: '#1e293b',
    primary: '#6366f1',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: 'rgba(255,255,255,0.06)',
    danger: '#ef4444',
    gradPrimary: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
};

export default function AdminLogin() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${API}/login`, { username, password });
            localStorage.setItem('admin_token', res.data.token);
            localStorage.setItem('admin_role', res.data.role);
            localStorage.setItem('admin_username', res.data.username);
            navigate('/admin');
        } catch (err) {
            setError(err.response?.data?.error || 'Login admin gagal.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                {/* Subtle Batik Overlay */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url("/batik.png")', backgroundSize: '400px',
                    opacity: 0.03, mixBlendMode: 'overlay', pointerEvents: 'none'
                }} />
                <div style={{ position: 'absolute', top: '20%', right: '10%', width: '30%', height: '30%', background: `${theme.primary}10`, filter: 'blur(120px)', borderRadius: '50%' }} />
            </div>

            <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ width: 44, height: 44, background: theme.gradPrimary, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)' }}>C</div>
                        <span style={{ color: theme.text, fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CAT ADMIN</span>
                    </div>
                    <h2 style={{ color: theme.text, fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>Administrator Access</h2>
                    <p style={{ color: theme.textMuted, marginTop: '0.5rem', fontSize: '0.9rem' }}>Masukkan kredensial untuk mengelola sistem</p>
                </div>

                <div className="uiverse-card" style={{ padding: '2.5rem' }}>
                    {error && (
                        <div style={{ background: `${theme.danger}20`, color: theme.danger, padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.875rem', marginBottom: '1.5rem', border: `1px solid ${theme.danger}40`, fontWeight: 600 }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ color: theme.textMuted, fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Username</label>
                            <input
                                type="text"
                                className="uiverse-input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Admin ID"
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ color: theme.textMuted, fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Password</label>
                            <input
                                type="password"
                                className="uiverse-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="uiverse-glow-btn"
                            disabled={loading}
                        >
                            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                        </button>
                    </form>
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                        onClick={() => navigate('/login')}
                        style={{ background: 'transparent', border: 'none', color: theme.textMuted, fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                        ← Kembali ke Login Peserta
                    </button>
                </div>
            </div>
        </div>
    );
}
