import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL no está definido. Configura apps/api/.env antes de ejecutar drizzle-kit.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});
