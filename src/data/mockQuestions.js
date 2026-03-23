export const mockQuestions = [
    // --- TWK (Tes Wawasan Kebangsaan) - Benar: 5, Salah: 0 ---
    {
        id: 1,
        category: 'TWK',
        question: 'Pancasila sebagai dasar negara secara resmi disahkan oleh PPKI pada tanggal...',
        options: [
            { id: 'A', text: '1 Juni 1945', score: 0 },
            { id: 'B', text: '22 Juni 1945', score: 0 },
            { id: 'C', text: '17 Agustus 1945', score: 0 },
            { id: 'D', text: '18 Agustus 1945', score: 5 },
            { id: 'E', text: '1 Oktober 1945', score: 0 }
        ]
    },
    {
        id: 2,
        category: 'TWK',
        question: 'Semboyan Bhinneka Tunggal Ika tertulis pada lambang negara Garuda Pancasila. Kalimat tersebut diambil dari kitab...',
        options: [
            { id: 'A', text: 'Negarakertagama', score: 0 },
            { id: 'B', text: 'Sutasoma', score: 5 },
            { id: 'C', text: 'Arjunawiwaha', score: 0 },
            { id: 'D', text: 'Pararaton', score: 0 },
            { id: 'E', text: 'Ramayana', score: 0 }
        ]
    },

    // --- TIU (Tes Intelegensia Umum) - Benar: 5, Salah: 0 ---
    {
        id: 3,
        category: 'TIU',
        question: 'KENDARAAN : MOBIL = BIAYA : ...',
        options: [
            { id: 'A', text: 'Ongkos', score: 5 },
            { id: 'B', text: 'Uang', score: 0 },
            { id: 'C', text: 'Rugi', score: 0 },
            { id: 'D', text: 'Pendapatan', score: 0 },
            { id: 'E', text: 'Harga', score: 0 }
        ]
    },
    {
        id: 4,
        category: 'TIU',
        question: 'Jika x = 15% dari 40, dan y = 20% dari 30. Maka hubungan x dan y adalah...',
        options: [
            { id: 'A', text: 'x > y', score: 0 },
            { id: 'B', text: 'x < y', score: 0 },
            { id: 'C', text: 'x = y', score: 5 },
            { id: 'D', text: 'x = 2y', score: 0 },
            { id: 'E', text: 'Hubungan x dan y tidak dapat ditentukan', score: 0 }
        ]
    },

    // --- TKP (Tes Karakteristik Pribadi) - Skala: 1-5 ---
    {
        id: 5,
        category: 'TKP',
        question: 'Anda ditugaskan ke sebuah daerah pelosok yang minim sinyal internet dan fasilitas, padahal Anda terbiasa hidup di kota besar yang semuanya mudah. Sikap Anda...',
        options: [
            { id: 'A', text: 'Menerima tugas tersebut namun meminta untuk dipindahkan setelah beberapa bulan', score: 3 },
            { id: 'B', text: 'Menolak tugas tersebut dan meminta penempatan di daerah yang lebih dekat', score: 1 },
            { id: 'C', text: 'Menerima tugas dengan senang hati dan berusaha beradaptasi dengan lingkungan baru', score: 5 },
            { id: 'D', text: 'Menjalani tugas dengan setengah hati sambil terus mengeluh', score: 2 },
            { id: 'E', text: 'Menerima tugas agar terlihat baik oleh atasan meskipun merasa terpaksa', score: 4 }
        ]
    }
];
