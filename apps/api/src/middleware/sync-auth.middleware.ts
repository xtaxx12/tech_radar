import type { NextFunction, Request, Response } from 'express';
import { isAuthEnabled, readSessionCookie, verifySession } from '../lib/auth.js';

/**
 * Protege POST /sync contra abuso externo (scraping + IA cuestan dinero y
 * tiempo). Acepta la request si:
 *
 *  - Hay una `SYNC_API_KEY` configurada y el header `X-API-Key` la matchea, o
 *  - El usuario está autenticado (cookie de sesión válida), o
 *  - No hay auth configurado ni API key (modo dev local sin fricción).
 *
 * En cualquier otro caso devuelve 401. Mantener la excepción de "dev sin
 * nada configurado" hace que clonar el repo + `npm run dev` siga funcionando
 * sin tocar el .env.
 */

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function readAuthToken(req: Request): string | null {
  return readSessionCookie(req.cookies) ?? readBearerToken(req);
}

function readApiKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]) return header[0]!.trim();
  return null;
}

export function requireSyncAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.SYNC_API_KEY?.trim();
  const authEnabled = isAuthEnabled();

  // Modo dev sin fricción: nada configurado → dejar pasar.
  if (!expectedKey && !authEnabled) {
    next();
    return;
  }

  // API key directa (útil para cron jobs / scripts).
  if (expectedKey) {
    const provided = readApiKey(req);
    if (provided && provided === expectedKey) {
      next();
      return;
    }
  }

  // Sesión de usuario autenticado.
  if (authEnabled) {
    const token = readAuthToken(req);
    const session = token ? verifySession(token) : null;
    if (session) {
      next();
      return;
    }
  }

  res.status(401).json({
    error: 'sync_forbidden',
    message: 'Sync manual requiere sesión autenticada o header X-API-Key.'
  });
}
