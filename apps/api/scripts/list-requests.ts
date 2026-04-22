import dotenv from 'dotenv';
import { apiKeyRequestRepository } from '../src/repositories/api-key-request.repository.js';
import { closeDb } from '../src/db/client.js';

dotenv.config();

async function main() {
  const all = process.argv.includes('--all');
  const rows = all ? await apiKeyRequestRepository.list() : await apiKeyRequestRepository.listPending();

  if (rows.length === 0) {
    console.log(all ? 'No hay solicitudes.' : 'No hay solicitudes pendientes.');
    return;
  }

  console.log('');
  console.log(all ? '📋 Todas las solicitudes' : '⏳ Solicitudes pendientes');
  console.log('----------------------------------------');

  for (const row of rows) {
    const icon = row.status === 'pending' ? '⏳' : row.status === 'approved' ? '✅' : '❌';
    const date = new Date(row.createdAt).toLocaleString();
    console.log(`${icon}  ${row.owner}`);
    console.log(`    id:        ${row.id}`);
    console.log(`    email:     ${row.email}`);
    if (row.website) console.log(`    website:   ${row.website}`);
    console.log(`    estado:    ${row.status}`);
    console.log(`    recibido:  ${date}`);
    console.log(`    use case:`);
    for (const line of row.useCase.split('\n')) {
      console.log(`      ${line}`);
    }
    if (row.reviewNote) console.log(`    nota:      ${row.reviewNote}`);
    console.log('');
  }

  console.log('Para aprobar:  npm -w apps/api run keys:approve -- --id <id> [--rate 1000]');
  console.log('Para rechazar: npm -w apps/api run keys:reject -- --id <id> --reason "..."');
  console.log('');
}

main()
  .catch((error) => {
    console.error('Fallo al listar:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closeDb());
