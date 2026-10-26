# TransitOps - Smart Transport Operations Platform

A modern fleet operations platform for transport operations: vehicles, drivers, trip dispatch, maintenance workflows, expense tracking, regulatory compliance (Indian formats), and financial reporting.

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts |
| **Backend & REST API** | Node.js, Express.js |
| **ORM & Database** | Prisma ORM with PostgreSQL |
| **Authentication** | JWT (`jsonwebtoken`) & bcryptjs with secure cookie/bearer token support |
| **Real-time** | Socket.io (`/socket.io/`) bidirectional WebSocket stream |
| **API Documentation** | Swagger UI (`/swagger` and `/api-docs`) with OpenAPI 3.0 specification |
| **Email / SMTP** | Nodemailer with automated licence renewal reminders and OTP codes |
| **PDF Generation** | PDFKit (Financial Ledger, Fleet ROI, Trip Dispatch Receipts) |
| **CSV Generation** | csv-stringify (Financial Ledgers and Fleet Asset ROI) |
| **Payment Gateway** | Razorpay Node.js Signature Verification |

---

## Quick Start

### 1. Install & Setup Database
```bash
npm install
```

Before starting the application, copy `.env.example` to `.env` and configure PostgreSQL, a random
`JWT_SECRET` (at least 32 characters), `DEMO_ACCOUNT_PASSWORD`, SMTP credentials, and payment
credentials as required. Demo accounts share the `demo_tenant`; the demo organization admin can
manage the other demo roles. Demo sign-in accepts only `DEMO_ACCOUNT_PASSWORD`. Set `APP_BASE_URL`
to the deployed origin so subscription emails contain the correct password-setup link.

Then generate Prisma Client and apply the schema to the configured database:
```bash
npm run db:generate
npm run db:push
```

### 2. Start Application
```bash
npm run dev
```

- Application: [http://localhost:3000](http://localhost:3000)
- Interactive Swagger Documentation: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- Raw OpenAPI JSON: [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json)

## Repository structure

```text
frontend/
  src/                 React views, components, context, API client, and shared UI types
  public/              Static frontend assets
  index.html
  vite.config.ts
backend/
  server.ts            Express entry point; serves the SPA and mounts API modules
  src/
    modules/           Feature routes and request handlers (admin, auth, vehicles, trips, ...)
    middleware/        Authentication and authorization
    services/           Shared email, PDF, KPI, and scoring services
    db.ts               Prisma client and seed routines
  prisma/               PostgreSQL schema and Prisma CLI configuration
```

The npm manifest stays at the repository root so the frontend and backend deploy as one Render
web service. The Express server serves the production frontend bundle from `dist/`.

## Deploy to Render

This repository includes a Render Blueprint in `render.yaml`. Create a Blueprint from the repository
and configure the prompted environment variables (`DATABASE_URL`, `JWT_SECRET`,
`DEMO_ACCOUNT_PASSWORD`, `APP_BASE_URL`, SMTP, and Razorpay values). The build generates Prisma
Client and builds the frontend; the Node service serves both the API and SPA at the Render URL.
The `/api/health` endpoint checks database connectivity. For a database schema update, run
`npm run db:push` against the intended database before deploying the application version.

---

## Demo Accounts

Pre-seeded demo account emails (all use the password configured as `DEMO_ACCOUNT_PASSWORD` in `.env`):
- **Fleet Manager:** `manager@transitops.com`
- **Driver:** `driver@transitops.com`
- **Safety Officer:** `safety@transitops.com`
- **Financial Analyst:** `analyst@transitops.com`
- **Organization Admin:** `admin@transitops.com`

---

## PostgreSQL configuration

The Prisma schema already targets PostgreSQL. Configure your runtime URL in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   ```
Optionally set `DIRECT_URL` to a direct/session connection for Prisma schema commands, then run
`npm run db:validate`, `npm run db:generate`, and `npm run db:push`.

See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for Supabase pooler and deployment details.
