import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { login, refreshAccessToken } from '../services/auth.service';
import { loginLimiter } from '../middleware/rateLimiter';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

router.post('/login', loginLimiter, (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log('[AUTH] Login attempt:', { email, passwordLength: password?.length, bodyKeys: Object.keys(req.body), origin: req.headers.origin });
    if (!email || !password) {
      console.log('[AUTH] Missing email or password');
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    const result = login(email, password);
    console.log('[AUTH] Login success for:', email);
    res.json(result);
  } catch (err: any) {
    console.log('[AUTH] Login failed for:', req.body.email, '- reason:', err.message);
    res.status(401).json({ error: err.message });
  }
});

router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});

router.post('/change-password', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(req.user!.id) as { id: string; password_hash: string } | undefined;
    if (!tech) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const valid = bcrypt.compareSync(currentPassword, tech.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const passwordHash = bcrypt.hashSync(newPassword, 12);
    db.prepare(
      "UPDATE technicians SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(passwordHash, tech.id);

    res.json({ message: 'Password changed successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
