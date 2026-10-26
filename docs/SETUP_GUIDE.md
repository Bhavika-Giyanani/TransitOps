# TransitOps Node.js & Prisma Setup Guide

This guide details the Node.js + Express + Prisma ORM architecture, how to run with SQLite, how to connect with **Supabase (PostgreSQL)**, and how to handle **Razorpay URLs & Webhooks** (ngrok vs deployment).

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
| **Testing Server-Side Webhooks locally** | **Use ngrok (or cloudflared / Localtunnel)**. Run `ngrok http 3000` to create a secure HTTPS tunnel to your machine. | `https://<your-subdomain>.ngrok-free.app/api/onboarding/webhook` |
| **Production / Client Demo** | **Deploy to cloud** (Render, Cloud Run, Railway, or VPS). | `https://your-production-app.com/api/onboarding/webhook` |

#### How to test with ngrok:
1. Start TransitOps: `npm run dev` (running on port 3000).
2. Start ngrok in a separate terminal:
   ```bash
   ngrok http 3000
   ```
3. Copy the Forwarding URL (e.g., `https://a1b2-c3d4.ngrok-free.app`).
4. In your [Razorpay Dashboard](https://dashboard.razorpay.com/) (Test Mode) -> **Settings** -> **Webhooks** -> **Add New Webhook**:
   - **Webhook URL:** `https://a1b2-c3d4.ngrok-free.app/api/onboarding/webhook`
   - **Secret:** Enter a secret (e.g. `transitops_webhook_secret_2026`) and add it to `.env` as `RAZORPAY_WEBHOOK_SECRET`.
   - **Alert Email:** Your email.
   - **Active Events:** Select `payment.captured`, `order.paid`.

---

## 2. Supabase Database URL: Direct Connection vs. Connection Pooler

In Supabase (**Project Settings -> Database**), you are provided with two connection URLs:
1. **Connection Pooling URL (Port 6543, Supavisor / PgBouncer)**
2. **Direct Connection URL (Port 5432, Direct Postgres)**

### Which one should you provide?

> **Rule of Thumb for Prisma + Supabase:**
> Provide **BOTH** using Prisma's `directUrl` feature!
> - Use the **Connection Pooling URL (port 6543)** for runtime queries (`DATABASE_URL`). This prevents connection exhaustion under multiple requests.
> - Use the **Direct Connection URL (port 5432)** for schema migrations (`DIRECT_URL`). Transaction poolers reject DDL statements and migration advisory locks.

### Step-by-Step Supabase Configuration:

#### Step 1: Copy Credentials from Supabase
In Supabase dashboard: **Project Settings** -> **Database**:
- Under **Connection string**, select **URI**.
- Copy the **Session / Transaction Pooler** string (port `6543`).
- Copy the **Direct Connection** string (port `5432`).

#### Step 2: Update `prisma/schema.prisma`
Add `directUrl` to the datasource block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

#### Step 3: Configure `.env`
Set both variables in `.env`:

```env
# 1. Connection Pooler (Transaction mode, port 6543 with pgbouncer parameter)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# 2. Direct Connection (Port 5432, without pooler)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

*Note: If your database password contains special characters (like `@`, `#`, `!`, `/`), make sure to URL-encode them (e.g., replace `@` with `%40`).*

#### Step 4: Run Migrations
Push your schema to Supabase:
```bash
npx prisma db push
```

Prisma will automatically use `DIRECT_URL` (port 5432) to create tables and types, and use `DATABASE_URL` (port 6543) for application queries!

---

## 3. Quick Local Start (Current SQLite Setup)

If running locally on SQLite before switching to Supabase:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Database:**
   ```bash
   npx prisma db push
   ```

3. **Start Application:**
   ```bash
   npm run dev
   ```

- Web App: [http://localhost:3000](http://localhost:3000)
- Interactive Swagger UI: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- Raw OpenAPI JSON: [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json)

---

## 4. Pre-configured Demo Accounts

All demo accounts are pre-seeded in the database:

| Role | Email | Password |
|---|---|---|
| **Fleet Manager** | `manager@transitops.com` | `TransitOps@2026` |
| **Driver** | `driver@transitops.com` | `TransitOps@2026` |
| **Safety Officer** | `safety@transitops.com` | `TransitOps@2026` |
| **Financial Analyst** | `analyst@transitops.com` | `TransitOps@2026` |
| **Organization Admin** | `admin@transitops.com` | `TransitOps@2026` |

---

## 5. Environment Variables Reference

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Web & API port | `3000` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `transitops-jwt-secure-secret-key-2026` |
| `DATABASE_URL` | App runtime DB URL (SQLite file or Supabase pooler `6543`) | `file:./dev.db` |
| `DIRECT_URL` | Direct DB URL for Prisma migrations (Supabase port `5432`) | `postgresql://...:5432/postgres` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_transitops_demo` |
| `RAZORPAY_KEY_SECRET` | Razorpay Secret for HMAC verification | `secret_test_transitops_key` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured in Razorpay Webhook settings | `transitops_webhook_secret_2026` |
| `SMTP_HOST` | SMTP server host | `localhost` |
| `SMTP_PORT` | SMTP server port | `1025` |
| `SMTP_USER` | SMTP username | `""` |
| `SMTP_PASS` | SMTP password | `""` |
| `SMTP_FROM` | Sender address | `no-reply@transitops.com` |
