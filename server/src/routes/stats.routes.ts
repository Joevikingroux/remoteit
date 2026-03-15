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

export default router;
