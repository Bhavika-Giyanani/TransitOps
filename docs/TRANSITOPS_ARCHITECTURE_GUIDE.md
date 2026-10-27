# TransitOps Architecture Guide

TransitOps is a TypeScript full-stack application: React/Vite in `frontend/`, Node.js/Express in
`backend/`, Prisma/PostgreSQL for persistence, and `shared/` for reusable browser/server logic.

```text
Browser → React → Express middleware/router → feature handler → Prisma → PostgreSQL
                       ├─ Socket.IO realtime events
                       ├─ Nodemailer SMTP
                       ├─ PDFKit exports
                       └─ node-cron compliance job
```

The root `package.json` manages both frontend and backend. `npm run build` outputs the Vite bundle
into root `dist`; Express serves it alongside `/api/*` in production. In development, the server
integrates Vite middleware, and Vite's standalone server can proxy to the API.

## Backend feature modules

Each folder under `backend/src/modules/` owns its router and currently its request handlers:
`auth`, `admin`, `vehicles`, `drivers`, `trips`, `maintenance`, `expenses`, `kpi`, `reports`, and
`onboarding`. Cross-feature concerns live in `middleware/`, `services/`, `jobs/`, `utils/`, and
`realtime.ts`. This keeps changes grouped by product feature without creating unused architectural
layers.

Route files combine Express route declaration, request validation, and request handling. This is a
reasonable trade-off for this single-service project while code stays feature-local. Extract a
controller when a handler becomes lengthy or needs reuse/testing independent of Express; extract a
service for reusable business rules. Do not describe the current code as strict Clean Architecture.

## Security and tenant isolation

`middleware/auth.ts` verifies the JWT in the HttpOnly cookie or bearer header, attaches the signed
identity to the request, then `requireRole` enforces allowed roles. Resource queries must always
filter by the authenticated `tenantId`; driver routes additionally enforce driver-profile
ownership. The browser is not trusted to enforce authorization.

## Realtime, files, jobs, and integrations

- Socket.IO is the active realtime transport. `frontend/src/services/signalr.ts` is legacy-named
  compatibility code, not an active SignalR architecture.
- PDFKit creates subscription receipts, trip receipts, ledger and ROI reports.
- Nodemailer sends SMTP messages.
- node-cron schedules the driver compliance check hourly in Asia/Kolkata and it also runs at server
  startup. Five drivers are processed concurrently, with reminder-key claims preventing duplicate
  sends.
- Razorpay is integrated through server-side order/payment verification.
- `/api/health` verifies database connectivity; Swagger UI is available under `/swagger`.

For the beginner-level file-by-file walkthrough, data dictionary, validation matrix, formulas,
React hooks, and viva questions, see [PROJECT_GUIDE.md](./PROJECT_GUIDE.md). For exact access/KPI
rules, see [ACCESS_AND_KPI.md](./ACCESS_AND_KPI.md).
