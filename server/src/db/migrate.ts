import fs from 'fs';
import path from 'path';
import db from '../config/db';

export function runMigrations() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('Database migrations complete.');
}
