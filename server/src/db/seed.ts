import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { config } from '../config/env';
import { runMigrations } from './migrate';

runMigrations();

const email = process.env.ADMIN_EMAIL || 'admin@numbers10.co.za';
const password = process.env.ADMIN_PASSWORD || 'Admin123!';
const name = process.env.ADMIN_NAME || 'Admin';

const existing = db.prepare('SELECT id FROM technicians WHERE email = ?').get(email);

if (!existing) {
  const hash = bcrypt.hashSync(password, config.bcryptRounds);
  db.prepare(
    'INSERT INTO technicians (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), email, hash, name, 'admin');
  console.log(`Admin account created!`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  ⚠️  Change this password after first login.`);
} else {
  console.log('Admin account already exists.');
}
