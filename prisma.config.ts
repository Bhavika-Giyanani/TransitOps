import 'dotenv/config';
import { defineConfig } from '@prisma/config';

// Supabase Transaction Pooler (:6543) does not support session advisory locks and hangs on 'prisma db push'.
// For Prisma CLI schema migrations, port 5432 (Session Mode or Direct Connection) must be used.
let migrationUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/postgres';

if (migrationUrl.includes(':6543')) {
  migrationUrl = migrationUrl.replace(':6543', ':5432');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: migrationUrl,
    directUrl: migrationUrl,
  },
});
