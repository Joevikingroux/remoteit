import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sessionCreateLimiter, codeClaimLimiter } from '../middleware/rateLimiter';
import * as sessionService from '../services/session.service';
import db from '../config/db';

const router = Router();

router.post('/create', sessionCreateLimiter, (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];
    const session = sessionService.createSession(clientIp, userAgent);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Must be before /:code routes so "history" isn't matched as a code param
router.get('/', authMiddleware, (_req: AuthRequest, res: Response) => {
  const sessions = sessionService.getActiveSessions();
  res.json(sessions);
});

router.get('/history', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('s.code LIKE ?');
      params.push(`%${search.toUpperCase()}%`);
    }

    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRow = db.prepare(
      `SELECT COUNT(*) as count FROM sessions s ${whereClause}`
    ).get(...params) as { count: number };

    const total = totalRow.count;
    const totalPages = Math.ceil(total / limit);

    const sessions = db.prepare(
      `SELECT s.*, t.name as technician_name FROM sessions s
       LEFT JOIN technicians t ON s.technician_id = t.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ sessions, total, page, totalPages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code/status', (req: Request, res: Response) => {
  const session = sessionService.getSessionByCode(req.params.code.toUpperCase());
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    status: session.status,
    connectedAt: session.connected_at,
    technicianId: session.technician_id,
  });
});

router.post('/:code/claim', authMiddleware, codeClaimLimiter, (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code.toUpperCase();
    const session = sessionService.claimSession(code, req.user!.id);
    res.json(session);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('expired') ? 410
      : err.message.includes('already claimed') ? 409
      : 400;
    res.status(status).json({ error: err.message });
  }
});

router.put('/:code/notes', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code.toUpperCase();
    const { notes, tags } = req.body;
    const result = sessionService.updateSessionNotes(
      code,
      notes || '',
      Array.isArray(tags) ? tags : []
    );
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/:code/end', (req: Request, res: Response) => {
  try {
    const code = req.params.code.toUpperCase();
    const reason = req.body.reason || 'manual';
    sessionService.endSession(code, reason);
    res.json({ message: 'Session ended' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
