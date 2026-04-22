// Aprueba una solicitud pendiente: emite una API key y envía el email al
// solicitante. Si RESEND_API_KEY no está configurado, imprime la key para
// que la copies manualmente al responder.
import dotenv from 'dotenv';
import { apiKeyRequestRepository } from '../src/repositories/api-key-request.repository.js';
import { apiKeyRepository } from '../src/repositories/api-key.repository.js';
import { approvalEmail, sendEmail } from '../src/lib/email.js';
import { closeDb } from '../src/db/client.js';

dotenv.config();

const DOCS_URL = process.env.PUBLIC_DOCS_URL?.trim() || 'https://tech-radar-api.onrender.com/public/docs';

function parseArgs() {
  const args = process.argv.slice(2);
  let id: string | undefined;
  let rate: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) id = args[++i];
    else if (args[i] === '--rate' && args[i + 1]) rate = Number(args[++i]);
  }

  if (!id) {
    console.error('Uso: npm run keys:approve -- --id <uuid> [--rate 1000]');
    process.exit(2);
  }

  return { id, rate };
}

async function main() {
  const { id, rate } = parseArgs();

  const request = await apiKeyRequestRepository.getById(id);
  if (!request) {
    console.error(`Solicitud ${id} no existe.`);
    process.exit(1);
  }

  if (request.status !== 'pending') {
    console.error(`Solicitud ${id} está ${request.status}, no pendiente.`);
    process.exit(1);
  }

  const issued = await apiKeyRepository.issue({
    owner: request.owner,
    label: request.website ?? null ?? undefined,
    rateLimitPerHour: rate
  });

  const reviewed = await apiKeyRequestRepository.markReviewed(id, {
    decision: 'approved',
    apiKeyId: issued.id
  });

  if (!reviewed) {
    console.error('No se pudo marcar la solicitud como aprobada (puede haber cambiado en paralelo).');
    process.exit(1);
  }

  console.log('');
  console.log('✅ Aprobada. API key emitida.');
  console.log('----------------------------------------');
  console.log(`  owner: ${request.owner}`);
  console.log(`  email: ${request.email}`);
  console.log(`  rate:  ${issued.rateLimitPerHour}/h`);
  console.log('');

  const result = await sendEmail({
    to: request.email,
    subject: `Tu API key de Tech Radar LATAM`,
    html: approvalEmail({
      owner: request.owner,
      apiKey: issued.plaintext,
      rateLimitPerHour: issued.rateLimitPerHour,
      docsUrl: DOCS_URL
    })
  });

  if (result.sent) {
    console.log(`📬 Email enviado (id: ${result.id})`);
    console.log('   La key no se imprime aquí; el usuario la recibió por email.');
  } else {
    console.log(`⚠️  Email NO enviado: ${result.reason}`);
    console.log('   Guarda esta clave y envíasela manualmente — no se volverá a mostrar:');
    console.log('');
    console.log(`   ${issued.plaintext}`);
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error('Fallo al aprobar:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closeDb());
