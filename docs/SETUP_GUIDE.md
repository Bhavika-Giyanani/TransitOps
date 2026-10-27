# TransitOps Node.js & Prisma Setup Guide

This guide details the Node.js + Express + Prisma ORM architecture, how to connect with
**PostgreSQL/Supabase**, and how to handle Razorpay URLs and webhooks for local and deployed use.

The application is organized as a single-service monorepo: the React frontend is in `frontend/`,
the Express API and feature modules are in `backend/`, and npm scripts are run from the repository
root. Render deployment is defined in `render.yaml`; set the environment variables listed in
`.env.example` in the Render dashboard.

---

## 1. Razorpay Integration: URLs, Local Testing & Deployment

### Where Razorpay asks for a Project URL:
Razorpay requires URLs in two distinct places:

1. **Website / App URL (Under Account Settings -> Business Website):**
   - **In Test Mode:** You can enter `http://localhost:3000` or your temporary dev URL (e.g., `https://ais-dev-5ilsv7vptyh373nymyvf65-81342711457.asia-southeast1.run.app`). Razorpay accepts any domain in Test Mode.
   - **In Live Mode:** You must provide your deployed production domain (e.g. `https://transitops.yourcompany.com`).

2. **Webhook URL (Under Settings -> Webhooks):**
   - Webhooks are server-to-server notifications sent by Razorpay (e.g., `payment.captured`, `order.paid`).
   - Because Razorpay's servers cannot reach `http://localhost:3000` directly, use the strategy below depending on your stage:

### Should you deploy or use ngrok?

| Scenario | Recommended Approach | URL to Provide to Razorpay |
|---|---|---|
| **Testing Standard Modal Checkout** | **No ngrok or deployment needed!** Test locally on `http://localhost:3000`. Razorpay's frontend checkout modal communicates via the browser, which talks directly to your local backend at `/api/onboarding/verify-payment`. | `http://localhost:3000` (or leave as test URL) |
| **Testing Server-Side Webhooks locally** | **Use ngrok (or cloudflared / Localtunnel)**. Run `ngrok http 3000` to create a secure HTTPS tunnel to your machine. | `https://<your-subdomain>.ngrok-free.app/api/onboarding/webhook/razorpay` |
| **Production / Client Demo** | **Deploy to cloud** (Render, Cloud Run, Railway, or VPS). | `https://your-production-app.com/api/onboarding/webhook/razorpay` |

#### How to test with ngrok:
1. Start TransitOps: `npm run dev` (running on port 3000).
2. Start ngrok in a separate terminal:
   ```bash
   ngrok http 3000
   ```
3. Copy the Forwarding URL (e.g., `https://a1b2-c3d4.ngrok-free.app`).
4. In your [Razorpay Dashboard](https://dashboard.razorpay.com/) (Test Mode) -> **Settings** -> **Webhooks** -> **Add New Webhook**:
   - **Webhook URL:** `https://a1b2-c3d4.ngrok-free.app/api/onboarding/webhook/razorpay`
   - **Secret:** Generate a unique secret and set the same value as `RAZORPAY_WEBHOOK_SECRET` in `.env`.
   - **Alert Email:** Your email.
   - **Active Events:** Select `payment.captured`, `order.paid`.

---

## 2. Supabase Database URL: Direct Connection vs. Connection Pooler

In Supabase (**Project Settings -> Database**), you are provided with two connection URLs:
1. **Connection Pooling URL (Port 6543, Supavisor / PgBouncer)**
2. **Direct Connection URL (Port 5432, Direct Postgres)**

### Which one should you provide?

> **Rule of Thumb for Prisma + Supabase:**
> Use the Supabase **session pooler** URL for `DATABASE_URL` during runtime and schema pushes.
> Direct database URLs may resolve only to IPv6 and be unreachable from IPv4-only networks.
> Prisma rewrites a transaction-pooler `:6543` URL to session mode `:5432` for schema commands.

### Step-by-Step Supabase Configuration:

#### Step 1: Copy Credentials from Supabase
In Supabase dashboard: **Project Settings** -> **Database**:
- Under **Connection string**, select **URI**.
- Copy the **Session / Transaction Pooler** string (port `6543`).
- Copy the **Direct Connection** string (port `5432`).

#### Step 2: Configure `backend/prisma/schema.prisma` and `backend/prisma.config.ts`
In newer versions of Prisma, connection parameters have moved out of the schema file to prevent lint warnings:

**In `backend/prisma/schema.prisma`:**
```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}
```

**In `backend/prisma.config.ts`:**
```typescript
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || process.env.DIRECT_URL,
  },
});
```

The project's config prefers `DATABASE_URL`, the same connection used by the running API. It only
falls back to `DIRECT_URL` when `DATABASE_URL` is unset. A Supabase direct hostname may resolve
only to IPv6; a machine or network without IPv6 connectivity will time out even while the project
and its session pooler are available.

**In `backend/src/db.ts` (Runtime Connection):**
Prisma 7+ uses database adapters passed to `PrismaClient`:
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

#### Step 3: Configure `.env`
Set your PostgreSQL variables in `.env` (or in Render's environment settings):

```env
# Runtime connection (use the Supabase session pooler; port 5432)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Optional direct database connection, used only if DATABASE_URL is unset
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

*Note: If your database password contains special characters (like `@`, `#`, `!`, `/`), make sure to URL-encode them (e.g., replace `@` with `%40`).*

#### Step 4: Run Migrations
Push your schema to Supabase:
```bash
npm run db:validate
npm run db:push
```

Prisma CLI uses `backend/prisma.config.ts` and `backend/prisma/schema.prisma`; `PrismaClient`
executes runtime queries through the PostgreSQL connection pool.

---

## 3. Quick Local Start (Current Setup)

Configure `.env` with a unique `JWT_SECRET` (at least 32 characters), `DEMO_ACCOUNT_PASSWORD`,
mail-service credentials, and the database connection before starting the application. Demo
accounts are seeded only when `DEMO_ACCOUNT_PASSWORD` is present and accept only that configured
password; no default demo password is accepted. Set `DATABASE_URL` to a PostgreSQL connection.

For the current local setup:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client and update the database schema:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

3. **Start Application:**
   ```bash
   npm run dev
   ```

- Web App: [http://localhost:3000](http://localhost:3000)
- Interactive Swagger UI: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- Raw OpenAPI JSON: [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json)

`npm run dev` starts Express and Vite together on port 3000; API calls are served by that same
process. Do not start a second Vite server against the same port. If you intentionally run Vite
separately on port 5173, its `/api` proxy targets `http://127.0.0.1:3000` by default; set
`VITE_BACKEND_URL` only when your API listens on a different address.

## 4. SMTP mail delivery

Set the SMTP variables in the repository-root `.env` for local development and in Render's
Environment dashboard for deployment:

```env
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_USER=your-provider-username
SMTP_PASS=your-provider-password-or-app-password
SMTP_FROM="TransitOps <no-reply@your-verified-domain.example>"
```

Port `465` uses implicit TLS; ports such as `587` use STARTTLS. Use the exact host, port, account,
and sender-domain settings from your email provider. Verify the sender domain and check that the
provider/hosting plan permits outbound SMTP before production; credentials must not be committed
to source control. The local default `localhost:1025` is for a local mail catcher only.

The Indian phone, driving-licence, and vehicle-registration checks validate format and plausible
date/state codes only. They do not query or certify a licence/registration against Sarathi, VAHAN,
or an RTO; official verification requires an authorized government integration.

---

## 5. Pre-configured Demo Accounts

Demo accounts are seeded only when `DEMO_ACCOUNT_PASSWORD` is configured in `.env`. All demo
accounts use that exact password; there is no hard-coded fallback.

| Role | Email |
|---|---|
| **Fleet Manager** | `manager@transitops.com` |
| **Driver** | `driver@transitops.com` |
| **Safety Officer** | `safety@transitops.com` |
| **Financial Analyst** | `analyst@transitops.com` |
| **Organization Admin** | `admin@transitops.com` |

---

## 6. Environment Variables Reference

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Web & API port | `3000` |
| `JWT_SECRET` | Random secret of at least 32 characters for JWT signing | `replace-with-a-random-secret` |
| `DEMO_ACCOUNT_PASSWORD` | Sole password accepted by pre-seeded demo accounts | `replace-with-a-strong-password` |
| `APP_BASE_URL` | Public base URL used in organization setup emails | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL URL used by the running API | `postgresql://...:6543/postgres` |
| `DIRECT_URL` | Optional direct PostgreSQL URL for Prisma schema commands | `postgresql://...:5432/postgres` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_transitops_demo` |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret for HMAC verification | `secret_test_transitops_key` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured in Razorpay Webhook settings | `set-a-unique-webhook-secret` |
| `SMTP_HOST` | SMTP server host | `localhost` |
| `SMTP_PORT` | SMTP server port | `1025` |
| `SMTP_USER` | SMTP username | `""` |
| `SMTP_PASS` | SMTP password | `""` |
| `SMTP_FROM` | Sender address | `no-reply@transitops.com` |

---

## 7. Render deployment

Create a Render Blueprint using the repository's `render.yaml`. This deploys a single Node web
service; the build creates the frontend bundle and Prisma Client, and the Express backend serves
both the API and frontend. Configure the prompted environment variables in Render. Use a PostgreSQL
service for `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, production SMTP
credentials, and the correct Razorpay test/live key pair. Set `APP_BASE_URL` to the public HTTPS
Render URL.

The Render health check calls `/api/health`, which verifies database connectivity. Apply schema
changes deliberately with `npm run db:push` against the intended production database; the deploy
build itself does not mutate the database schema. Recent schema changes include the driver reminder
deduplication field, so push reviewed schema changes before deploying code that reads them.

In the Razorpay dashboard, configure the production webhook as
`https://<your-render-service>.onrender.com/api/onboarding/webhook/razorpay` and set its secret to
the Render `RAZORPAY_WEBHOOK_SECRET` value. Ngrok is only for local webhook testing; it is not
required after deployment and must not be used as the production webhook URL.
