import React, { useState, useMemo } from 'react';
import { Card, Button, Badge, Icons, getTheme, DataTable, Input, InfoNote } from '../ui/AdminUI';
import { useAdmin } from '../../../context/AdminContext';
import { exportResultsToPDF } from '../../../utils/pdfExport';
import * as XLSX from 'xlsx';

export default function HasilTab({ handleShowSessionReview }) {
    const { results, categories, exams, loading, theme: mode } = useAdmin();
    const theme = getTheme(mode);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Filter results based on selected session and search term
    const filteredResults = useMemo(() => {
        let filtered = results;
        if (selectedExamId) {
            filtered = filtered.filter(r => String(r.exam_id) === String(selectedExamId));
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.nama || '').toLowerCase().includes(term) ||
                (r.nik || '').toLowerCase().includes(term) ||
                (r.nomor_peserta || '').toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [results, selectedExamId, searchTerm]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const paginatedResults = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredResults.slice(start, start + itemsPerPage);
    }, [filteredResults, currentPage]);

    const exportExcel = () => {
        const currentExam = exams.find(e => String(e.id) === String(selectedExamId));
        const examTitle = currentExam ? currentExam.title : 'Semua Sesi';

        // Prepare data for Excel
        const data = filteredResults.map((r, i) => {
            const scoresObj = typeof r.category_scores === 'string' ? JSON.parse(r.category_scores || '{}') : (r.category_scores || {});
            const item = {
                'Rank': i + 1,
                'Nama Peserta': r.nama,
                'NIK': r.nik,
                'No Ujian': r.nomor_peserta,
                'Ujian': r.exam_title || '-'
            };

            // Add category scores
            categories.forEach(c => {
                item[c.name] = scoresObj[c.id] || 0;
            });

            item['Total Skor'] = r.final_score_total;
            item['Status'] = r.is_passed ? 'LULUS' : 'GAGAL';

            return item;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hasil Ujian");

        // Fix column widths
        const wscols = [
            { wch: 6 },  // Rank
            { wch: 25 }, // Nama
            { wch: 20 }, // NIK
            { wch: 15 }, // No Ujian
            { wch: 20 }, // Ujian
            ...categories.map(() => ({ wch: 12 })),
            { wch: 12 }, // Total
            { wch: 12 }  // Status
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `Hasil_Ujian_${examTitle.replace(/\s+/g, '_')}.xlsx`);
    };

    const columns = [
        {
            header: 'Rank',
            render: (_, i) => <span style={{ fontWeight: 700 }}># {(currentPage - 1) * itemsPerPage + i + 1}</span>,
            width: '80px',
            align: 'center'
        },
        {
            header: 'Nama Peserta',
            render: (r) => <span style={{ fontWeight: 600 }}>{r.nama}</span>
        },
        {
            header: 'No. Ujian',
            render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.primary }}>{r.nomor_peserta}</span>,
            width: '120px'
        },
        {
            header: 'Sesi Ujian',
            render: (r) => (
                <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 600 }}>{r.exam_title || 'Tidak Terdeteksi'}</div>
                    <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>ID: {r.exam_id || '-'}</div>
                </div>
            )
        },
        {
            header: 'Skor Detail',
            render: (r) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {r.category_scores ? (
                        Object.entries(typeof r.category_scores === 'string' ? JSON.parse(r.category_scores || '{}') : (r.category_scores || {})).map(([cat, score]) => (
                            <span key={cat} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: theme.surfaceLight, borderRadius: '4px', border: `1px solid ${theme.border}` }}>
                                {cat}: <strong>{score}</strong>
                            </span>
                        ))
                    ) : (
                        <span style={{ color: theme.textMuted }}>---</span>
                    )}
                </div>
            )
        },
        {
            header: 'Total',
            render: (r) => <span style={{ fontWeight: 900, fontSize: '1.1rem', color: theme.primary }}>{r.final_score_total}</span>,
            align: 'center'
        },
        {
            header: 'Status',
            render: (r) => <Badge type={r.is_passed ? 'success' : 'danger'}>{r.is_passed ? 'LULUS' : 'GAGAL'}</Badge>,
            align: 'center'
        },
        {
            header: 'Aksi',
            align: 'center',
            render: (r) => (
                <Button
                    variant="outline"
                    onClick={() => handleShowSessionReview(r)}
                    style={{ scale: '0.9' }}
                >
                    🔍 Detail Review
                </Button>
            )
        }
    ];

    return (
        <Card style={{ padding: '1.5rem' }}>
            <InfoNote title="Hasil Ujian" style={{ marginBottom: '1.25rem' }}>
                Halaman ini menampilkan rekap hasil peserta yang sudah selesai. Gunakan filter sesi dan pencarian untuk menemukan peserta, lalu export ke Excel/PDF bila diperlukan.
            </InfoNote>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flex: 1, gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: theme.textMuted, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Filter Sesi Ujian</label>
                        <select
                            value={selectedExamId}
                            onChange={e => { setSelectedExamId(e.target.value); setCurrentPage(1); }}
                            style={{
                                width: '100%',
                                background: theme.surfaceLight,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '12px',
                                padding: '0.75rem 1rem',
                                color: theme.text,
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        >
                            <option value="">Semua Sesi Ujian</option>
                            {exams.map(ex => (
                                <option key={ex.id} value={ex.id}>{ex.title}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: theme.textMuted, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cari Peserta</label>
                        <Input
                            placeholder="Cari Nama/NIK/No Ujian..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            icon={<Icons.Search />}
                            style={{ padding: '0.75rem 1rem 0.75rem 3rem' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Button variant="outline" onClick={exportExcel} disabled={filteredResults.length === 0}>
                        📊 Export Excel (.xlsx)
                    </Button>
                    <Button
                        onClick={() => exportResultsToPDF(filteredResults, 'Hasil Ujian CAT Pro', categories)}
                        disabled={filteredResults.length === 0}
                    >
                        📄 Download PDF
                    </Button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={paginatedResults}
                loading={loading}
                emptyMessage={selectedExamId || searchTerm ? "Tidak ditemukan hasil untuk kriteria ini." : "Belum ada hasil ujian tersedia."}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem', gap: '0.5rem' }}>
                    <Button
                        variant="ghost"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        ← Prev
                    </Button>

                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {[...Array(totalPages)].map((_, i) => {
                            const pageNum = i + 1;
                            // Show first, last, and pages around current
                            if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)) {
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: currentPage === pageNum ? theme.gradPrimary : 'transparent',
                                            color: currentPage === pageNum ? 'white' : theme.text,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                                return <span key={pageNum} style={{ alignSelf: 'center', color: theme.textMuted }}>...</span>;
                            }
                            return null;
                        })}
                    </div>

                    <Button
                        variant="ghost"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        style={{ padding: '0.5rem 1rem' }}
                    >
                        Next →
                    </Button>
                </div>
            )}
        </Card>
    );
}

