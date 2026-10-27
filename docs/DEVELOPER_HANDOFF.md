# TransitOps Developer Handoff

## Current stack

- React 19, TypeScript, Vite, Tailwind CSS.
- Node.js 22+, Express, Prisma 7, PostgreSQL.
- JWT authentication using an HttpOnly cookie; backend role checks and tenant-scoped queries.
- Socket.IO realtime, Nodemailer SMTP, PDFKit, node-cron, and Razorpay server-side payment verification.

## Source map

- `frontend/src/components/`: reusable UI, views, modals and role dashboards.
- `frontend/src/context/`: session, tenant data, application actions, and theme.
- `frontend/src/services/`: HTTP API and realtime client.
- `backend/server.ts`: Express setup, API router mounting, hosting, health/docs, and job startup.
- `backend/src/modules/<feature>/`: feature-specific Express router and request handlers.
- `backend/src/middleware/`: auth and role authorization.
- `backend/src/services/`: shared KPI, safety-score, PDF, and email logic.
- `backend/src/jobs/`: scheduled compliance work.
- `backend/prisma/schema.prisma`: persisted models/fields/indexes.
- `shared/`: browser/server format validation and shared ROI calculation.

The backend currently keeps route declarations and their handlers in the feature router. This is
an intentional simplicity choice, not a layered controller architecture. Extract controllers or
services when a feature's handler logic is reused, too large, or difficult to test independently.
Do not add empty wrappers merely to satisfy a folder convention.

## Run and validate

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for environment/database setup and
[DEPLOYMENT.md](./DEPLOYMENT.md) for Render, SMTP, Razorpay, and public URL configuration. Useful
root commands: `npm run dev`, `npm run lint`, `npm run build`, `npm run db:validate`,
`npm run db:generate`, and (only after reviewing database effects) `npm run db:push`.

## Security reminders

- Never commit `.env`, passwords, JWT secrets, database URLs, or Razorpay/SMTP credentials.
- Keep tenant filters in every protected database query.
- Enforce role and ownership checks on the server, not just in React.
- Indian licence/registration validation is format plausibility only; it is not a government lookup.
- node-cron runs in the web process. Before horizontally scaling, move it to one worker or a
  distributed scheduler with locking.

The complete academic explanation and file catalog are in [PROJECT_GUIDE.md](./PROJECT_GUIDE.md).
