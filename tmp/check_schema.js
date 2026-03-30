const db = require('./server/db');

async function checkSchema() {
  console.log('Checking database schema...');
  try {
    const tables = ['participants', 'exams', 'questions', 'exam_sessions', 'answers'];
    for (const table of tables) {
      console.log(`\n--- Schema for table: ${table} ---`);
      await new Promise((resolve) => {
        db.all(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table], (err, rows) => {
          if (err) {
            console.error(`Error checking ${table}: ${err.message}`);
          } else {
            console.table(rows);
          }
          resolve();
        });
      });
    }
    process.exit(0);
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

checkSchema();
