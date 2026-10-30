# TransitOps

TransitOps is a role-based fleet operations platform for managing vehicles, drivers, trip dispatch, maintenance, compliance, expenses, and fleet financial performance from one workspace. Its dispatch rules help prevent unsafe or unavailable vehicles and drivers from being assigned.

## Application walkthrough

### 1. Explore the landing page

The splash screen introduces the application, followed by a public landing page with links to sign in or start organization setup.

![TransitOps splash screen](Screenshots/Splash_Screen.png)

![TransitOps landing page](Screenshots/Hero_Section.png)

The landing page also explains the platform's operational rules and the role-based workspaces.

![Automated dispatch rules](Screenshots/TransitOps_Enforced_Rules.png)

![Role-based workspaces](Screenshots/Role_Based%20Access_Control.png)

### 2. Create and activate an organization

New organizations enter their organization and administrator details, verify the email address with a code, and choose a subscription plan. Payment is handled through Razorpay; after the server verifies payment, the administrator receives an account setup link and a PDF receipt by email.

![Organization setup](Screenshots/Organization_Setup_Form.png)

![Subscription plans](Screenshots/Subscription_Plans.png)

![Email verification](Screenshots/Verification_Code_Dispatched_Successfully.png)

![Razorpay payment options](Screenshots/RazorPay_Payment_Options.png)

![Payment processing](Screenshots/Processing_Payment.png)

![Payment successful](Screenshots/Payment_Successful.png)

![Workspace activated](Screenshots/Payment_Verified_WorkSpace_Activated.png)

### 3. Work in a role-specific workspace

After signing in, team members see the views and actions for their assigned role:

| Role | Main responsibilities |
|---|---|
| **Organization Admin** | Create organization accounts and assign roles. |
| **Fleet Manager** | Manage vehicles, drivers, trips, maintenance, and operational performance. |
| **Driver** | Review assigned trips and record delivery completion details. |
| **Safety Officer** | Monitor licence compliance, driver safety, suspensions, and maintenance holds. |
| **Financial Analyst** | Track expenses, operating costs, route economics, and fleet ROI. |

![Organization admin dashboard](Screenshots/Organization_Admin_Dashboard.png)

![Fleet manager dashboard](Screenshots/FleetManager_Dashboard.png)

![Driver dashboard](Screenshots/Driver_Dashboard.png)

![Safety officer dashboard](Screenshots/Safety_Officier_Dashboard.png)

![Safety officer driver compliance roster](Screenshots/Safety_Officier_Driver_Tab.png)

![Financial analyst dashboard](Screenshots/Financial_Analyst_Dashboard.png)

### 4. Dispatch, maintain, and report

Fleet Managers create draft trips by selecting a route, vehicle, eligible driver, cargo weight, distance, and revenue. Dispatch updates trip and resource statuses; Drivers can then complete assigned trips with delivery readings. Maintenance work orders place vehicles in the shop, excluding them from dispatch until the work is closed.

![Trip and dispatch list](Screenshots/Fleet_Manager_Trips_And_Dispatch_Page.png)

![New trip dispatch form](Screenshots/New_Trip_Dispatch_Modal.png)

![Fleet maintenance work orders](Screenshots/FleetManager_Maintenance_Tab.png)

Safety and financial workspaces provide dedicated compliance and reporting views. Reports include operating costs, cost per kilometre, revenue, and fleet ROI, with export options.

![Safety and compliance dashboard](Screenshots/Safety_Officier_Dashboard.png)

![Fleet manager reports](Screenshots/FleetManager_Reports_Page.png)

![Financial analyst reports](Screenshots/Financial_Analyst_Reports_Tab.png)

## Key features

- **Dispatch guardrails:** Exclude suspended drivers and vehicles under maintenance; validate driver licence status and vehicle cargo capacity before dispatch.
- **Role-based access:** Tailor application navigation and permissions for Organization Admins, Fleet Managers, Drivers, Safety Officers, and Financial Analysts.
- **Driver compliance:** Track licence expiry, safety scores, suspension status, and maintenance-related dispatch holds.
- **Operational reporting:** Track fleet KPIs, maintenance and fuel expenses, route costs, profitability, and vehicle ROI. Export reports and generate PDF receipts and ledgers.
- **Live updates:** Socket.IO broadcasts relevant operational changes to connected clients.
- **Organization onboarding:** Verify email, complete Razorpay payment, and activate an organization administrator account.
- **Scheduled compliance checks:** `node-cron` runs driver licence and safety checks at the top of each hour in the `Asia/Kolkata` timezone, and also performs a check when the server starts. Expired licences can suspend drivers; upcoming expiries trigger reminder emails.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts |
| Backend and API | Node.js, Express.js |
| Database | PostgreSQL, Prisma ORM |
| Authentication | JWT, bcryptjs, secure cookies |
| Real-time | Socket.IO |
| Background jobs | node-cron |
| Email | Brevo transactional email API in deployment; Nodemailer SMTP fallback |
| Payments | Razorpay order creation and server-side payment signature verification |
| Documents and exports | PDFKit, csv-stringify |
| API documentation | Swagger UI / OpenAPI |

## Run locally

### Requirements

- Node.js `>=22.12.0`
- npm
- A PostgreSQL database

### Setup

Install dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env`, then configure at least `DATABASE_URL`, `JWT_SECRET`, and `DEMO_ACCOUNT_PASSWORD`. Configure the email and Razorpay values if you want to test organization onboarding or outbound email. The Brevo API key is preferred when present; SMTP is used as a fallback.

Generate Prisma Client, validate the schema, and apply it to your configured database:

```bash
npm run db:validate
npm run db:generate
npm run db:push
```

Start the application:

```bash
npm run dev
```

The application is available at [http://localhost:3000](http://localhost:3000). API documentation is available at [http://localhost:3000/swagger](http://localhost:3000/swagger), with the OpenAPI JSON at [http://localhost:3000/api/docs/swagger.json](http://localhost:3000/api/docs/swagger.json).

## Environment configuration

See [`.env.example`](.env.example) for the full list and [the setup guide](docs/SETUP_GUIDE.md) for deployment and database instructions. Important variables include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection used by the application. |
| `DIRECT_URL` | Optional direct database connection for database operations. |
| `JWT_SECRET` | Secret used to sign authentication tokens; use a strong private value. |
| `DEMO_ACCOUNT_PASSWORD` | Password for the seeded demo accounts. |
| `APP_BASE_URL` | Public application URL used in organization setup links. |
| `BREVO_API_KEY` | Brevo transactional email API key. When configured, it takes precedence over SMTP. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP fallback settings for email delivery. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay credentials for payment processing. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to validate Razorpay webhooks. |

Do not commit `.env` files or production credentials.

## Background email and scheduled jobs

Email is sent through the Brevo transactional email API when `BREVO_API_KEY` is configured. Otherwise, the application uses Nodemailer with the configured SMTP server. The email service handles onboarding verification codes, payment receipts with PDF invoices and account setup links, and driver licence reminders.

The driver compliance job is scheduled in the Node.js web process by `node-cron`. It runs once at startup and hourly at minute zero in the `Asia/Kolkata` timezone. In production, run only one web-service instance with this in-process schedule; multiple instances would each execute the job. If scaling horizontally, move scheduled work to a dedicated single worker or a distributed scheduler.

## CI and deployment

GitHub Actions runs the CI workflow on pushes to `main` and on pull requests. It installs dependencies, validates and generates Prisma Client, then runs the TypeScript check and production frontend build. CI supplies a placeholder PostgreSQL URL for schema commands and does not connect to a production database.

The repository includes a Render Blueprint in [`render.yaml`](render.yaml). The single Node web service builds the frontend into `dist/` and serves the frontend and API together. Configure the required production environment variables in Render, including the database URL, authentication secret, application base URL, payment credentials, and email credentials. `/api/health` is the configured health-check endpoint and verifies database connectivity.

## Repository structure

```text
frontend/
  src/                 React views, components, context, API client, and types
  public/              Static frontend assets
  index.html
  vite.config.ts
backend/
  server.ts            Express entry point; serves the SPA and mounts API modules
  src/
    jobs/              Scheduled driver compliance job
    middleware/        Authentication and authorization
    modules/           API routes for application features
    services/           Email, PDF, KPI, and safety-score services
    db.ts               Prisma client and seed routines
  prisma/               PostgreSQL schema and Prisma configuration
Screenshots/             Application screenshots used in this walkthrough
```

## Demo accounts

The database seed creates these demo accounts. All use the password configured with `DEMO_ACCOUNT_PASSWORD`; demo sign-in accepts that configured password.

- **Fleet Manager:** `manager@transitops.com`
- **Driver:** `driver@transitops.com`
- **Safety Officer:** `safety@transitops.com`
- **Financial Analyst:** `analyst@transitops.com`
- **Organization Admin:** `admin@transitops.com`

Demo accounts share the `demo_tenant`. The demo Organization Admin can manage the other demo roles.

## Further documentation

- [Setup and deployment guide](docs/SETUP_GUIDE.md)
- [Developer handoff](docs/DEVELOPER_HANDOFF.md)
- [Project guide](docs/PROJECT_GUIDE.md)
- [Architecture guide](docs/TRANSITOPS_ARCHITECTURE_GUIDE.md)
