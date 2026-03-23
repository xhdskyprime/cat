import React from 'react';
import axios from 'axios';
import { Card, Button, Input, Icons, getTheme, Badge, FormGroup, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function SettingsTab({ setModal: _setModal }) {
    const {
        settings, setSettings, updateSettings, templates, fetchData, API, adminHeaders, showToast, theme: mode
    } = useAdmin();
    const theme = getTheme(mode);
    const requireFullscreen = String(settings.require_fullscreen ?? '1') !== '0';

    const saveConfiguration = async (data, successMsg) => {
        try {
            await axios.put(`${API}/settings`, data, { headers: adminHeaders() });
            showToast(successMsg || 'Perubahan Berhasil Disimpan');
            fetchData('settings');
        } catch (_e) {
            void _e;
            showToast('Gagal menyimpan perubahan', 'danger');
        }
    };

    return (
        <div style={{ maxWidth: '900px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }} className="stagger-entry">
            <div style={{ gridColumn: '1 / -1' }}>
                <InfoNote title="Settings & Logs">
                    Pengaturan di halaman ini memengaruhi perilaku ujian dan tampilan aplikasi. Perubahan berlaku untuk semua sesi (kecuali pengaturan khusus per sesi di menu Sesi Ujian).
                </InfoNote>
            </div>

            {/* CARD 2: SECURITY CONFIG */}
            <Card>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}>
                    <div style={{ color: theme.primary }}><Icons.Activity /></div> Keamanan & Anti-Curang
                </h3>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <FormGroup
                        label="Batas Pelanggaran Tab"
                        hint="Peserta akan dikeluarkan otomatis jika berpindah tab melebihi batas ini."
                    >
                        <Input
                            type="number"
                            min="1"
                            max="20"
                            value={settings.max_tab_violations || 3}
                            onChange={e => setSettings({ ...settings, max_tab_violations: Number(e.target.value) })}
                        />
                    </FormGroup>

                    <FormGroup
                        label="Proteksi Fullscreen"
                        hint="Wajibkan mode layar penuh selama pengerjaan soal."
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem', background: theme.surfaceLight, borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Badge type={requireFullscreen ? 'success' : 'warning'}>{requireFullscreen ? 'On' : 'Off'}</Badge>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                    {requireFullscreen ? 'Mode Fullscreen Wajib' : 'Mode Fullscreen Tidak Wajib'}
                                </span>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', color: theme.textMuted, fontWeight: 700, fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={requireFullscreen}
                                    onChange={(e) => setSettings({ ...settings, require_fullscreen: e.target.checked ? '1' : '0' })}
                                />
                                Aktif
                            </label>
                        </div>
                    </FormGroup>

                    <FormGroup
                        label="Batas Pelanggaran Fullscreen"
                        hint="Jika peserta keluar fullscreen melebihi batas ini, ujian akan diakhiri."
                    >
                        <Input
                            type="number"
                            min="1"
                            max="20"
                            value={Number(settings.max_fs_violations || 3)}
                            onChange={e => setSettings({ ...settings, max_fs_violations: Number(e.target.value) })}
                            disabled={!requireFullscreen}
                        />
                    </FormGroup>

                    <Button
                        variant="primary"
                        style={{ width: '100%' }}
                        onClick={() => saveConfiguration({
                            max_tab_violations: settings.max_tab_violations,
                            require_fullscreen: settings.require_fullscreen,
                            max_fs_violations: settings.max_fs_violations
                        }, 'Konfigurasi Keamanan Disimpan')}
                    >
                        Simpan Perubahan
                    </Button>
                </div>
            </Card>

            {/* CARD 3: BRANDING & UI */}
            <Card>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}>
                    <div style={{ color: theme.primary }}><Icons.Settings /></div> Branding & Tampilan
                </h3>
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <FormGroup label="Nama Aplikasi">
                        <Input
                            placeholder="CAT SYSTEM"
                            value={settings.app_name || ''}
                            onChange={e => setSettings({ ...settings, app_name: e.target.value })}
                        />
                    </FormGroup>

                    <FormGroup label="Label Versi">
                        <Input
                            placeholder="v2.5"
                            value={settings.app_version_label || ''}
                            onChange={e => setSettings({ ...settings, app_version_label: e.target.value })}
                        />
                    </FormGroup>

                    <FormGroup label="Tema Aplikasi">
                        <select
                            value={settings.active_template || 'education'}
                            onChange={e => updateSettings({ active_template: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: theme.surfaceLight,
                                color: theme.text,
                                borderRadius: '16px',
                                border: `1px solid ${theme.border}`,
                                cursor: 'pointer',
                                outline: 'none',
                                fontWeight: 600
                            }}
                        >
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </FormGroup>

                    <FormGroup label="Logo Instansi (URL)">
                        <Input
                            placeholder="https://example.com/logo.png"
                            value={settings.institution_logo || ''}
                            onChange={e => setSettings({ ...settings, institution_logo: e.target.value })}
                        />
                    </FormGroup>

                    <FormGroup label="Teks Bantuan (Login)">
                        <Input
                            placeholder="Hubungi Admin"
                            value={settings.support_contact_text || ''}
                            onChange={e => setSettings({ ...settings, support_contact_text: e.target.value })}
                        />
                    </FormGroup>

                    <FormGroup
                        label="Link Bantuan (Opsional)"
                        hint="Contoh: https://wa.me/62812xxxx atau mailto:admin@domain.com"
                    >
                        <Input
                            placeholder="https://..."
                            value={settings.support_contact_url || ''}
                            onChange={e => setSettings({ ...settings, support_contact_url: e.target.value })}
                        />
                    </FormGroup>

                    {settings.institution_logo && (
                        <div style={{
                            padding: '1.5rem',
                            background: theme.isDark ? 'white' : 'white',
                            borderRadius: '20px',
                            border: `1px solid ${theme.border}`,
                            textAlign: 'center',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.03)'
                        }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Preview Logo Header</div>
                            <img src={settings.institution_logo} alt="Branding" style={{ height: '45px', objectFit: 'contain' }} />
                        </div>
                    )}

                    <Button
                        variant="secondary"
                        style={{ width: '100%', background: theme.isDark ? 'rgba(255,255,255,0.05)' : '#1e293b', color: 'white' }}
                        onClick={() => saveConfiguration({
                            app_name: settings.app_name,
                            app_version_label: settings.app_version_label,
                            active_template: settings.active_template,
                            institution_logo: settings.institution_logo,
                            support_contact_text: settings.support_contact_text,
                            support_contact_url: settings.support_contact_url
                        }, 'Branding Berhasil Disimpan')}
                    >
                        Terapkan Visual
                    </Button>
                </div>
            </Card>

        </div>
    );
}
