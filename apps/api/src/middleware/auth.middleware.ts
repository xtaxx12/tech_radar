import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { isAuthEnabled, readSessionCookie, verifySession } from '../lib/auth.js';
import { userRepository, type AppUser } from '../repositories/user.repository.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AppUser;
  }
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  if (!isAuthEnabled()) return next();

  const token = readSessionCookie(req.cookies);
  if (!token) return next();

  const session = verifySession(token);
  if (!session) return next();

  try {
    const user = await userRepository.getById(session.userId);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    console.warn('[auth] optionalAuth lookup failed:', error instanceof Error ? error.message : error);
  }

  next();
};

export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!isAuthEnabled()) {
    res.status(503).json({ error: 'auth_disabled', message: 'El login de Google no está configurado en el servidor.' });
    return;
  }

  const token = readSessionCookie(req.cookies);
  const session = token ? verifySession(token) : null;

  if (!session) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  try {
    const user = await userRepository.getById(session.userId);
    if (!user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] requireAuth lookup failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'internal_server_error' });
  }
};
