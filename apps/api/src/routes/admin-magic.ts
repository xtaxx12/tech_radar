// Endpoints para los magic links del flujo admin de Discord. Un click
// aprueba o rechaza una solicitud pendiente. El token va en el query string
// y contiene { requestId, action } firmados con TTL de 72h.
import express, { Router, type Request, type RequestHandler, type Response, type NextFunction } from 'express';
import { verifyAdminToken } from '../lib/admin-tokens.js';
import { approvalEmail, rejectionEmail, sendEmail } from '../lib/email.js';
import { apiKeyRequestRepository } from '../repositories/api-key-request.repository.js';
import { apiKeyRepository } from '../repositories/api-key.repository.js';

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function renderPage(params: {
  title: string;
  heading: string;
  message: string;
  variant: 'success' | 'error' | 'info';
  detail?: string;
}): string {
  const tone =
    params.variant === 'success'
      ? { ring: '#7de3c6', glow: 'rgba(125, 227, 198, 0.15)' }
      : params.variant === 'error'
      ? { ring: '#ff6363', glow: 'rgba(255, 99, 99, 0.15)' }
      : { ring: '#a4b8ff', glow: 'rgba(164, 184, 255, 0.15)' };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title} · Tech Radar LATAM</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      background: radial-gradient(ellipse at top, rgba(124, 156, 255, 0.12), transparent 60%), #0b1020;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      padding: 36px 32px;
      background: #121a33;
      border: 1px solid #253265;
      border-radius: 22px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 3px ${tone.glow};
      text-align: center;
    }
    .ring {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 999px;
      border: 3px solid ${tone.ring};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 12px;
      color: #b7c1e3;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .detail {
      margin-top: 20px;
      padding: 14px 16px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 10px;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
      font-size: 0.8rem;
      color: #e4eaff;
      word-break: break-word;
    }
    a {
      color: #7c9cff;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    form {
      margin-top: 20px;
      text-align: left;
    }
    label {
      display: block;
      color: #b7c1e3;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 6px;
    }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px;
      background: #1a2547;
      color: #ffffff;
      border: 1px solid #253265;
      border-radius: 10px;
      font: inherit;
      font-size: 0.92rem;
      box-sizing: border-box;
      resize: vertical;
    }
    textarea:focus {
      outline: none;
      border-color: #7c9cff;
      box-shadow: 0 0 0 3px rgba(124, 156, 255, 0.18);
    }
    button {
      margin-top: 14px;
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, ${tone.ring} 0%, #a8f5c8 100%);
      color: #06090f;
      border: none;
      border-radius: 12px;
      font: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
    }
    .footer {
      margin-top: 22px;
      font-size: 0.78rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="ring">${
      params.variant === 'success' ? '✅' : params.variant === 'error' ? '⚠️' : 'ℹ️'
    }</div>
    <h1>${params.heading}</h1>
    <p>${params.message}</p>
    ${params.detail ? `<div class="detail">${params.detail}</div>` : ''}
    <div class="footer">Tech Radar LATAM · admin</div>
  </div>
</body>
</html>`;
}

function renderRejectForm(token: string, owner: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rechazar solicitud · Tech Radar LATAM</title>
  <style>
    body { margin: 0; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background: radial-gradient(ellipse at top, rgba(255, 99, 99, 0.1), transparent 60%), #0b1020; color: #fff; display: flex; align-items: center; justify-content: center; padding: 32px 20px; }
    .card { max-width: 520px; width: 100%; padding: 32px; background: #121a33; border: 1px solid #253265; border-radius: 22px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
    h1 { margin: 0 0 8px; font-size: 1.3rem; font-weight: 700; }
    p { color: #b7c1e3; line-height: 1.5; margin: 0 0 16px; }
    strong { color: #fff; }
    label { display: block; color: #b7c1e3; font-size: 0.85rem; font-weight: 600; margin: 14px 0 6px; }
    textarea { width: 100%; min-height: 100px; padding: 12px; background: #1a2547; color: #fff; border: 1px solid #253265; border-radius: 10px; font: inherit; font-size: 0.92rem; box-sizing: border-box; resize: vertical; }
    textarea:focus { outline: none; border-color: #ff6363; box-shadow: 0 0 0 3px rgba(255,99,99,0.18); }
    button { margin-top: 14px; width: 100%; padding: 14px; background: #ff6363; color: #0b1020; border: none; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer; }
    button:hover { background: #ff8080; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Rechazar solicitud</h1>
    <p>Vas a rechazar la solicitud de <strong>${owner}</strong>. Se le enviará un email con el motivo.</p>
    <form method="POST" action="/admin/reject">
      <input type="hidden" name="token" value="${token}" />
      <label for="reason">Motivo (opcional, pero recomendado)</label>
      <textarea id="reason" name="reason" placeholder="Ej: tu caso de uso no encaja con el scope del producto, etc."></textarea>
      <button type="submit">Confirmar rechazo</button>
    </form>
  </div>
</body>
</html>`;
}

export function buildAdminMagicRouter(): Router {
  const router = Router();

  // Soportar POST de form urlencoded en /reject
  router.use(express.urlencoded({ extended: false }));

  // APROBAR --------------------------------------------------------------
  router.get(
    '/approve',
    asyncHandler(async (request, response) => {
      const token = typeof request.query.token === 'string' ? request.query.token : '';
      const payload = verifyAdminToken(token);

      if (!payload || payload.action !== 'approve') {
        response
          .status(401)
          .type('html')
          .send(
            renderPage({
              title: 'Link inválido',
              heading: 'Link inválido o expirado',
              message:
                'Este magic link no es válido. Puede haber expirado (72h) o el token fue manipulado.',
              variant: 'error'
            })
          );
        return;
      }

      const record = await apiKeyRequestRepository.getById(payload.requestId);
      if (!record) {
        response
          .status(404)
          .type('html')
          .send(
            renderPage({
              title: 'Solicitud no encontrada',
              heading: 'Solicitud no encontrada',
              message: 'No existe una solicitud con ese id.',
              variant: 'error'
            })
          );
        return;
      }

      if (record.status !== 'pending') {
        response
          .type('html')
          .send(
            renderPage({
              title: 'Ya procesada',
              heading: 'Esta solicitud ya fue procesada',
              message: `El estado actual es "${record.status}". No se realizó ningún cambio.`,
              variant: 'info'
            })
          );
        return;
      }

      const issued = await apiKeyRepository.issue({
        owner: record.owner,
        label: record.website ?? undefined
      });

      await apiKeyRequestRepository.markReviewed(record.id, {
        decision: 'approved',
        apiKeyId: issued.id
      });

      const docsUrl =
        process.env.PUBLIC_DOCS_URL?.trim() || 'https://tech-radar-api.onrender.com/public/docs';

      const emailResult = await sendEmail({
        to: record.email,
        subject: 'Tu API key de Tech Radar LATAM',
        html: approvalEmail({
          owner: record.owner,
          apiKey: issued.plaintext,
          rateLimitPerHour: issued.rateLimitPerHour,
          docsUrl
        })
      });

      const detailMessage = emailResult.sent
        ? `Email enviado a <strong>${record.email}</strong>. La key no se muestra aquí.`
        : `Email NO enviado (${emailResult.reason}). La key es:<br/><br/>${issued.plaintext}<br/><br/>Cópiala y envíala manualmente.`;

      response.type('html').send(
        renderPage({
          title: 'Aprobada',
          heading: `✅ Solicitud aprobada`,
          message: `<strong>${record.owner}</strong> ya tiene su API key.`,
          variant: 'success',
          detail: detailMessage
        })
      );
    })
  );

  // RECHAZAR (GET) ------------------------------------------------------
  // Si no viene reason, mostramos un form. Si viene, procesamos directo.
  router.get(
    '/reject',
    asyncHandler(async (request, response) => {
      const token = typeof request.query.token === 'string' ? request.query.token : '';
      const reasonQuery = typeof request.query.reason === 'string' ? request.query.reason.trim() : '';

      const payload = verifyAdminToken(token);
      if (!payload || payload.action !== 'reject') {
        response.status(401).type('html').send(
          renderPage({
            title: 'Link inválido',
            heading: 'Link inválido o expirado',
            message: 'Este magic link no es válido.',
            variant: 'error'
          })
        );
        return;
      }

      const record = await apiKeyRequestRepository.getById(payload.requestId);
      if (!record) {
        response.status(404).type('html').send(
          renderPage({
            title: 'No encontrada',
            heading: 'Solicitud no encontrada',
            message: 'No existe una solicitud con ese id.',
            variant: 'error'
          })
        );
        return;
      }

      if (record.status !== 'pending') {
        response.type('html').send(
          renderPage({
            title: 'Ya procesada',
            heading: 'Esta solicitud ya fue procesada',
            message: `El estado actual es "${record.status}".`,
            variant: 'info'
          })
        );
        return;
      }

      if (!reasonQuery) {
        // Mostrar form para capturar el motivo
        response.type('html').send(renderRejectForm(token, record.owner));
        return;
      }

      await processRejection(request, response, token, reasonQuery);
    })
  );

  // RECHAZAR (POST desde el form) ---------------------------------------
  router.post(
    '/reject',
    asyncHandler(async (request, response) => {
      const body = request.body ?? {};
      const token = typeof body.token === 'string' ? body.token : '';
      const reason = (typeof body.reason === 'string' ? body.reason : '').trim() || 'Sin motivo detallado.';
      await processRejection(request, response, token, reason);
    })
  );

  return router;
}

async function processRejection(
  _request: Request,
  response: Response,
  token: string,
  reason: string
): Promise<void> {
  const payload = verifyAdminToken(token);
  if (!payload || payload.action !== 'reject') {
    response.status(401).type('html').send(
      renderPage({
        title: 'Link inválido',
        heading: 'Link inválido o expirado',
        message: 'Este magic link no es válido.',
        variant: 'error'
      })
    );
    return;
  }

  const record = await apiKeyRequestRepository.getById(payload.requestId);
  if (!record || record.status !== 'pending') {
    response.status(record ? 200 : 404).type('html').send(
      renderPage({
        title: record ? 'Ya procesada' : 'No encontrada',
        heading: record ? 'Esta solicitud ya fue procesada' : 'Solicitud no encontrada',
        message: record ? `El estado actual es "${record.status}".` : 'No existe una solicitud con ese id.',
        variant: record ? 'info' : 'error'
      })
    );
    return;
  }

  await apiKeyRequestRepository.markReviewed(record.id, {
    decision: 'rejected',
    reviewNote: reason
  });

  const emailResult = await sendEmail({
    to: record.email,
    subject: 'Sobre tu solicitud de API key',
    html: rejectionEmail({ owner: record.owner, reason })
  });

  response.type('html').send(
    renderPage({
      title: 'Rechazada',
      heading: '❌ Solicitud rechazada',
      message: `Se le notificó a <strong>${record.owner}</strong> por email.`,
      variant: 'success',
      detail: emailResult.sent
        ? `Email enviado. Motivo: "${reason}"`
        : `Email NO enviado (${emailResult.reason}). Motivo: "${reason}"`
    })
  );
}
