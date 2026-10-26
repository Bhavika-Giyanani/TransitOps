# TransitOps - Smart Transport Operations Platform

A modern fleet operations platform for transport operations: vehicles, drivers, trip dispatch, maintenance workflows, expense tracking, regulatory compliance (Indian formats), and financial reporting.

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts |
| **Backend & REST API** | Node.js, Express.js |
| **ORM & Database** | Prisma ORM with SQLite (`prisma/dev.db`), easily migratable to Supabase (PostgreSQL) |
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
npx prisma db push
```

### 2. Start Application
```bash
npm run dev
```

- Application: [http://localhost:3000](http://localhost:3000)
- Interactive Swagger Documentation: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- Raw OpenAPI JSON: [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json)

---

## Demo Accounts

Pre-seeded accounts with password `TransitOps@2026`:
- **Fleet Manager:** `manager@transitops.com`
- **Driver:** `driver@transitops.com`
- **Safety Officer:** `safety@transitops.com`
- **Financial Analyst:** `analyst@transitops.com`
- **Organization Admin:** `admin@transitops.com`

---

## Migrating to Supabase (PostgreSQL)

See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) for full instructions:
1. In `prisma/schema.prisma`, update the datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set your Supabase connection string in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   ```
3. Run `npx prisma db push`.
