// Magic links firmados para aprobar/rechazar solicitudes de API key desde
// un click (típicamente desde el embed de Discord).
//
// Seguridad:
//  - JWT firmado (HS256) con TTL de 72h → un link viejo ya no sirve.
//  - Issuer y audience explícitos para que tokens de auth de usuarios no
//    se confundan con tokens de admin magic-link.
//  - Acción está embebida en el token, así el mismo magic-link no puede
//    usarse para aprobar si fue emitido como rechazo.
//  - "One-use" efectivo: aprobar/rechazar transiciona el status; si alguien
//    vuelve a hacer click, el handler ve el nuevo status y responde con
//    un mensaje tipo "ya procesado".
import jwt, { type JwtPayload } from 'jsonwebtoken';

const TTL_SECONDS = 72 * 60 * 60; // 72 horas
const ISSUER = 'tech-radar-latam';
const AUDIENCE = 'admin-magic-link';

export type AdminAction = 'approve' | 'reject';

export type AdminTokenPayload = {
  requestId: string;
  action: AdminAction;
};

function getSecret(): string | null {
  // Permitimos un secret dedicado pero caemos a AUTH_SESSION_SECRET para no
  // forzar otra env var. Si ninguno está seteado, el feature queda apagado.
  return (
    process.env.ADMIN_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim() ||
    null
  );
}

export function adminTokensEnabled(): boolean {
  return getSecret() !== null;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  const secret = getSecret();
  if (!secret) throw new Error('Faltan ADMIN_TOKEN_SECRET / AUTH_SESSION_SECRET.');
  return jwt.sign(payload, secret, {
    expiresIn: TTL_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE
    }) as JwtPayload & Partial<AdminTokenPayload>;
    if (typeof decoded.requestId !== 'string') return null;
    if (decoded.action !== 'approve' && decoded.action !== 'reject') return null;
    return { requestId: decoded.requestId, action: decoded.action };
  } catch {
    return null;
  }
}

export function buildMagicLinks(apiBaseUrl: string, requestId: string): { approve: string; reject: string } {
  const base = apiBaseUrl.replace(/\/$/, '');
  const approve = signAdminToken({ requestId, action: 'approve' });
  const reject = signAdminToken({ requestId, action: 'reject' });
  return {
    approve: `${base}/admin/approve?token=${encodeURIComponent(approve)}`,
    reject: `${base}/admin/reject?token=${encodeURIComponent(reject)}`
  };
}
