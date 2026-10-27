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
   - `SMTP_FROM`: verified sender email address.
   - `BREVO_API_KEY`: recommended on Render; the Brevo API sends over HTTPS and avoids outbound SMTP restrictions.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: optional SMTP fallback settings for hosts that permit SMTP.
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: appropriate Razorpay credentials.
4. Confirm the service health check at `/api/health`.
5. In Razorpay, configure the production webhook as
   `https://<your-render-service>.onrender.com/api/onboarding/webhook/razorpay` and use the same
   secret configured as `RAZORPAY_WEBHOOK_SECRET` in Render. The backend also accepts
   `/api/onboarding/webhook` as an alias.

The Blueprint builds the Prisma client and frontend bundle but does not apply database changes.
Before deploying a schema update, review it and run `npm run db:push` against the intended database.
The driver compliance scheduler stores its reminder deduplication key in the Prisma schema; apply
that reviewed schema change before deploying the updated server.

## Email delivery and local webhook testing

For Render, create a Brevo API key and set `BREVO_API_KEY` and `SMTP_FROM` in the Render service
environment. `SMTP_FROM` must be a sender address verified in Brevo. When `BREVO_API_KEY` is
present, TransitOps sends verification, reminder, and receipt emails through Brevo's HTTPS API
(including the PDF attachment); SMTP is not used. If the API key is absent, the application falls
back to Nodemailer SMTP using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
Render may restrict outbound SMTP, so the HTTPS API is preferred there. The local
`localhost:1025` default is only for a development mail catcher. Keep all keys out of Git and
redeploy after changing Render environment variables.

For local Razorpay webhook testing only, start the app with `npm run dev` and run `ngrok http 3000`.
Set Razorpay's webhook URL to the ngrok HTTPS forwarding address plus
`/api/onboarding/webhook/razorpay` (or the supported `/api/onboarding/webhook` alias), for example
`https://<ngrok-host>/api/onboarding/webhook/razorpay`. The bare `/api/onboarding/` prefix is not a
webhook handler. It is the router's mount prefix; the webhook route adds `/webhook` or
`/webhook/razorpay`. Use the same webhook secret in local `.env` and Razorpay. Replace the
temporary URL with the Render HTTPS URL before production.

The browser checkout flow calls `POST /api/onboarding/verify-payment` after Razorpay Checkout
returns its payment details. The webhook is a separate Razorpay-to-server notification endpoint;
it must be configured with one of the explicit webhook paths above.

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
