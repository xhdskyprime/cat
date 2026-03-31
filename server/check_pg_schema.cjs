const db = require('./db');

db.all(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
`, [], (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('TABLE_NAME | COLUMN_NAME | DATA_TYPE');
    console.log('-----------------------------------');
    rows.forEach(r => {
        console.log(`${r.table_name} | ${r.column_name} | ${r.data_type}`);
    });
    process.exit(0);
});
