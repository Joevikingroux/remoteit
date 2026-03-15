import db from '../config/db';

interface AuditEntry {
  sessionId: string;
  actor: 'technician' | 'client' | 'system';
  actorId?: string;
  action: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export function logAudit(entry: AuditEntry) {
  db.prepare(
    `INSERT INTO audit_log (session_id, actor, actor_id, action, details, ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    entry.sessionId,
    entry.actor,
    entry.actorId || null,
    entry.action,
    JSON.stringify(entry.details || {}),
    entry.ip || null
  );
}
