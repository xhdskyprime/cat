import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import * as Icons from 'lucide-react';

export default function Tutorial() {
    const { user, API_URL } = useAuth();
    const navigate = useNavigate();
    const [agreed, setAgreed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Auto-redirect jika sudah selesai
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const token = localStorage.getItem('cat_token');
                const res = await axios.get(`${API_URL}/exam/status`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                if (res.data?.hasFinished) {
                    navigate('/result');
                    return;
                }
                if (res.data?.hasActiveSession) {
                    navigate('/exam');
                }
            } catch (_e) {
                void _e;
            }
        };
        if (user) checkStatus();
    }, [API_URL, navigate, user]);

    if (!user) {
        navigate('/login');
        return null;
    }

    const handleStart = async () => {
        if (!agreed) return;
        setIsLoading(true);

        // Minta Fullscreen saat itu juga di event KLIK USER (lulus sekuritas browser)
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
        } catch (e) {
            console.warn("Fullscreen API is not fully supported or is blocked", e);
        }

        navigate('/exam');
    };

    return (
        <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* ── BACKGROUND AESTHETICS ─────────────────────────────────── */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                {/* Subtle Batik Overlay */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'url("/batik.png")', backgroundSize: '400px',
                    opacity: 0.03, mixBlendMode: 'overlay', pointerEvents: 'none'
                }} />

                {/* Glow Blobs */}
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'rgba(59,130,246,0.1)', filter: 'blur(100px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(139,92,246,0.1)', filter: 'blur(100px)', borderRadius: '50%' }} />
            </div>

            <div style={{ maxWidth: '800px', width: '100%', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '2.5rem', color: 'white', position: 'relative', zIndex: 1 }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'rgba(59,130,246,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                        <Icons.BookOpen style={{ color: '#3b82f6' }} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Instruksi & Tata Tertib Ujian</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Icons.Timer style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Waktu Terbatas</div>
                                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Ujian akan berakhir otomatis saat waktu habis. Perhatikan timer di pojok kanan atas.</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Icons.ShieldAlert style={{ color: '#ef4444', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Dilarang Pindah Tab</div>
                                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Sistem akan mencatat setiap kali Anda keluar dari halaman ujian. Melebihi batas akan menyebabkan ujian dihentikan.</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Icons.Save style={{ color: '#10b981', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Simpan Otomatis</div>
                                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Jawaban Anda disimpan secara berkala baik di server maupun di perangkat ini (Auto-Backup).</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Icons.CheckCircle2 style={{ color: '#3b82f6', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Tombol Selesai</div>
                                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Hanya tekan tombol selesai jika Anda sudah benar-benar yakin. Anda tidak dapat kembali setelah konfirmasi.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: '16px', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '2.5rem' }}>
                    <label style={{ display: 'flex', gap: '1rem', cursor: 'pointer', alignItems: 'flex-start' }}>
                        <input
                            type="checkbox"
                            className="uiverse-checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            style={{ flexShrink: 0, marginTop: '3px' }}
                        />
                        <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Saya telah membaca dan memahami seluruh instruksi di atas serta bersedia mengikuti ujian dengan jujur dan menjunjung tinggi integritas.
                        </span>
                    </label>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={handleStart}
                        className="uiverse-glow-btn"
                        disabled={!agreed || isLoading}
                        style={{ maxWidth: '400px', margin: '0 auto' }}
                    >
                        {isLoading ? 'Menyiapkan...' : 'MULAI UJIAN SEKARANG'}
                    </button>
                    <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                        Logged in as: <strong>{user.nama}</strong> ({user.nomorPeserta})
                    </div>
                </div>

            </div>
        </div>
    );
}
