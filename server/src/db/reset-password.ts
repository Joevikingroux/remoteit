import bcrypt from 'bcryptjs';
import db from '../config/db';
import { config } from '../config/env';

const email = process.argv[2] || 'admin@numbers10.co.za';
const newPassword = process.argv[3];

if (!newPassword) {
  console.error('Usage: npx tsx src/db/reset-password.ts <email> <new-password>');
  process.exit(1);
}

const tech = db.prepare('SELECT id, name FROM technicians WHERE email = ?').get(email) as any;

if (!tech) {
  console.error(`No technician found with email: ${email}`);
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, config.bcryptRounds);
db.prepare('UPDATE technicians SET password_hash = ?, updated_at = datetime(\'now\') WHERE email = ?').run(hash, email);

console.log(`Password reset for ${tech.name} (${email})`);
