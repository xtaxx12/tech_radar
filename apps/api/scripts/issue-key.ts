// Emite una nueva API key pública.
// Uso: npm -w apps/api run keys:issue -- --owner "Flutter Ecuador" --label "widget"
// La clave se imprime UNA SOLA VEZ; guárdala en un gestor de secretos.
import dotenv from 'dotenv';
import { apiKeyRepository } from '../src/repositories/api-key.repository.js';
import { closeDb } from '../src/db/client.js';

dotenv.config();

function parseArgs(): { owner: string; label?: string; rateLimitPerHour?: number } {
  const args = process.argv.slice(2);
  let owner: string | undefined;
  let label: string | undefined;
  let rateLimitPerHour: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--owner' && args[i + 1]) {
      owner = args[++i];
    } else if (arg === '--label' && args[i + 1]) {
      label = args[++i];
    } else if (arg === '--rate' && args[i + 1]) {
      rateLimitPerHour = Number(args[++i]);
    }
  }

  if (!owner) {
    console.error('Uso: npm run keys:issue -- --owner "<Community Name>" [--label "<label>"] [--rate 1000]');
    process.exit(2);
  }

  return { owner, label, rateLimitPerHour };
}

async function main() {
  const options = parseArgs();
  const key = await apiKeyRepository.issue(options);

  console.log('');
  console.log('✅ API key emitida');
  console.log('-----------------------------------');
  console.log('  owner:      ', key.owner);
  console.log('  label:      ', key.label ?? '(ninguno)');
  console.log('  rate limit: ', `${key.rateLimitPerHour} req/hora`);
  console.log('  id:         ', key.id);
  console.log('');
  console.log('🔑 Clave (mostrada solo ahora, guárdala en un lugar seguro):');
  console.log('');
  console.log('   ' + key.plaintext);
  console.log('');
  console.log('Prueba rápida:');
  console.log(
    `   curl -H "Authorization: Bearer ${key.plaintext}" http://localhost:4000/public/v1/events?limit=3`
  );
  console.log('');
}

main()
  .catch((error) => {
    console.error('Fallo al emitir key:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
