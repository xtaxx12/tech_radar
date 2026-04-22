import dotenv from 'dotenv';
import { apiKeyRepository } from '../src/repositories/api-key.repository.js';
import { closeDb } from '../src/db/client.js';

dotenv.config();

async function main() {
  const keys = await apiKeyRepository.list();
  if (keys.length === 0) {
    console.log('No hay API keys emitidas.');
    return;
  }

  console.log('');
  console.log('📋 API keys');
  console.log('-----------------------------------');
  for (const key of keys) {
    const state = key.revoked ? '❌ revocada' : '✅ activa';
    const lastUsed = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'nunca';
    console.log(`${state}  ${key.keyPrefix}…  ${key.owner}${key.label ? ` (${key.label})` : ''}`);
    console.log(`         id: ${key.id}`);
    console.log(`         límite: ${key.rateLimitPerHour}/h · último uso: ${lastUsed}`);
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error('Fallo al listar keys:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => closeDb());
