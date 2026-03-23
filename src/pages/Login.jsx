import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExam } from '../context/ExamContext';
import { User, Lock, ArrowRight, Info, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const { login, user: authUser, API_URL } = useAuth();
    const { resetExam } = useExam();

    const [nik, setNik] = useState('');
    const [nomorPeserta, setNomorPeserta] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [publicSettings, setPublicSettings] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            // Fetch Template
            try {
                const tempRes = await fetch(`${API_URL}/active-template`);
                if (tempRes.ok) {
                    const tempData = await tempRes.json();
                    if (tempData && !tempData.error) setActiveTemplate(tempData);
                }
            } catch (err) { console.warn("Failed template fetch", err); }

            // Fetch Settings (Logo)
            try {
                const settRes = await fetch(`${API_URL}/settings`);
                if (settRes.ok) {
                    const settData = await settRes.json();
                    if (settData && !settData.error) setPublicSettings(settData);
                }
            } catch (err) { console.warn("Failed settings fetch", err); }
        };
        fetchData();
    }, [API_URL]);

    useEffect(() => {
        const reason = localStorage.getItem('cat_kick_reason');
        if (reason) {
            localStorage.removeItem('cat_kick_reason');
            setError(reason);
        }
    }, []);

    // Use default template values while loading or if fetch fails
    const template = activeTemplate || {
        id: 'medical',
        primary_color: '#0d9488',
        secondary_color: '#f59e0b',
        illustration_url: '/nurse_v3.png',
        headline: 'Tenaga Kesehatan Hebat!',
        sub_headline: 'Portal seleksi <b>Tenaga Kesehatan BLUD.</b><br />Siapkan kompetensi terbaikmu.',
        tagline: 'SAVE LIVES, SERVE BETTER!'
    };

    // Update headline if it's medical template
    const displayHeadline = (template.id === 'medical' || template.headline === 'Tenaga Medis Hebat!')
        ? 'Tenaga Kesehatan Hebat!'
        : template.headline;

    // Clean sub_headline and capitalize first letter
    const rawSubHeadline = template?.sub_headline?.replace('Selamat datang di ', '')?.replace('Selamat datang ', '') || '';
    const cleanSubHeadline = rawSubHeadline.charAt(0).toUpperCase() + rawSubHeadline.slice(1);
    const supportText = publicSettings?.support_contact_text || 'Hubungi Admin';
    const supportUrl = publicSettings?.support_contact_url || '';
    const appName = publicSettings?.app_name || 'CAT SYSTEM';
    const appVersion = publicSettings?.app_version_label || '';


    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let enteredFullscreen = false;
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                    enteredFullscreen = true;
                }
            } catch (e) {
                void e;
            }

            const res = await login(nik.trim(), nomorPeserta.trim(), token.trim());

            if (res.success) {
                setShowSuccess(true);

                // Wait for success animation before navigating
                setTimeout(() => {
                    if (resetExam) resetExam();

                    if (res.hasFinished || res.hasActiveSession) {
                        navigate('/exam');
                    } else {
                        navigate('/tutorial');
                    }
                }, 2000);
            } else {
                if (enteredFullscreen) {
                    try {
                        if (document.fullscreenElement) await document.exitFullscreen();
                    } catch (_e) {
                        void _e;
                    }
                }
                setError(res.message || 'Data tidak ditemukan atau PIN salah.');
            }
        } catch (_err) {
            void _err;
            setError('Terjadi kesalahan koneksi sistem.');
        } finally {
            setLoading(false);
        }
    };

    if (showSuccess) {
        return (
            <div style={{
                minHeight: '100vh',
                background: `linear-gradient(135deg, ${template.primary_color} 0%, #1e1b4b 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                color: 'white',
                textAlign: 'center',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
                <div className="animate-fade-in" style={{
                    maxWidth: '500px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '32px',
                    padding: '4rem 2rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 2rem',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        {publicSettings?.institution_logo ? (
                            <img src={publicSettings.institution_logo} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: '40px', height: '40px', background: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '20px', height: '20px', background: template.primary_color, borderRadius: '4px' }} />
                            </div>
                        )}
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.8, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Selamat Datang
                    </h3>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                        HALO,<br />
                        <span style={{
                            background: 'linear-gradient(to right, #fff, #93c5fd)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {authUser?.nama?.split(' ')[0] || 'PESERTA'}!
                        </span>
                    </h1>
                    <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.6, margin: 0 }}>
                        Selamat datang di CAT SYSTEM.<br />
                        Mari siapkan petualangan ujianmu hari ini.
                    </p>

                    <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            width: '40px',
                            height: '4px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                width: '50%',
                                background: '#fff',
                                borderRadius: '2px',
                                animation: 'loadingBar 1.5s infinite ease-in-out'
                            }} />
                        </div>
                    </div>
                </div>

                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes loadingBar {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(200%); }
                    }
                    .animate-fade-in {
                        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <div style={{
                width: '100%',
                maxWidth: '1100px',
                background: 'white',
                borderRadius: '40px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                overflow: 'hidden',
                boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.12)',
                minHeight: '700px'
            }}>
                {/* LEFT PANEL - FORM */}
                <div style={{ padding: '4rem 3.5rem', display: 'flex', flexDirection: 'column' }}>
                    {/* Header/Logo Branding */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem', justifyContent: 'center' }}>
                        {publicSettings?.institution_logo ? (
                            <img src={publicSettings.institution_logo} alt="Branding" style={{ height: '54px', maxWidth: '280px', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '44px', height: '44px', background: '#f1f5f9', borderRadius: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{
                                        width: '22px', height: '22px', background: template.primary_color, borderRadius: '6px', position: 'relative'
                                    }}>
                                        <div style={{ position: 'absolute', top: '20%', left: '20%', width: '40%', height: '40%', background: 'white', borderRadius: '2px', opacity: 0.8 }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b' }}>CAT</span>
                                    <span style={{ fontWeight: 400, fontSize: '1.25rem', color: '#64748b', marginLeft: '4px' }}>SYSTEM</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <h1 style={{ color: '#1e293b', fontSize: '2.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2, textAlign: 'center' }}>
                            Selamat Datang,<br />
                            <span style={{
                                fontStyle: 'italic',
                                color: template.primary_color,
                                textShadow: `0 2px 4px ${template.primary_color}20`,
                                display: 'inline-block'
                            }}>{displayHeadline}</span>
                        </h1>
                        <p
                            style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '1.05rem', lineHeight: 1.6, textAlign: 'center' }}
                            dangerouslySetInnerHTML={{ __html: cleanSubHeadline }}
                        />

                        <form onSubmit={handleLogin} style={{ marginTop: '2rem' }}>
                            {error && (
                                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid #fee2e2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Info size={18} /> {error}
                                </div>
                            )}

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIK Sesuai KTP/KK</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        value={nik}
                                        onChange={e => setNik(e.target.value)}
                                        placeholder="16 Digit NIK"
                                        required
                                        style={{ width: '100%', padding: '1.1rem 1.1rem 1.1rem 3.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s' }}
                                        className="login-input"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nomor Peserta</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        value={nomorPeserta}
                                        onChange={e => setNomorPeserta(e.target.value)}
                                        placeholder="Contoh: 123456"
                                        required
                                        style={{ width: '100%', padding: '1.1rem 1.1rem 1.1rem 3.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s' }}
                                        className="login-input"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '2.5rem' }}>
                                <label style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password / PIN Token</label>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={token}
                                        onChange={e => setToken(e.target.value.toUpperCase())}
                                        placeholder="6 Digit PIN"
                                        required
                                        style={{ width: '100%', padding: '1.1rem 1.1rem 1.1rem 3.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', outline: 'none', fontWeight: 600, letterSpacing: token ? '10px' : 'normal' }}
                                        className="login-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '1.25rem',
                                    borderRadius: '16px',
                                    background: template.primary_color,
                                    color: 'white',
                                    border: 'none',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    boxShadow: `0 10px 25px ${template.primary_color}40`,
                                    transition: 'all 0.2s'
                                }}
                                className="login-btn"
                            >
                                {loading ? 'Memverifikasi...' : (
                                    <>MASUK SEKARANG <ArrowRight size={20} /></>
                                )}
                            </button>
                        </form>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                            <div style={{ width: '22px', height: '22px', background: `${template.primary_color}20`, color: template.primary_color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>?</div>
                            <span>Butuh bantuan?</span>
                            {supportUrl ? (
                                <a
                                    href={supportUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: template.primary_color, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    {supportText}
                                </a>
                            ) : (
                                <span style={{ color: template.primary_color, fontWeight: 700, cursor: 'default' }}>
                                    {supportText}
                                </span>
                            )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{appName}{appVersion ? ` ${appVersion}` : ''}</p>
                    </div>
                </div>

                {/* RIGHT PANEL - ILLUSTRATION */}
                <div style={{
                    background: template.primary_color,
                    padding: '2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Background Decorative Circles */}
                    <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '200px', height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />

                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '32px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '3rem',
                        textAlign: 'center',
                        color: 'white',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        {/* Pill badge */}
                        <div style={{
                            padding: '0.5rem 1.25rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '100px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            marginBottom: '3.5rem',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            CAT 2.0
                        </div>

                        {/* Illustration Container */}
                        <div style={{
                            position: 'relative',
                            width: '380px',
                            height: '380px',
                            marginBottom: '3rem',
                            borderRadius: '48px',
                            background: template.id === 'medical' ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                            backdropFilter: 'blur(30px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: '0 40px 80px -20px rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <img
                                src={template.illustration_url}
                                alt="Illustration"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    mixBlendMode: template.id === 'medical' ? 'multiply' : 'normal'
                                }}
                            />
                        </div>

                        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                            {template.tagline.split(',')[0]},<br />
                            <span style={{ color: template.secondary_color, position: 'relative' }}>
                                {template.tagline.split(',')[1] || template.tagline.split(' ')[1] || template.tagline.split(' ')[0]}
                                <div style={{ position: 'absolute', bottom: '-4px', left: 0, width: '100%', height: '4px', background: template.secondary_color, borderRadius: '2px' }} />
                            </span>
                        </h2>

                        {/* Footer markers */}
                        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '4rem', opacity: 0.8, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', background: template.secondary_color, borderRadius: '50%' }} /> THINK BIG
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }} /> GROW MORE
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .login-input:focus {
                    border-color: ${template.primary_color} !important;
                    background: #fff !important;
                    box-shadow: 0 0 0 4px ${template.primary_color}15 !important;
                }
                .login-btn:hover {
                    opacity: 0.9;
                    transform: translateY(-2px);
                    box-shadow: 0 15px 30px ${template.primary_color}40 !important;
                }
                .login-btn:active {
                    transform: translateY(0);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @media (max-width: 1024px) {
                    .login-grid { border-radius: 0 !important; }
                    .login-card { max-width: 100% !important; border-radius: 0 !important; }
                }
            `}</style>
        </div>
    );
}

