// Webhook opcional a Discord/Slack para enterarte al momento de requests nuevos.
// Si DISCORD_WEBHOOK_URL no está seteado, es no-op.

export async function notifyNewKeyRequest(params: {
  owner: string;
  email: string;
  website: string | null;
  useCase: string;
  adminUrl?: string;
}): Promise<void> {
  const webhook = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) return;

  const content = [
    '🔑 **Nueva solicitud de API key**',
    `**Owner:** ${params.owner}`,
    `**Email:** ${params.email}`,
    params.website ? `**Website:** ${params.website}` : null,
    `**Caso de uso:** ${params.useCase.slice(0, 500)}`,
    params.adminUrl ? `Aprobar: ${params.adminUrl}` : null
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (error) {
    console.warn('[notifications] webhook failed:', error instanceof Error ? error.message : error);
  }
}
