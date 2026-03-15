import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { config } from '../config/env';

interface Technician {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  is_active: number;
}

interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function login(email: string, password: string) {
  const tech = db.prepare('SELECT * FROM technicians WHERE email = ? AND is_active = 1').get(email) as Technician | undefined;
  if (!tech) throw new Error('Invalid credentials');

  const valid = bcrypt.compareSync(password, tech.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  const payload: TokenPayload = { id: tech.id, email: tech.email, name: tech.name, role: tech.role };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });
  const refreshToken = jwt.sign({ id: tech.id, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshTokenExpiry });

  return { token, refreshToken, user: payload };
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

export function refreshAccessToken(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, config.jwtSecret) as { id: string; type: string };
  if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');

  const tech = db.prepare('SELECT * FROM technicians WHERE id = ? AND is_active = 1').get(decoded.id) as Technician | undefined;
  if (!tech) throw new Error('Technician not found');

  const payload: TokenPayload = { id: tech.id, email: tech.email, name: tech.name, role: tech.role };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });

  return { token, user: payload };
}
