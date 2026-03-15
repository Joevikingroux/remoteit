import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/technicians — list all technicians
router.get('/technicians', (_req: AuthRequest, res: Response) => {
  const technicians = db.prepare(
    'SELECT id, email, name, role, is_active, created_at FROM technicians ORDER BY created_at DESC'
  ).all();
  res.json(technicians);
});

// POST /api/admin/technicians — create technician
router.post('/technicians', (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ error: 'Email, name, and password are required' });
      return;
    }

    const validRoles = ['technician', 'admin'];
    const techRole = validRoles.includes(role) ? role : 'technician';

    const existing = db.prepare('SELECT id FROM technicians WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'A technician with this email already exists' });
      return;
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 12);

    db.prepare(
      `INSERT INTO technicians (id, email, name, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, email, name, passwordHash, techRole);

    res.status(201).json({ id, email, name, role: techRole, is_active: 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/technicians/:id — update technician
router.put('/technicians/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;

    const tech = db.prepare('SELECT id FROM technicians WHERE id = ?').get(id);
    if (!tech) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    if (email) {
      const existing = db.prepare('SELECT id FROM technicians WHERE email = ? AND id != ?').get(email, id);
      if (existing) {
        res.status(409).json({ error: 'A technician with this email already exists' });
        return;
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (role !== undefined) {
      const validRoles = ['technician', 'admin'];
      if (validRoles.includes(role)) { fields.push('role = ?'); values.push(role); }
    }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE technicians SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare(
      'SELECT id, email, name, role, is_active, created_at FROM technicians WHERE id = ?'
    ).get(id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/technicians/:id — deactivate technician
router.delete('/technicians/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tech = db.prepare('SELECT id FROM technicians WHERE id = ?').get(id);
    if (!tech) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    db.prepare(
      "UPDATE technicians SET is_active = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(id);

    res.json({ message: 'Technician deactivated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/technicians/:id/reset-password — admin resets password
router.post('/technicians/:id/reset-password', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const tech = db.prepare('SELECT id FROM technicians WHERE id = ?').get(id);
    if (!tech) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    db.prepare(
      "UPDATE technicians SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(passwordHash, id);

    res.json({ message: 'Password reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
