// Notificaciones a Discord/Slack cuando entra una solicitud nueva.
// Si DISCORD_WEBHOOK_URL no está seteado, es no-op.

type NotifyParams = {
  owner: string;
  email: string;
  website: string | null;
  useCase: string;
  /** Si se pasan, el embed incluye links de aprobar/rechazar (magic link). */
  approveUrl?: string;
  rejectUrl?: string;
};

export async function notifyNewKeyRequest(params: NotifyParams): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) return;

  const useCase = params.useCase.length > 600
    ? params.useCase.slice(0, 600) + '…'
    : params.useCase;

  // Usamos embeds para poder incluir links clickeables en description
  // (Discord renderiza markdown [texto](url) dentro de embeds, no en content
  // plano). Color verde para que destaque entre otros mensajes del canal.
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: '👤 Owner', value: params.owner, inline: true },
    { name: '📧 Email', value: params.email, inline: true }
  ];

  if (params.website) {
    fields.push({ name: '🌐 Website', value: params.website, inline: false });
  }

  fields.push({ name: '💡 Caso de uso', value: useCase, inline: false });

  const actionLine = params.approveUrl && params.rejectUrl
    ? `**Acciones:** [✅ Aprobar](${params.approveUrl}) · [❌ Rechazar](${params.rejectUrl})`
    : '';

  const embed = {
    title: '🔑 Nueva solicitud de API key',
    description: actionLine,
    color: 0x7de3c6, // menta del accent del producto
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'Tech Radar LATAM · Admin magic link' }
  };

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`[notifications] discord ${response.status}: ${body.slice(0, 200)}`);
    }
  } catch (error) {
    console.warn('[notifications] webhook failed:', error instanceof Error ? error.message : error);
  }
}
