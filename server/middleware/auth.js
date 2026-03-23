const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_JWT_SECRET || !JWT_SECRET) {
    throw new Error('JWT secrets belum dikonfigurasi. Pastikan ADMIN_JWT_SECRET dan JWT_SECRET terisi di environment.');
}

// Rate Limiter khusus route login
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    message: { error: 'Terlalu banyak percobaan login dari IP ini. Silakan coba lagi setelah 5 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware Proteksi JWT Peserta
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Akses ditolak. Sesi tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Sesi ujian telah berakhir/tidak valid.' });
        req.user = user;
        next();
    });
};

// Middleware Proteksi JWT Admin
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Akses Admin ditolak.' });

    jwt.verify(token, ADMIN_JWT_SECRET, (err, decoded) => {
        if (err || !decoded || !decoded.role) return res.status(403).json({ error: 'Token admin tidak valid.' });
        req.admin = decoded;
        next();
    });
};

// Middleware Proteksi Superadmin
const authenticateSuperadmin = (req, res, next) => {
    authenticateAdmin(req, res, () => {
        if (req.admin.role !== 'superadmin') {
            return res.status(403).json({ error: 'Akses dilarang. Membutuhkan role superadmin.' });
        }
        next();
    });
};

module.exports = {
    loginLimiter,
    authenticate,
    authenticateAdmin,
    authenticateSuperadmin,
    ADMIN_JWT_SECRET,
    JWT_SECRET
};
