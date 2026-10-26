# TransitOps Node.js & Prisma Setup Guide

This guide details the Node.js + Express + Prisma ORM architecture, how to run with the SQLite database, and how to seamlessly transition to **Supabase (PostgreSQL)** when ready.

---

## 1. Architecture Overview

| Component | Technology | Purpose |
|---|---|---|
| **Runtime & Server** | Node.js (v20+ / v22), Express.js | Full-stack REST API and SSR/Vite dev hosting |
| **ORM & Database** | Prisma ORM with SQLite (`prisma/dev.db`) | Relational modeling with zero-config local persistence |
| **Future Database** | Supabase (PostgreSQL) | Fully compatible Prisma schema ready for PostgreSQL |
| **Realtime Engine** | Socket.io (`/socket.io/`) | Bidirectional WebSocket dispatch, status changes & alerts |
| **Authentication** | JWT (`jsonwebtoken`) & bcryptjs | Bearer token & HTTP cookie role-based auth |
| **API Documentation** | Swagger UI (`swagger-ui-express`) | Interactive OpenAPI 3.0 docs at `/swagger` & `/api-docs` |
| **Email / SMTP** | Nodemailer | Commercial licence renewal notices & onboarding codes |
| **PDF Generation** | PDFKit | Downloadable Financial Ledgers, Fleet ROI & Trip Receipts |
| **CSV Generation** | csv-stringify | Structured ledger and fleet export downloads |
| **Payment Gateway** | Razorpay Node.js Signature Verification | HMAC-SHA256 verification for SaaS onboarding checkouts |

---

## 2. Quick Local Start (SQLite)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client and Push Schema:**
   ```bash
   npx prisma db push
   ```
   *Note: On initial startup, TransitOps automatically checks and seeds the database with demo accounts, the 12-vehicle fleet, drivers, trips, maintenance orders, expenses, and plans.*

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   - Application UI: [http://localhost:3000](http://localhost:3000)
   - Interactive Swagger Docs: [http://localhost:3000/swagger](http://localhost:3000/swagger)
   - Raw OpenAPI JSON: [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json)

---

## 3. Pre-configured Demo Accounts

All demo accounts are pre-seeded in the database:

| Role | Email | Password |
|---|---|---|
| **Fleet Manager** | `manager@transitops.com` | `TransitOps@2026` |
| **Driver** | `driver@transitops.com` | `TransitOps@2026` |
| **Safety Officer** | `safety@transitops.com` | `TransitOps@2026` |
| **Financial Analyst** | `analyst@transitops.com` | `TransitOps@2026` |
| **Organization Admin** | `admin@transitops.com` | `TransitOps@2026` |

---

## 4. How to Migrate to Supabase (PostgreSQL)

When you are ready to switch from local SQLite to Supabase:

### Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings -> Database**, copy the **URI Connection String** (Transaction pooler or direct connection, e.g., `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`).

### Step 2: Update `prisma/schema.prisma`
Change the `datasource db` block:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 3: Configure `.env`
Add your Supabase connection string to `.env`:
```env
DATABASE_URL="postgresql://postgres.yourprojectref:yourpassword@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.yourprojectref:yourpassword@aws-0-region.pooler.supabase.com:5432/postgres"
```

### Step 4: Run Migrations
Push the Prisma models to your Supabase PostgreSQL instance:
```bash
npx prisma db push
```
Or create migration files:
```bash
npx prisma migrate dev --name init_supabase
```

The database models, relations, and types remain 100% identical.

---

## 5. Environment Variables Reference

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port for the Express server and Vite frontend |
| `JWT_SECRET` | `transitops-jwt-secure-secret-key-2026` | Secret key used to sign and verify JWT authentication tokens |
| `DATABASE_URL` | `file:./dev.db` | Database connection string (SQLite file or PostgreSQL URL) |
| `SMTP_HOST` | `localhost` | SMTP host for email notifications |
| `SMTP_PORT` | `1025` | SMTP port |
| `SMTP_USER` | `""` | SMTP username |
| `SMTP_PASS` | `""` | SMTP password |
| `SMTP_FROM` | `no-reply@transitops.com` | Default sender email |
| `RAZORPAY_KEY_ID` | `rzp_test_transitops_demo` | Razorpay Key ID for payments |
| `RAZORPAY_KEY_SECRET` | `secret_test_transitops_key` | Razorpay Key Secret for HMAC verification |

---

## 6. Realtime Events with Socket.io

The backend streams events on the root Socket.io namespace (`/socket.io/`):
- `trip_dispatched`: Dispatched trip payload
- `trip_completed`: Completed trip payload with final odometer
- `vehicle_status`: `{ vehicleId, status, tenantId }`
- `driver_status`: `{ driverId, status, tenantId }`
- `maintenance_updated`: Maintenance work order updates
- `expense_updated`: Fuel or operational expense logged
- `notification`: In-app compliance & alert toasts
