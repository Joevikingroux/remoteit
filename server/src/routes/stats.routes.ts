import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

router.get('/dashboard', authMiddleware, (_req: AuthRequest, res: Response) => {
  const activeSessions = db.prepare(
    "SELECT COUNT(*) as count FROM sessions WHERE status NOT IN ('ended', 'created')"
  ).get() as { count: number };

  const todayTotal = db.prepare(
    "SELECT COUNT(*) as count FROM sessions WHERE date(created_at) = date('now')"
  ).get() as { count: number };

  const avgDuration = db.prepare(
    "SELECT AVG(duration_seconds) as avg FROM sessions WHERE status = 'ended' AND duration_seconds IS NOT NULL AND date(created_at) = date('now')"
  ).get() as { avg: number | null };

  res.json({
    activeSessions: activeSessions.count,
    todayTotal: todayTotal.count,
    avgDuration: Math.round(avgDuration.avg || 0),
  });
});

router.get('/audit-log', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const totalRow = db.prepare(
      'SELECT COUNT(*) as count FROM audit_log'
    ).get() as { count: number };

    const total = totalRow.count;
    const totalPages = Math.ceil(total / limit);

    const entries = db.prepare(
      `SELECT a.*, s.code as session_code, s.status as session_status
       FROM audit_log a
       LEFT JOIN sessions s ON a.session_id = s.id
       ORDER BY a.timestamp DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    res.json({ entries, total, page, totalPages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
