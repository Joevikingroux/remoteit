import fs from 'fs';
import path from 'path';
import db from '../config/db';

export function runMigrations() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Add notes/tags columns if missing (migration for existing databases)
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN notes TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]'`);
  } catch {}

  console.log('Database migrations complete.');
}
