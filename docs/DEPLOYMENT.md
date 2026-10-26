# Render Deployment

TransitOps is deployed as one Node.js web service. Express serves both the API and the compiled
React application, keeping authentication cookies and realtime connections on the same origin.
The repository root contains the npm scripts and `render.yaml` Blueprint.

## Deploy from Render Blueprint

1. Push this repository to GitHub and create a Render Blueprint from it.
2. Render reads [`render.yaml`](../render.yaml) and runs:
   - `npm ci --include=dev && npm run db:generate && npm run build`
   - `npm start`
3. Configure the prompted variables in the Render dashboard. The production service needs:
   - `DATABASE_URL`: PostgreSQL connection string for the application runtime.
   - `DIRECT_URL`: optional direct PostgreSQL connection for schema commands.
   - `JWT_SECRET`: a unique random value of at least 32 characters.
   - `DEMO_ACCOUNT_PASSWORD`: the password for seeded demo roles.
   - `APP_BASE_URL`: the public HTTPS URL of this Render service.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: production mail provider settings.
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: appropriate Razorpay credentials.
4. Confirm the service health check at `/api/health`.

The Blueprint builds the Prisma client and frontend bundle but does not apply database changes.
Before deploying a schema update, review it and run `npm run db:push` against the intended database.

## Local checks

From the repository root:

```bash
npm ci --include=dev
npm run db:validate
npm run db:generate
npm run lint
npm run build
npm start
```

See the [setup guide](./SETUP_GUIDE.md) for PostgreSQL and Razorpay configuration, and the
[architecture guide](./TRANSITOPS_ARCHITECTURE_GUIDE.md) for the source layout.

## Security

Keep credentials in Render's environment settings, not in the repository. Use separate database
credentials for development and production, use live payment credentials only for production, and
rotate any secret that has been accidentally exposed.
