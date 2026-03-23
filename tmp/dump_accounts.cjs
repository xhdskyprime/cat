const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server', 'cat.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('--- PARTICIPANTS ---');
    db.all("SELECT nik, nomor_peserta, exam_id FROM participants LIMIT 5", (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));

        console.log('--- EXAMS ---');
        db.all("SELECT id, token FROM exams WHERE is_active = 1 LIMIT 5", (err, rows) => {
            if (err) console.error(err);
            else console.log(JSON.stringify(rows, null, 2));
            db.close();
        });
    });
});
