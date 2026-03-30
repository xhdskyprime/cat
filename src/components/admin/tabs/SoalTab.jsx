import React, { useState } from 'react';
import axios from 'axios';
import { Card, Button, Badge, Input, Icons, getTheme, ConfirmModal, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';

export default function SoalTab({ setModal }) {
    const {
        questions, categories, fetchData, API, adminHeaders, showToast, theme: mode
    } = useAdmin();
    const theme = getTheme(mode);

    const [search, setSearch] = useState('');
    const [questionFilter, setQuestionFilter] = useState('ALL');
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [confirmState, setConfirmState] = useState({ isOpen: false, type: null, questionId: null, loading: false });
    const itemsPerPage = 10;

    const filteredQuestions = questions.filter(q =>
        (questionFilter === 'ALL' || q.category === questionFilter) &&
        q.content?.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
    const paginatedQuestions = filteredQuestions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedQuestions(filteredQuestions.map(q => q.id));
        } else {
            setSelectedQuestions([]);
        }
    };

    const handleBulkDeleteConfirm = async () => {
        setConfirmState(s => ({ ...s, loading: true }));
        try {
            await axios.post(`${API}/questions/bulk-delete`, { ids: selectedQuestions }, { headers: adminHeaders() });
            setSelectedQuestions([]);
            fetchData('soal');
            showToast(`${confirmState.count} soal berhasil dihapus`);
            setConfirmState({ isOpen: false, type: null, questionId: null, loading: false });
        } catch (_e) {
            void _e;
            showToast('Gagal hapus massal', 'danger');
            setConfirmState(s => ({ ...s, loading: false }));
        }
    };

    const handleSingleDeleteConfirm = async () => {
        setConfirmState(s => ({ ...s, loading: true }));
        try {
            await axios.delete(`${API}/questions/${confirmState.questionId}`, { headers: adminHeaders() });
            fetchData('soal');
            showToast('Soal berhasil dihapus');
            setConfirmState({ isOpen: false, type: null, questionId: null, loading: false });
        } catch (_e) {
            void _e;
            showToast('Gagal hapus soal', 'danger');
            setConfirmState(s => ({ ...s, loading: false }));
        }
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="stagger-entry">
                <InfoNote title="Bank Soal" style={{ marginBottom: '0.25rem' }}>
                    Soal tersimpan per kategori. Pastikan kategori sudah benar sebelum import. Template Excel membantu format kolom sesuai sistem.
                </InfoNote>
                {/* Header Stats & Filter Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Badges Row */}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {categories.map((c, i) => (
                            <Badge key={c.id} type={i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'info' : 'success'}>
                                {c.id}: {questions.filter(q => q.category === c.id).length}
                            </Badge>
                        ))}
                    </div>

                    {/* Actions & Filters Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', background: theme.surfaceLight, padding: '0.5rem 0.75rem', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                                <input
                                    type="checkbox"
                                    checked={selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0}
                                    onChange={handleSelectAll}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pilih Semua</span>
                            </label>
                            <Input
                                placeholder="Cari teks soal..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                style={{ maxWidth: '400px' }}
                            />
                            <select
                                value={questionFilter}
                                onChange={e => { setQuestionFilter(e.target.value); setCurrentPage(1); }}
                                style={{ background: theme.surfaceLight, border: `1px solid ${theme.border}`, padding: '0.5rem 1rem', color: theme.text, borderRadius: '12px', fontSize: '0.85rem', outline: 'none' }}
                            >
                                <option value="ALL">Semua Kategori</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {selectedQuestions.length > 0 && (
                                <Button variant="danger" onClick={() => setConfirmState({ isOpen: true, type: 'bulk', count: selectedQuestions.length, loading: false })}>
                                    🗑️ Hapus ({selectedQuestions.length})
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                style={{ borderColor: theme.info, color: theme.info }}
                                onClick={async () => {
                                    try {
                                        const res = await axios.get(`${API}/template-questions`, {
                                            headers: adminHeaders(),
                                            responseType: 'blob'
                                        });
                                        const url = window.URL.createObjectURL(new Blob([res.data]));
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.setAttribute('download', 'template_bank_soal.xlsx');
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                    } catch (_e) {
                                        void _e;
                                        showToast('Gagal mengunduh template', 'danger');
                                    }
                                }}
                            >
                                <Icons.Activity style={{ width: 14, marginRight: 8, transform: 'rotate(90deg)' }} /> Unduh Template
                            </Button>
                            <Button variant="outline" onClick={() => setModal({ type: 'import', target: 'questions' })}>Import Excel</Button>
                            <Button onClick={() => setModal({ type: 'question', mode: 'add', data: { options: [{ id: 'A', text: '', score: 0 }, { id: 'B', text: '', score: 0 }, { id: 'C', text: '', score: 0 }, { id: 'D', text: '', score: 0 }, { id: 'E', text: '', score: 0 }] } })}>+ Soal</Button>
                        </div>
                    </div>
                </div>

                {/* Questions List */}
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {paginatedQuestions.map((q) => (
                        <Card key={q.id} style={{ border: selectedQuestions.includes(q.id) ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`, transition: 'all 0.2s ease' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedQuestions.includes(q.id)}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedQuestions([...selectedQuestions, q.id]);
                                            else setSelectedQuestions(selectedQuestions.filter(id => id !== q.id));
                                        }}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                    />
                                    <Badge type={q.category === 'TWK' ? 'primary' : (q.category === 'TIU' ? 'info' : (q.category === 'TKP' ? 'success' : 'warning'))}>{q.category}</Badge>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <Button variant="ghost" onClick={() => setModal({ type: 'question', mode: 'edit', data: q })} style={{ scale: '0.7' }}>Edit</Button>
                                    <Button variant="danger" onClick={() => setConfirmState({ isOpen: true, type: 'single', questionId: q.id, loading: false })} style={{ scale: '0.7' }}>X</Button>
                                </div>
                            </div>
                            <p style={{ lineHeight: 1.5, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{q.content}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
                                {(typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || [])).map(opt => (
                                    <div key={opt.id} style={{ 
                                        background: opt.score > 0 ? `${theme.success}15` : theme.surfaceLight, 
                                        padding: '0.5rem', 
                                        borderRadius: '8px', 
                                        fontSize: '0.8rem', 
                                        border: opt.score > 0 ? `1px solid ${theme.success}` : `1px solid ${theme.border}50`,
                                        position: 'relative'
                                    }}>
                                        <strong>{opt.id}.</strong> {opt.text} 
                                        {opt.score > 0 && <span style={{ color: theme.success, fontWeight: 700, marginLeft: '0.5rem' }}>✓</span>}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '2rem', background: theme.surface, padding: '1rem', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                        <Button
                            variant="ghost"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            ← Prev
                        </Button>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: theme.textMuted }}>Halaman</span>
                            <strong style={{ color: theme.primary, fontSize: '1.1rem' }}>{currentPage}</strong>
                            <span style={{ fontSize: '0.9rem', color: theme.textMuted }}>dari {totalPages}</span>
                        </div>
                        <Button
                            variant="ghost"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            Next →
                        </Button>
                    </div>
                )}
            </div>

            {/* Bulk Delete Confirm */}
            <ConfirmModal
                isOpen={confirmState.isOpen && confirmState.type === 'bulk'}
                onClose={() => setConfirmState({ isOpen: false, type: null, questionId: null, loading: false })}
                onConfirm={handleBulkDeleteConfirm}
                title="Hapus Soal Massal"
                message={`Anda akan menghapus ${confirmState.count} soal secara permanen. Tindakan ini tidak dapat dibatalkan. Lanjutkan?`}
                loading={confirmState.loading}
            />

            {/* Single Delete Confirm */}
            <ConfirmModal
                isOpen={confirmState.isOpen && confirmState.type === 'single'}
                onClose={() => setConfirmState({ isOpen: false, type: null, questionId: null, loading: false })}
                onConfirm={handleSingleDeleteConfirm}
                title="Hapus Soal"
                message="Apakah Anda yakin ingin menghapus soal ini secara permanen?"
                loading={confirmState.loading}
            />
        </>
    );
}
