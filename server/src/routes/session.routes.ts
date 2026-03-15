import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sessionCreateLimiter, codeClaimLimiter } from '../middleware/rateLimiter';
import * as sessionService from '../services/session.service';

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

router.get('/', authMiddleware, (_req: AuthRequest, res: Response) => {
  const sessions = sessionService.getActiveSessions();
  res.json(sessions);
});

export default router;
