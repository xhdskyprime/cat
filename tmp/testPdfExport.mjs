import { exportResultsToPDF, exportBeritaAcara } from '../src/utils/pdfExport.js';

// Dummy data for results
const dummyResults = [
    {
        nama: 'John Doe',
        nomor_peserta: '12345',
        category_scores: JSON.stringify({ TWK: 80, TIU: 70, TKP: 90 }),
        final_score_total: 240,
        is_passed: true,
    },
    {
        nama: 'Jane Smith',
        nomor_peserta: '67890',
        category_scores: JSON.stringify({ TWK: 60, TIU: 55, TKP: 65 }),
        final_score_total: 180,
        is_passed: false,
    },
];

exportResultsToPDF(dummyResults, 'Ujian Dummy');

const dummyExamData = { title: 'Ujian Dummy' };
const dummyStats = {
    totalParticipants: 2,
    finishedCount: 2,
    passedCount: 1,
};

exportBeritaAcara(dummyExamData, dummyStats);

console.log('PDF export test completed');
