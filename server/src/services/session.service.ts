import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { config } from '../config/env';
import { generateSessionCode } from '../utils/codeGenerator';
import { logAudit } from './audit.service';

export interface Session {
  id: string;
  code: string;
  status: string;
  technician_id: string | null;
  client_ip: string | null;
  client_user_agent: string | null;
  created_at: string;
  claimed_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  duration_seconds: number | null;
}

export function createSession(clientIp: string, userAgent?: string) {
  let code: string;
  let attempts = 0;
  do {
    code = generateSessionCode();
    const existing = db.prepare('SELECT id FROM sessions WHERE code = ? AND status != ?').get(code, 'ended');
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) throw new Error('Failed to generate unique session code');

  const id = uuidv4();
  db.prepare(
    `INSERT INTO sessions (id, code, status, client_ip, client_user_agent)
     VALUES (?, ?, 'waiting', ?, ?)`
  ).run(id, code, clientIp, userAgent || null);

  logAudit({ sessionId: id, actor: 'system', action: 'session_created', ip: clientIp });

  const expiresAt = new Date(Date.now() + config.sessionCodeExpiryMinutes * 60 * 1000).toISOString();

  return { id, code, expiresAt };
}

export function getSessionByCode(code: string): Session | undefined {
  return db.prepare('SELECT * FROM sessions WHERE code = ?').get(code) as Session | undefined;
}

export function claimSession(code: string, technicianId: string) {
  const session = getSessionByCode(code);
  if (!session) throw new Error('Session not found');
  if (session.status === 'ended') throw new Error('Session has ended');
  if (session.technician_id && session.technician_id !== technicianId) {
    throw new Error('Session already claimed by another technician');
  }

  const createdAt = new Date(session.created_at + 'Z').getTime();
  const expiryMs = config.sessionCodeExpiryMinutes * 60 * 1000;
  if (Date.now() - createdAt > expiryMs && !session.technician_id) {
    throw new Error('Session code has expired');
  }

  db.prepare(
    `UPDATE sessions SET status = 'claimed', technician_id = ?, claimed_at = datetime('now')
     WHERE code = ?`
  ).run(technicianId, code);

  logAudit({ sessionId: session.id, actor: 'technician', actorId: technicianId, action: 'session_claimed' });

  return { ...session, status: 'claimed', technician_id: technicianId };
}

export function updateSessionStatus(code: string, status: string) {
  db.prepare('UPDATE sessions SET status = ? WHERE code = ?').run(status, code);
}

export function endSession(code: string, reason: string) {
  const session = getSessionByCode(code);
  if (!session) return;

  const createdAt = new Date(session.created_at + 'Z').getTime();
  const duration = Math.floor((Date.now() - createdAt) / 1000);

  db.prepare(
    `UPDATE sessions SET status = 'ended', ended_at = datetime('now'), end_reason = ?, duration_seconds = ?
     WHERE code = ?`
  ).run(reason, duration, code);

  logAudit({ sessionId: session.id, actor: 'system', action: 'session_ended', details: { reason } });
}

export function cleanupExpiredSessions() {
  const expiryMinutes = config.sessionCodeExpiryMinutes;
  const result = db.prepare(
    `UPDATE sessions SET status = 'ended', end_reason = 'expired', ended_at = datetime('now')
     WHERE status IN ('created', 'waiting')
     AND datetime(created_at, '+' || ? || ' minutes') < datetime('now')`
  ).run(expiryMinutes);
  return result.changes;
}

export function updateSessionNotes(code: string, notes: string, tags: string[]) {
  const session = getSessionByCode(code);
  if (!session) throw new Error('Session not found');

  db.prepare(
    `UPDATE sessions SET notes = ?, tags = ? WHERE code = ?`
  ).run(notes, JSON.stringify(tags), code);

  logAudit({ sessionId: session.id, actor: 'technician', action: 'notes_updated', details: { tags } });

  return { ...session, notes, tags };
}

export function getActiveSessions() {
  return db.prepare(
    `SELECT s.*, t.name as technician_name FROM sessions s
     LEFT JOIN technicians t ON s.technician_id = t.id
     WHERE s.status NOT IN ('ended')
     ORDER BY s.created_at DESC`
  ).all();
}
