const db = require('../server/db');

async function checkConstraints() {
  console.log('Checking constraints and table info...');
  try {
    const queries = [
      { 
        name: 'Unique Constraints', 
        sql: `
          SELECT conname, contype, pg_get_constraintdef(c.oid) 
          FROM pg_constraint c 
          JOIN pg_namespace n ON n.oid = c.connamespace 
          WHERE n.nspname = 'public' AND c.conrelid = 'answers'::regclass
        ` 
      },
      {
        name: 'Answers Table Columns',
        sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'answers'"
      },
      {
        name: 'Exam Sessions Table Columns',
        sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'exam_sessions'"
      }
    ];
    for (const q of queries) {
      console.log(`\n--- ${q.name} ---`);
      await new Promise((resolve) => {
        db.all(q.sql, [], (err, rows) => {
          if (err) {
            console.error(`Error checking ${q.name}: ${err.message}`);
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

checkConstraints();
