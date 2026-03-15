import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { config } from '../config/env';
import { runMigrations } from './migrate';

runMigrations();

const email = 'admin@numbers10.co.za';
const password = 'Admin123!';
const name = 'Admin';

const existing = db.prepare('SELECT id FROM technicians WHERE email = ?').get(email);

if (!existing) {
  const hash = bcrypt.hashSync(password, config.bcryptRounds);
  db.prepare(
    'INSERT INTO technicians (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), email, hash, name, 'admin');
  console.log(`Admin account created: ${email} / ${password}`);
} else {
  console.log('Admin account already exists.');
}
