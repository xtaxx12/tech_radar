// Wrapper mínimo sobre Resend (https://resend.com). Si no hay RESEND_API_KEY,
// las funciones retornan { sent: false } y el caller hace fallback a
// mostrar la info por consola para email manual.

const RESEND_URL = 'https://api.resend.com/emails';

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult = { sent: true; id: string } | { sent: false; reason: string };

export async function sendEmail({ to, subject, html }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'Tech Radar LATAM <onboarding@resend.dev>';

  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY no configurado' };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { sent: false, reason: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id ?? 'unknown' };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
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
