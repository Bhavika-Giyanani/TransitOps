import dotenv from 'dotenv';
import { defineConfig } from '@prisma/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(repositoryRoot, '.env') });

// Prefer the configured runtime URL: Supabase's direct database endpoint may be IPv6-only,
// while the session pooler is reachable from IPv4-only networks and supports schema pushes.
let migrationUrl =
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL ||
  'postgresql://postgres:postgres@localhost:5432/postgres';

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  throw new Error(
    'Database connection is not configured. Set DATABASE_URL (and optionally DIRECT_URL) in the repository root .env file or environment.',
  );
}

if (migrationUrl.includes(':6543')) {
  migrationUrl = migrationUrl.replace(':6543', ':5432');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: migrationUrl,
  },
});
