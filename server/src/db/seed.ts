import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { config } from '../config/env';
import { runMigrations } from './migrate';

runMigrations();

const email = process.env.ADMIN_EMAIL || 'admin@numbers10.co.za';
const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('base64url');
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
  console.log(`  ⚠️  Save this password now — it won't be shown again.`);
} else {
  console.log('Admin account already exists.');
}
