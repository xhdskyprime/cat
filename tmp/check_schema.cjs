const db = require('../server/db');

async function checkIds() {
  console.log('Checking ID formats in database...');
  try {
    const queries = [
      { name: 'Questions IDs (Sample)', sql: 'SELECT id, category FROM questions LIMIT 5' },
      { name: 'Exam Sessions (Sample)', sql: 'SELECT id, participant_id, exam_id FROM exam_sessions LIMIT 5' },
      { name: 'Answers (Sample)', sql: 'SELECT id, session_id, question_id FROM answers LIMIT 5' }
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

checkIds();
