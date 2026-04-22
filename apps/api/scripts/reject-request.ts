// Rechaza una solicitud pendiente y envía un email explicando el motivo.
import dotenv from 'dotenv';
import { apiKeyRequestRepository } from '../src/repositories/api-key-request.repository.js';
import { rejectionEmail, sendEmail } from '../src/lib/email.js';
import { closeDb } from '../src/db/client.js';

dotenv.config();

function parseArgs() {
  const args = process.argv.slice(2);
  let id: string | undefined;
  let reason: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) id = args[++i];
    else if (args[i] === '--reason' && args[i + 1]) reason = args[++i];
  }

  if (!id || !reason) {
    console.error('Uso: npm run keys:reject -- --id <uuid> --reason "<motivo>"');
    process.exit(2);
  }

  return { id, reason };
}

async function main() {
  const { id, reason } = parseArgs();

  const request = await apiKeyRequestRepository.getById(id);
  if (!request || request.status !== 'pending') {
    console.error('Solicitud no pendiente.');
    process.exit(1);
  }

  await apiKeyRequestRepository.markReviewed(id, { decision: 'rejected', reviewNote: reason });

  const result = await sendEmail({
    to: request.email,
    subject: 'Sobre tu solicitud de API key',
    html: rejectionEmail({ owner: request.owner, reason })
  });

  console.log(`❌ Rechazada: ${request.owner} (${request.email})`);
  console.log(
    result.sent
      ? `📬 Email enviado vía ${result.provider} (id: ${result.id})`
      : `⚠️  Email NO enviado: ${result.reason}`
  );
}

main()
  .catch((error) => {
    console.error('Fallo al rechazar:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closeDb());
