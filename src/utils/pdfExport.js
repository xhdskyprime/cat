import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportResultsToPDF = (results, examTitle = 'Hasil Ujian CAT', categories = []) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── HEADER ───────────────────────────────────────────────────────────
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate-900
    doc.text(examTitle.toUpperCase(), pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('Dihasilkan secara otomatis oleh Sistem CAT Pro', pageWidth / 2, 28, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(15, 35, pageWidth - 15, 35);

    // ── DATA PREPARATION ───────────────────────────────────────────────
    const tableRows = results.map((row, index) => {
        let scores = {};
        try {
            scores = typeof row.category_scores === 'string'
                ? JSON.parse(row.category_scores)
                : row.category_scores || {};
        } catch (_e) { void _e; }

        return [
            index + 1,
            row.nama,
            row.nomor_peserta,
            ...categories.map(c => scores[c.id] || 0),
            row.final_score_total || 0,
            row.is_passed ? 'LULUS' : 'TIDAK LULUS'
        ];
    });

    // ── TABLE ────────────────────────────────────────────────────────────
    const headData = ['NO', 'NAMA PESERTA', 'NOMOR', ...categories.map(c => c.id || c.name), 'TOTAL', 'STATUS'];
    const colStyles = {
        0: { halign: 'center', cellWidth: 10 }
    };
    categories.forEach((_, i) => colStyles[3 + i] = { halign: 'center' });
    colStyles[3 + categories.length] = { halign: 'center', fontStyle: 'bold' };
    colStyles[3 + categories.length + 1] = { halign: 'center' };

    doc.autoTable({
        startY: 45,
        head: [headData],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [79, 70, 229], // Indigo-600
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: colStyles,
        styles: {
            fontSize: 9,
            cellPadding: 4
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === headData.length - 1) {
                if (data.cell.raw === 'LULUS') {
                    data.cell.styles.textColor = [22, 163, 74]; // Green-600
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [220, 38, 38]; // Red-600
                }
            }
        }
    });

    // ── FOOTER ───────────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Halaman ${i} dari ${pageCount} | Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    doc.save(`Hasil_Ujian_${examTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
};

export const exportBeritaAcara = (examData, stats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── KOP SURAT ──────────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BERITA ACARA PELAKSANAAN UJIAN', pageWidth / 2, 25, { align: 'center' });
    doc.line(20, 30, pageWidth - 20, 30);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const startY = 45;
    const lineHeight = 8;

    doc.text(`Nama Ujian    : ${examData.title}`, 20, startY);
    doc.text(`Tanggal       : ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 20, startY + lineHeight);
    doc.text(`Waktu Selesai : ${new Date().toLocaleTimeString('id-ID')}`, 20, startY + lineHeight * 2);

    doc.text('STATISTIK PELAKSANAAN:', 20, startY + lineHeight * 4);

    const statsData = [
        ['Total Peserta Terdaftar', `${stats.totalParticipants} Orang`],
        ['Peserta Hadir/Selesai', `${stats.finishedCount} Orang`],
        ['Peserta Tidak Hadir', `${stats.totalParticipants - stats.finishedCount} Orang`],
        ['Tingkat Kelulusan', `${((stats.passedCount / stats.finishedCount) * 100).toFixed(1)}%`]
    ];

    doc.autoTable({
        startY: startY + lineHeight * 5,
        body: statsData,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } }
    });

    const finalY = doc.previousAutoTable.finalY + 20;
    doc.text('Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.', 20, finalY);

    const signY = finalY + 40;
    doc.text('Panitia Pelaksana,', pageWidth - 70, signY);
    doc.text('( ____________________ )', pageWidth - 70, signY + 30);

    doc.save(`Berita_Acara_${examData.title.replace(/\s+/g, '_')}.pdf`);
};
