// Envío de emails con estrategia de fallback:
//   1. Resend si RESEND_API_KEY está configurada (mejor deliverability,
//      dashboard, logs — recomendado para producción con dominio verificado).
//   2. Gmail SMTP vía nodemailer si GMAIL_USER + GMAIL_APP_PASSWORD están
//      configurados (no requiere verificar dominio, pero tiene límite de
//      ~500 emails/día y deliverability más pobre).
//   3. Si ninguno está disponible, retornamos { sent: false } y el caller
//      (CLI de admin) imprime la key por consola para envío manual.
//
// Resend está en "testing mode" sin dominio verificado — solo deja enviar
// al email con el que te registraste. Por eso el fallback a Gmail es útil
// durante desarrollo: seguir emitiendo keys sin bloquear el flujo.

import nodemailer, { type Transporter } from 'nodemailer';

const RESEND_URL = 'https://api.resend.com/emails';

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult = { sent: true; id: string; provider: 'resend' | 'gmail' } | { sent: false; reason: string };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.trim();

  // 1. Intentamos Resend si está configurado.
  if (resendKey) {
    const result = await sendViaResend(args, resendKey);
    if (result.sent) return result;
    console.warn('[email] Resend falló, intentando fallback:', result.reason);
    // Si no hay Gmail configurado, devolvemos el error de Resend tal cual
    // para que el caller lo muestre.
    if (!gmailUser || !gmailPassword) return result;
  }

  // 2. Fallback a Gmail SMTP.
  if (gmailUser && gmailPassword) {
    return sendViaGmail(args, gmailUser, gmailPassword);
  }

  return { sent: false, reason: 'Ningún provider de email configurado (RESEND_API_KEY o GMAIL_USER + GMAIL_APP_PASSWORD).' };
}

async function sendViaResend(args: SendArgs, apiKey: string): Promise<SendResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Tech Radar LATAM <onboarding@resend.dev>';

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: args.to, subject: args.subject, html: args.html })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { sent: false, reason: `Resend ${response.status}: ${body.slice(0, 400)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id ?? 'unknown', provider: 'resend' };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

// Transporter lazy-cached por proceso. Gmail usa STARTTLS en el 587,
// lo que es más universal que smtps en 465 y no pelea con firewalls.
let gmailTransporter: Transporter | null = null;
let gmailTransporterKey: string | null = null;

function getGmailTransporter(user: string, pass: string): Transporter {
  const key = `${user}|${pass.slice(0, 4)}`;
  if (gmailTransporter && gmailTransporterKey === key) return gmailTransporter;

  gmailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS al cambiar el handshake
    auth: { user, pass },
    // Timeouts conservadores: Render tiene redes raras, no queremos que
    // una request admin se cuelgue 2 min esperando SMTP.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
  gmailTransporterKey = key;
  return gmailTransporter;
}

async function sendViaGmail(args: SendArgs, user: string, password: string): Promise<SendResult> {
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || 'Tech Radar LATAM';
  const from = `${fromName} <${user}>`;

  try {
    const transporter = getGmailTransporter(user, password);
    const info = await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html
    });

    return { sent: true, id: info.messageId, provider: 'gmail' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sent: false, reason: `Gmail SMTP: ${message}` };
  }
}

export function approvalEmail(params: {
  owner: string;
  apiKey: string;
  rateLimitPerHour: number;
  docsUrl: string;
}): string {
  const { owner, apiKey, rateLimitPerHour, docsUrl } = params;
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0b1020;background:#f7f8fb;">
<h1 style="font-size:22px;margin-bottom:8px;">¡Tu API key de Tech Radar LATAM está lista!</h1>
<p>Hola <strong>${escapeHtml(owner)}</strong>,</p>
<p>Aprobamos tu solicitud de acceso a la API pública. Esta es tu clave (guárdala ahora, no te la volvemos a enviar):</p>
<pre style="background:#0b1020;color:#fff;padding:16px;border-radius:8px;font-size:13px;overflow-x:auto;user-select:all;">${escapeHtml(apiKey)}</pre>
<p><strong>Límite:</strong> ${rateLimitPerHour} requests/hora.</p>
<h2 style="font-size:16px;margin-top:24px;">Cómo usarla</h2>
<pre style="background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto;">
curl -H "Authorization: Bearer ${escapeHtml(apiKey)}" \\
  "https://tech-radar-api.onrender.com/public/v1/events?country=Ecuador&upcoming=true&limit=5"
</pre>
<p>Documentación interactiva con todos los filtros: <a href="${escapeAttr(docsUrl)}" style="color:#7c9cff;">${escapeHtml(docsUrl)}</a></p>
<p>Si tu caso de uso es un widget embebible en tu sitio, usa directamente <a href="https://tech-radar-latam.vercel.app/widget.js">widget.js</a> — te evitamos todo el código de render.</p>
<p style="margin-top:24px;font-size:12px;color:#6b7280;">Si no fuiste tú quien solicitó esta clave, responde a este correo y la revocamos. Si la clave se compromete, avísanos para emitir una nueva.</p>
<p style="font-size:12px;color:#6b7280;">— Equipo Tech Radar LATAM</p>
</body></html>`;
}

export function rejectionEmail(params: { owner: string; reason: string }): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0b1020;">
<h1 style="font-size:22px;">Sobre tu solicitud de API key</h1>
<p>Hola <strong>${escapeHtml(params.owner)}</strong>,</p>
<p>Por el momento no vamos a poder emitir una API key para tu comunidad.</p>
<p><strong>Motivo:</strong> ${escapeHtml(params.reason)}</p>
<p>Si crees que es un malentendido, respóndenos este correo y conversamos.</p>
<p style="font-size:12px;color:#6b7280;margin-top:24px;">— Equipo Tech Radar LATAM</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
