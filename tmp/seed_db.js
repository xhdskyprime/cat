const db = require('./server/db');

async function seedTemplates() {
  console.log('Seeding appearance templates...');
  try {
    const templates = [
      ['education', 'Classic Education', 'Standard clean look for general exams', false],
      ['emerald', 'Emerald Modern', 'Modern green aesthetic with healthy vibes', false],
      ['ocean', 'Ocean Blue', 'Professional blue theme for corporate use', false],
      ['amethyst', 'Amethyst Purple', 'Elegant purple design for creative assessments', false]
    ];

    for (const [id, name, description, is_custom] of templates) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO appearance_templates (id, name, description, is_custom) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [id, name, description, is_custom],
          (err) => err ? reject(err) : resolve()
        );
      });
      console.log(`- Seeded: ${name}`);
    }

    // Also seed default settings if missing
    const defaultSettings = [
      ['app_name', 'CAT SYSTEM'],
      ['app_version_label', 'v2.5'],
      ['active_template', 'emerald'],
      ['max_tab_violations', '3'],
      ['max_fs_violations', '3'],
      ['require_fullscreen', '1']
    ];

    for (const [key, value] of defaultSettings) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [key, value],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seedTemplates();
