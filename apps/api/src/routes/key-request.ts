import cors from 'cors';
import { Router, type Request, type RequestHandler, type Response, type NextFunction } from 'express';
import { createRateLimiter } from '../middleware/rate-limit.middleware.js';
import { notifyNewKeyRequest } from '../lib/notifications.js';
import { apiKeyRequestRepository } from '../repositories/api-key-request.repository.js';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RX = /^https?:\/\/.+/i;

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? 'unknown';
}

export function buildKeyRequestRouter(): Router {
  const router = Router();

  // CORS abierto: el formulario puede estar en vercel (otro dominio).
  router.use(cors({ origin: '*', methods: ['POST'], allowedHeaders: ['Content-Type'], credentials: false }));

  // Anti-abuso: 3 requests por IP por hora, 1 por segundo (gatea bots básicos).
  // Reutiliza el limiter existente — no bloquea al admin porque éste usa CLI.
  const limiter = createRateLimiter({ perSecond: 1, perHour: 3 });

  router.post(
    '/request',
    limiter.middleware,
    asyncHandler(async (request, response) => {
      const body = request.body ?? {};
      const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const website = typeof body.website === 'string' ? body.website.trim() : '';
      const useCase = typeof body.useCase === 'string' ? body.useCase.trim() : '';

      const errors: Record<string, string> = {};
      if (owner.length < 2 || owner.length > 100) errors.owner = 'Nombre entre 2 y 100 caracteres.';
      if (!EMAIL_RX.test(email)) errors.email = 'Email inválido.';
      if (website && !URL_RX.test(website)) errors.website = 'La URL debe empezar con http:// o https://';
      if (useCase.length < 20 || useCase.length > 1000) {
        errors.useCase = 'Contanos en 20 a 1000 caracteres para qué lo vas a usar.';
      }

      if (Object.keys(errors).length > 0) {
        response.status(400).json({ error: 'validation_failed', fields: errors });
        return;
      }

      const record = await apiKeyRequestRepository.create({
        owner,
        email,
        website: website || null,
        useCase,
        requesterIp: clientIp(request)
      });

      // Notificación async (no bloqueamos la response si falla).
      void notifyNewKeyRequest({
        owner,
        email,
        website: website || null,
        useCase
      });

      response.status(201).json({
        ok: true,
        id: record.id,
        message: 'Recibimos tu solicitud. Te respondemos en 1-2 días hábiles al correo que dejaste.'
      });
    })
  );

  return router;
}
