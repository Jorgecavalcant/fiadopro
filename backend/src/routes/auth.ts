import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database.js';
import { signToken, verifyToken, setAuthCookie, clearAuthCookie } from '../utils/jwt.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const RegisterSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Precisa de pelo menos 1 letra maiuscula')
    .regex(/[0-9]/, 'Precisa de pelo menos 1 numero'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Voce precisa aceitar a Politica de Privacidade e os Termos de Uso para se cadastrar' }),
  }),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const existing = await query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      return next(new ApiError(409, 'E-mail ja cadastrado', 'EMAIL_EXISTS'));
    }
    const hash = await bcrypt.hash(body.password, 12);
    const consentIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const result = await query(
      'INSERT INTO users (full_name, email, password_hash, consent_at, consent_ip) VALUES ($1, $2, $3, NOW(), $4) RETURNING id, email, full_name, created_at',
      [body.full_name, body.email, hash, consentIp]
    );
    const user = result.rows[0];
    // Vincular clientes já cadastrados por terceiros com este e-mail + promover admin se for o ADMIN_EMAIL
    const { relinkCustomersForUser, ensureAdminRole } = await import('../services/linking.js');
    await ensureAdminRole();
    await relinkCustomersForUser(user.id);
    const roleResult = await query('SELECT role FROM users WHERE id = $1', [user.id]);
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    res.status(201).json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: roleResult.rows[0]?.role ?? 'user' },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginSchema.parse(req.body);
    const result = await query(
      'SELECT id, email, full_name, password_hash, is_active, role FROM users WHERE email = $1',
      [body.email]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(body.password, user.password_hash))) {
      return next(new ApiError(401, 'E-mail ou senha incorretos', 'INVALID_CREDENTIALS'));
    }
    if (!user.is_active) {
      return next(new ApiError(403, 'Conta desativada', 'ACCOUNT_DISABLED'));
    }
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    res.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return next(new ApiError(400, 'Token do Google nao informado', 'MISSING_TOKEN'));
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return next(new ApiError(401, 'Token do Google invalido', 'INVALID_GOOGLE_TOKEN'));
    }
    const { sub: google_id, email, name: full_name, picture: avatar_url } = payload;
    let result = await query(
      'SELECT id, email, full_name, is_active, role FROM users WHERE google_id = $1 OR email = $2',
      [google_id, email]
    );
    let user = result.rows[0];
    if (!user) {
      const insert = await query(
        'INSERT INTO users (email, full_name, avatar_url, google_id) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name',
        [email, full_name || email, avatar_url || null, google_id]
      );
      user = insert.rows[0];
      const { relinkCustomersForUser, ensureAdminRole } = await import('../services/linking.js');
      await ensureAdminRole();
      await relinkCustomersForUser(user.id);
      user.role = (await query('SELECT role FROM users WHERE id = $1', [user.id])).rows[0]?.role ?? 'user';
    } else {
      await query(
        'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
        [google_id, avatar_url || null, user.id]
      );
      if (!user.is_active) {
        return next(new ApiError(403, 'Conta desativada', 'ACCOUNT_DISABLED'));
      }
    }
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(res, token);
    res.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role ?? 'user' },
    });
  } catch (err: any) {
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return next(new ApiError(401, 'Token do Google expirado ou invalido', 'INVALID_GOOGLE_TOKEN'));
    }
    next(err);
  }
});

// POST /api/auth/verify
router.post('/verify', (req: Request, res: Response) => {
  try {
    const token = String(req.body?.token || '');
    const payload = verifyToken(token);
    res.json({ success: true, valid: true, user: payload });
  } catch {
    res.status(401).json({ success: false, valid: false });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, phone, pix_key, avatar_url, role, created_at FROM users WHERE id = $1',
      [req.user!.sub]
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ApiError(400, 'E-mail obrigatorio', 'MISSING_EMAIL'));
    const result = await query('SELECT id FROM users WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'Se o e-mail existir, voce recebera o link em breve.' });
    }
    const userId = result.rows[0].id;
    await query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false', [userId]);
    const { v4: uuidv4 } = await import('uuid');
    const token = uuidv4().replace(/-/g, '');
    await query('INSERT INTO password_reset_tokens (user_id, token) VALUES ($1, $2)', [userId, token]);
    const { sendPasswordResetEmail } = await import('../services/email.js');
    await sendPasswordResetEmail(email, token);
    res.json({ success: true, message: 'Se o e-mail existir, voce recebera o link em breve.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return next(new ApiError(400, 'Token e senha obrigatorios', 'MISSING_FIELDS'));
    if (password.length < 8) return next(new ApiError(400, 'Senha deve ter ao menos 8 caracteres', 'WEAK_PASSWORD'));
    if (!/[A-Z]/.test(password)) return next(new ApiError(400, 'Senha precisa de pelo menos 1 letra maiuscula', 'WEAK_PASSWORD'));
    if (!/[0-9]/.test(password)) return next(new ApiError(400, 'Senha precisa de pelo menos 1 numero', 'WEAK_PASSWORD'));
    const result = await query(
      'SELECT t.id, t.user_id, u.email, u.full_name FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = $1 AND t.used = false AND t.expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0) {
      return next(new ApiError(400, 'Link invalido ou expirado. Solicite um novo.', 'INVALID_TOKEN'));
    }
    const { id: tokenId, user_id, email, full_name } = result.rows[0];
    const hash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user_id]);
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenId]);
    const jwtToken = signToken({ sub: user_id, email });
    setAuthCookie(res, jwtToken);
    res.json({ success: true, user: { id: user_id, email, full_name } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req as any).cookies?.fiado_token;
    if (!token) return next(new ApiError(401, 'Sem sessao ativa', 'NO_TOKEN'));
    const payload = verifyToken(token);
    const newToken = signToken({ sub: payload.sub, email: payload.email });
    setAuthCookie(res, newToken);
    res.json({ success: true });
  } catch {
    next(new ApiError(401, 'Token invalido ou expirado', 'INVALID_TOKEN'));
  }
});

export default router;
