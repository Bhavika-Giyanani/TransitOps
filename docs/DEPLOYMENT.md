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
5. In Razorpay, configure the production webhook as
   `https://<your-render-service>.onrender.com/api/onboarding/webhook/razorpay` and use the same
   secret configured as `RAZORPAY_WEBHOOK_SECRET` in Render.

The Blueprint builds the Prisma client and frontend bundle but does not apply database changes.
Before deploying a schema update, review it and run `npm run db:push` against the intended database.
The driver compliance scheduler stores its reminder deduplication key in the Prisma schema; apply
that reviewed schema change before deploying the updated server.

## SMTP and local webhook testing

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to a verified production
mail-provider account in Render's environment settings. The local `localhost:1025` default is for
a mail catcher, not production. Use the provider's recommended SMTP port and confirm that the
provider/hosting plan permits outbound SMTP. Keep all credentials out of Git.

For local Razorpay webhook testing only, start the app with `npm run dev`, run `ngrok http 3000`,
and configure the temporary HTTPS forwarding address with the path
`/api/onboarding/webhook/razorpay`. Use the same webhook secret in local `.env` and Razorpay.
Replace the temporary URL with the Render HTTPS URL before production.

## Development server ports

The documented root command `npm run dev` starts the API and Vite middleware together on
`PORT` (3000 by default), so no Vite proxy to a separate backend is needed. If running Vite
separately, it listens on 5173 and proxies to `http://127.0.0.1:3000`; set `VITE_BACKEND_URL` to
override that target.

The licence and safety-score scheduler runs at startup and hourly inside the Node web process. For
reliable scheduling, use a single always-on Render instance; free web services can sleep when idle,
so their in-process schedule cannot run while stopped. Reminder sends are deduplicated in the
database, but avoid multiple app replicas unless the scheduler is moved to a dedicated job runner.

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
