# TransitOps Project Guide: Beginner's Handbook, Demo Script, and Viva Q&A

This is the code-grounded guide to the project. It assumes no prior knowledge of the codebase.
For local setup, use [SETUP_GUIDE.md](./SETUP_GUIDE.md); for hosting, use
[DEPLOYMENT.md](./DEPLOYMENT.md). The API permissions and formulas are summarized in
[ACCESS_AND_KPI.md](./ACCESS_AND_KPI.md).

## 1. The project in plain language

TransitOps is a multi-organization fleet operations web application for Indian logistics
companies. Each organization can manage vehicles, drivers, trips, maintenance, expenses,
compliance, and reports from one workspace. Staff members receive different screens and API
permissions based on their role.

The application has two main halves:

- **Frontend:** React renders screens in the browser and sends HTTP requests.
- **Backend:** Express authenticates requests, checks permissions and organization ownership,
  applies business rules, and reads or writes PostgreSQL through Prisma.

The main data path is:

```text
Browser (React + TypeScript)
       │ HTTP/JSON, authentication cookie
       ▼
Express API (Node.js)
       │ Prisma Client + PostgreSQL adapter
       ▼
PostgreSQL
       │
       ├── Socket.IO sends live events to same-organization clients
       ├── Nodemailer sends email through configured SMTP
       ├── PDFKit creates PDF reports and receipts
       └── node-cron runs hourly licence/safety checks
```

In development, Express hosts Vite middleware on port `3000`; Vite can also run separately on
`5173` and proxy API calls to Express. In production, `npm run build` creates the frontend bundle
in root `dist/`; the same Express server serves that bundle and the API. Render can therefore run
one web service.

## 2. Words you need to know

| Term | Simple meaning in this project |
|---|---|
| Client / frontend | The React application in the browser. It displays the forms and dashboards. |
| Server / backend | The Node.js Express application. It must not trust the browser to enforce security. |
| API | A defined HTTP endpoint such as `POST /api/trips` that receives or returns JSON. |
| Database / PostgreSQL | Persistent storage for users, vehicles, trips, and related records. |
| Prisma | The ORM and generated TypeScript database client used by the backend. |
| Tenant | One customer organization's private data boundary. `tenantId` is the tenant identifier. |
| Authentication | Proving who the user is, here by verifying a signed JWT. |
| Authorization | Deciding whether that authenticated user may perform an action. |
| RBAC | Role-Based Access Control: permissions are associated with roles. |
| ORM | A tool that maps program objects to database records and builds database queries. |
| Hash | A one-way password representation; the original password is not stored. |
| Realtime event | A server-pushed update to connected screens without a manual page refresh. |
| Background job | Scheduled server-side work that runs independently of a user's request. |
| SaaS | Software as a Service: organizations subscribe to a hosted application. |

## 3. Architecture and why it is organized this way

The repository is a small full-stack TypeScript application organized by runtime and by backend
feature. React components are grouped into shared components, dashboards, modals, views, context,
services, and utilities. Backend API routes are grouped into feature modules such as `drivers`,
`trips`, and `vehicles`; cross-feature work belongs in `services`, `middleware`, and `jobs`.

This is a pragmatic **feature-module architecture**, not a claim that the project implements every
layer of Clean Architecture. Each `*.routes.ts` currently declares its Express endpoints and
contains the request handler, validation, and database calls. That co-location is reasonable for
an academic single-service project because it keeps a feature's HTTP contract and behavior together
and avoids empty controller/service wrappers. The reusable calculations (KPI, PDF, safety score),
cross-cutting security (auth middleware), and scheduled work are already separate. As a route file
grows or logic is reused, the next sensible step is to extract a controller for HTTP request/response
handling and a service for reusable business rules; splitting every short handler now would add
navigation without improving the current behavior.

### Directory map

```text
TransitOps-WTP/
├── backend/
│   ├── prisma/                 Prisma schema and CLI configuration
│   ├── server.ts               Express application composition and startup
│   └── src/
│       ├── db.ts               PostgreSQL pool, Prisma client, initial seed data
│       ├── middleware/         JWT authentication and role checks
│       ├── modules/            Feature routers and their request handlers
│       ├── jobs/               Scheduled driver compliance job
│       ├── services/           Email, KPI, PDF, and safety-score logic
│       ├── utils/              Shared backend date helpers
│       ├── realtime.ts         Socket.IO setup and tenant-scoped event emission
│       └── swagger.ts          OpenAPI document for the API
├── frontend/
│   ├── vite.config.ts          Vite development/build configuration
│   └── src/
│       ├── components/         Shared UI, role dashboards, modals, and views
│       ├── context/            App-wide session/data and theme state
│       ├── services/           HTTP API and realtime client
│       ├── utils/              Browser formatting helpers
│       ├── App.tsx             Main layout, view selection, modal ownership
│       ├── main.tsx            Browser entry point
│       └── types.ts            Frontend domain and API-facing TypeScript types
├── shared/
│   ├── indianFormats.ts        Indian phone, licence, and registration format checks
│   └── vehicleRoi.ts           ROI calculation shared by browser and PDF export
├── database/                   Optional SQL/RLS reference scripts
├── docs/                       Setup, deployment, architecture, and viva material
├── package.json                Root scripts and runtime/development dependencies
└── render.yaml                 Render service configuration
```

### Important file-by-file guide

#### Root and frontend

| File/folder | Responsibility |
|---|---|
| `package.json` | Scripts (`dev`, `build`, `start`, `lint`, Prisma commands) and package versions. |
| `frontend/src/main.tsx` | Mounts the React application into the HTML root element. |
| `frontend/src/App.tsx` | Wraps providers, chooses the allowed view, owns shared modals, and composes the page layout. |
| `frontend/src/types.ts` | Shared frontend interfaces for roles, vehicles, drivers, trips, and records. |
| `frontend/src/context/AppContext.tsx` | Session, loaded tenant data, API actions, notifications, and computed frontend values. |
| `frontend/src/context/ThemeContext.tsx` | Light/dark theme state and theme application. |
| `frontend/src/services/api.ts` | Typed HTTP calls to Express; centralizes request/error handling. |
| `frontend/src/services/signalr.ts` | Legacy-named compatibility wrapper; the active realtime client uses `socket.io-client`. It is not proof that the backend uses SignalR. |
| `frontend/src/utils/indianFormats.ts` | Re-exports shared India-specific format validation for UI forms. |
| `frontend/src/utils/currency.ts` | Currency-formatting helpers. |
| `frontend/src/components/Navbar.tsx` | Top navigation, user actions, and notification affordances. |
| `frontend/src/components/Sidebar.tsx` | Role-aware application navigation. Backend authorization remains the security boundary. |
| `frontend/src/components/NotificationToast.tsx` | Accessible timed notifications; pauses timing while a toast is hovered. |
| `frontend/src/components/dashboard/*Dashboard.tsx` | Role-specific operational, driver, safety, and finance dashboards. |
| `frontend/src/components/dashboard/GettingStartedGuide.tsx` | First-use guidance and setup progress for supported roles. |
| `frontend/src/components/dashboard/LiveRouteRadar.tsx` | Visual trip/route panel; it is not a GPS tracking source. |
| `frontend/src/components/modals/AddVehicleModal.tsx` | Vehicle creation form. |
| `frontend/src/components/modals/AddDriverModal.tsx` | Driver profile/login creation form. |
| `frontend/src/components/modals/CreateTripModal.tsx` | Draft trip form and eligibility/capacity feedback. |
| `frontend/src/components/modals/CompleteTripModal.tsx` | Completion odometer and fuel form. |
| `frontend/src/components/modals/LogMaintenanceModal.tsx` | Maintenance work-order creation form. |
| `frontend/src/components/views/AuthViews.tsx` | Login and account setup views. |
| `frontend/src/components/views/DashboardView.tsx` | Onboarding/dashboard switch and role-dashboard selection. |
| `frontend/src/components/views/TripsView.tsx` | Trip lists and trip actions. |
| `frontend/src/components/views/DriversView.tsx` | Driver list and compliance actions. |
| `frontend/src/components/views/VehiclesView.tsx` | Vehicle list and asset actions. |
| `frontend/src/components/views/MaintenanceView.tsx` | Maintenance records and closure actions. |
| `frontend/src/components/views/ExpensesView.tsx` | Expense entry and ledger interaction. |
| `frontend/src/components/views/ReportsView.tsx` | Report/export controls. |
| `frontend/src/components/views/OrganizationAdminDashboard.tsx` | Organization staff account administration. |
| `frontend/src/components/views/SaasOnboardingView.tsx` | Subscription selection, email verification, payment, and password setup flow. |
| `frontend/src/components/views/HeroView.tsx` | Public landing page and demo-role entry points. |
| `frontend/src/components/views/NotFoundView.tsx` | Unknown-route page. |

#### Backend

| File/folder | Responsibility |
|---|---|
| `backend/server.ts` | Creates Express/HTTP server, middleware, API mounts, health/docs endpoints, Vite/static hosting, Socket.IO and job startup. |
| `backend/src/db.ts` | Loads environment, creates the PostgreSQL pool and Prisma adapter/client, and seeds plans/demo data when appropriate. Demo accounts use `DEMO_ACCOUNT_PASSWORD`; there is no hardcoded demo-login password. |
| `backend/src/middleware/auth.ts` | Signs/verifies JWTs, reads bearer/cookie tokens, attaches the user to the request, and supplies `requireAuth` / `requireRole`. |
| `backend/src/modules/auth/auth.routes.ts` | Login, session verification, and logout endpoints. |
| `backend/src/modules/admin/admin.routes.ts` | Organization Admin staff list/create/update/delete endpoints. |
| `backend/src/modules/vehicles/vehicles.routes.ts` | Tenant-scoped vehicle CRUD/status endpoints and registration normalization. |
| `backend/src/modules/drivers/drivers.routes.ts` | Driver profile actions, expiry checks, score refresh, reminders, suspension, and incident endpoints. |
| `backend/src/modules/drivers/driverAccounts.ts` | Repairs/ensures matching driver login/profile data for older account records. |
| `backend/src/modules/drivers/driverIdentity.ts` | Resolves the current user's linked driver profile. |
| `backend/src/modules/trips/trips.routes.ts` | Tenant-scoped trip listing, draft creation, dispatch, completion, cancellation, and ownership checks. |
| `backend/src/modules/maintenance/maintenance.routes.ts` | Maintenance work-order creation/closure and associated vehicle status changes. |
| `backend/src/modules/expenses/expenses.routes.ts` | Expense list/create/delete endpoints. |
| `backend/src/modules/kpi/kpi.routes.ts` | Role-protected KPI endpoints. |
| `backend/src/modules/reports/reports.routes.ts` | PDF/CSV export endpoints and driver receipt ownership checks. |
| `backend/src/modules/onboarding/onboarding.routes.ts` | Subscription/email verification/Razorpay callback and organization setup endpoints. |
| `backend/src/services/kpi.ts` | Fleet, driver, safety, and financial KPI calculations. |
| `backend/src/services/safetyScore.ts` | Safety score factor calculation and persistence. |
| `backend/src/services/pdf.ts` | PDFKit report and receipt creation. |
| `backend/src/services/email.ts` | Nodemailer SMTP transport and transactional messages. |
| `backend/src/jobs/driverCompliance.job.ts` | Startup check and hourly Asia/Kolkata licence/safety checks and reminders. |
| `backend/src/realtime.ts` | Socket.IO server setup, tenant rooms, and event publishing. |
| `backend/src/utils/indianDate.ts` | India-time date-string helper for expiry logic. |
| `backend/src/swagger.ts` | OpenAPI description consumed by Swagger UI. |
| `backend/prisma/schema.prisma` | Database models, fields, primary keys, defaults, and indexes. |
| `backend/prisma.config.ts` | Prisma CLI datasource/environment configuration. |

## 4. Roles, permissions, and organization isolation

The five role values are `organization_admin`, `fleet_manager`, `driver`, `safety_officer`, and
`financial_analyst`. They are stored as strings. There is no separate dispatcher role.

| Role | Main job | Typical permitted actions |
|---|---|---|
| Organization Admin | Manage the organization's staff accounts | List/create/update/delete operational accounts; cannot promote users to another Organization Admin. |
| Fleet Manager | Run day-to-day fleet operations | Manage vehicles, drivers, trips, maintenance, expenses, and operational reports. |
| Driver | Work on assigned deliveries | Read assigned trips and complete their own dispatched trips; does not receive other drivers' trips. |
| Safety Officer | Monitor people and compliance | Review drivers, scores, incidents, licence reminders/suspensions, and maintenance safety information. |
| Financial Analyst | Review costs and returns | Read financial/operational records, manage expense entries, and export reports as authorized. |

This follows least-privilege separation: the admin manages staff identities, the Fleet Manager
changes operational records, the Driver can act only on assigned work, the Safety Officer focuses
on compliance, and the Financial Analyst focuses on financial analysis. The split reduces
accidental edits and avoids showing unrelated controls to each role.

The exact endpoint matrix is documented in [ACCESS_AND_KPI.md](./ACCESS_AND_KPI.md). The
frontend hides actions that a role should not use, but hiding a button is not security. The API
enforces authorization using `requireAuth` and `requireRole`.

### How tenant isolation works

1. A signed-in JWT includes the user's `tenantId`.
2. Authentication middleware validates the JWT and attaches its trusted payload to `req.user`.
3. Each protected query/write includes the authenticated `tenantId` in its Prisma `where` clause.
4. Driver endpoints further filter by the driver profile linked to that user.
5. Realtime events are emitted with a tenant identifier and delivered within the corresponding tenant room.

The application stores `tenantId` on its operational models and indexes it. Many associations are
scalar ID fields rather than declared Prisma relation/FK fields. Therefore the application-level
tenant filters and business checks are essential; the schema does not by itself create full
relational foreign-key enforcement. The PostgreSQL RLS scripts are defense-in-depth/reference
material and do not replace API filters.

`User.email` is globally unique, while vehicle registrations and licence duplicate checks are scoped
to the organization. A duplicate registration/licence in another tenant is not disclosed by the
organization-scoped duplicate check.

## 5. Authentication: login, JWT, and protected routes

### Login flow

1. The browser sends email and password to `POST /api/auth/login`.
2. The API finds the user and verifies the password with `bcryptjs` against `passwordHash`.
3. On success, the server signs a JWT using `JWT_SECRET`; configuration requires a secret with at
   least 32 characters.
4. The JWT expires after **7 days** and is set in the `transitops_jwt` HttpOnly cookie.
5. The browser sends the cookie automatically on later requests. The API can also accept a
   `Bearer` token for API clients.
6. `requireAuth` verifies the token signature and expiry; `requireRole(...)` checks the role.
7. The frontend restores the current session from the API and chooses the role-appropriate view.

JWT means JSON Web Token. It consists of a signed header, payload, and signature. The payload is
readable by its holder; it is signed, not encrypted. It must not contain secrets. In this project
the payload includes identity, email, role, tenant, name, and demo-account status. The secret stays
on the server. Passwords are hashed with bcrypt (10 rounds in account creation), never sent back
to the browser, and never stored as plaintext.

The cookie is HttpOnly so ordinary page JavaScript cannot read it. Production must use HTTPS and a
secure cookie configuration. Logout clears the cookie; a copied JWT remains valid until expiry
unless the application adds a revocation list/session-version mechanism.

**Viva distinction:** frontend route/view gating is usability; backend middleware is authorization.
Never rely only on a React check for access control.

## 6. End-to-end business flow

### Subscription and first Organization Admin

```text
Choose plan → enter organization/admin/email → verify email code
→ create Razorpay order → verify payment signature server-side
→ receipt PDF/email + admin setup-link email
→ admin creates initial password → organization workspace
```

The payment/email operations require environment configuration. A test fallback key is not a live
payment credential. The setup URL uses `APP_BASE_URL` when configured. Payment callbacks and email
delivery must be tested with sandbox credentials before deployment.

### Fleet operations

1. Organization Admin creates operational staff accounts; driver account creation creates a
   corresponding Driver profile.
2. Fleet Manager registers a vehicle and ensures the driver profile is available.
3. Fleet Manager creates a **Draft** trip by choosing an available vehicle and eligible driver.
4. Dispatch changes the trip to **Dispatched** and vehicle/driver state to **On Trip**.
5. Driver sees their own assigned trip and may complete it with final odometer/fuel readings.
6. Completion records trip outcome and updates associated operational data.
7. Maintenance records put vehicles **In Shop**; closing the work order can return them to
   **Available**.
8. Finance and safety dashboards/report endpoints calculate current values from tenant records.

The API rechecks eligibility. A client-side selector is helpful but cannot authorize a dispatch.
The active route panel is a visualization of stored routes; the schema does not store GPS
coordinates and the app should not be presented as live GPS tracking.

The welcome guide is shown per account using a versioned browser `localStorage` key. That means
the same account can see it again on a different browser/device. Fleet Manager onboarding stays
available after vehicle registration and is only marked dismissed from the dashboard switch after
the organization has at least one trip.

### Realtime demonstration

Socket.IO broadcasts operations such as trip dispatch, vehicle/driver status, maintenance, and
notifications. Open two browser sessions for the same tenant and observe an event on one session
arrive on the other without refresh. Do not use two tenants for this demonstration; cross-tenant
non-delivery is a separate isolation check.

## 7. Forms and validation rules

Validation should exist at the API boundary, even when the browser also provides immediate
feedback. The following reflects the active implementation; where an API currently relies on
conversion/defaults rather than a strict schema, that limitation is stated rather than disguised.

| Form | Main fields and current rules |
|---|---|
| Login | Email is required and must be a valid email address; password is required. Password policy is enforced at account creation, not repeated as a login rule. |
| Subscription start | Organization name and admin name: at least 2 characters after trim. Email must be valid and is normalized to lowercase. |
| Email verification | Purchase id/secret required; code must be exactly 6 characters. The code must match the pending session. |
| Plan/payment | A plan id is required. Razorpay order id, payment id, and signature are required; payment authenticity is checked server-side. |
| Setup password | At least 8 characters; token required. It is hashed before persistence. |
| Organization Admin create account | Full name at least 2 characters, valid email, password at least 10 characters, and an allowed non-admin role. For Driver role: Indian phone, valid-format licence, category, and expiry are required. |
| Organization Admin update account | Valid email; optional new password must be at least 10 characters. Role must map to an allowed operational role. Driver fields are required/validated when the resulting account is a Driver. |
| Fleet Manager add driver | Name 2–100 characters; valid email (max 256); password 10–128 characters; licence/category/contact fields required; phone/licence normalized; expiry must be a valid date no more than 20 years ahead and not before licence issue year. Expired licences are immediately suspended. |
| Driver edit/status | Name must be 2–100 characters when supplied; email must be valid; phone/licence/expiry are normalized and checked; an expired licence cannot be reinstated. Role authorization is Fleet Manager or Safety Officer for supported compliance actions. |
| Vehicle | Registration is required and must match a supported Indian standard/Delhi/BH format with a valid state/UT code; duplicates are checked within the tenant. Name and model are optional; type and region are dropdowns. Browser constraints require capacity ≥100 kg, odometer ≥0, and acquisition cost ≥₹1,000. The API strictly normalizes registration but applies defaults to several numeric/metadata fields rather than enforcing all browser ranges. |
| Vehicle edit/status | Registration edits use the same normalized format and tenant duplicate check. Numeric values are converted by the API; not every edited numeric field has a strict range schema yet. Retirement is a status change, not physical deletion. |
| Create trip | Source/destination are required; vehicle and driver selection is required; cargo and planned distance have browser minimum 1. Revenue is required in the UI and must be ≥0. API validation trims source/destination to 1–200 characters, requires IDs, requires finite positive cargo/distance and finite non-negative revenue, then checks tenant ownership, vehicle/driver status, capacity, and current licence. |
| Complete trip | Final odometer is required and has a browser minimum equal to current odometer; fuel is required, ≥0, and uses 0.5-litre steps. API requires finite non-negative readings and final odometer not below the vehicle's current odometer, then validates trip state/ownership. |
| Maintenance | Vehicle and service type are selected; cost is required and browser minimum is ₹0; description and technician notes are optional. The vehicle must belong to the tenant. The API coerces numeric cost and defaults a missing value to zero, rather than enforcing all browser ranges. |
| Close maintenance | Work-order id must exist in the tenant. Optional final cost replaces the estimate; technician notes may be updated. The API marks the work order completed and returns the vehicle to Available when appropriate. |
| Expense | Vehicle selection is required; category is selected; amount is required and >₹0. Fuel category additionally requires liters >0; fuel type is selected. Date is required by the form; odometer and notes are optional. Vehicle/trip references, when supplied, must belong to the tenant. API currently converts numeric fields and falls back to zero; it does not apply a comprehensive strict field schema. |
| Incident/suspension | Target driver must belong to tenant; actions are role-protected. An expired licence prevents reinstatement. |

### Indian registration/licence/phone checks

`shared/indianFormats.ts` is used by browser forms and API validation:

- Mobile: accepts a 10-digit Indian number beginning 6–9, optionally with `+91` or `91`, and stores normalized `+91##########`.
- Standard vehicle registration: state/UT code + RTO digits + series letters + number; Delhi has its supported special pattern.
- Bharat (BH) registration: supported year range (2021 to current year), four-digit number (not all zeros), and one/two series letters excluding I and O.
- Driving licence format: 15 characters after separators are removed: state code, two-character RTO segment, issue year, and seven-digit serial; rejects unknown state codes, zero RTO, issue year outside 1950–current year, and all-zero serial. The RTO segment check is a plausibility check, not an official RTO lookup.
- Licence expiry: must be parseable, not more than 20 years in the future, and not earlier than the issue year encoded in the licence.

Sarathi Parivahan is the Ministry of Road Transport and Highways' online service platform for
driving-licence-related services such as applications, renewals, and appointments. Requirements can
depend on the licence class and jurisdiction. TransitOps does not connect to Sarathi or VAHAN and
does not verify a licence against a government record, ownership, authenticity, or legal eligibility;
its checks are **format plausibility only**. Explain this clearly in a viva.

### Password rules are not all identical

- Organization Admin-created staff and Fleet Manager-created driver passwords: minimum 10
  characters; the driver creation schema caps at 128.
- Subscription setup password: minimum 8 characters.
- Login accepts the stored account password; it does not create/change password rules.
- Password hashes use bcryptjs. No plaintext passwords should appear in database fields or logs.

## 8. Metrics and calculations

The detailed definitions live in [ACCESS_AND_KPI.md](./ACCESS_AND_KPI.md). Explain each metric with
its unit and data source. Do not claim that a displayed score is a government-certified rating.

### Fleet

- Utilization = `On Trip vehicles ÷ non-retired vehicles × 100`, rounded to one decimal place;
  zero when there are no eligible vehicles.
- Active trips = trips with status `Dispatched`.
- Pending departures = trips with status `Draft`.
- Available, maintenance-hold, and active vehicle counts use the respective stored statuses.

### Financial

- Fuel spend = sum of `Fuel` expense amounts.
- Maintenance spend = sum of maintenance record costs.
- Other expenses = expenses whose type is not `Fuel`.
- OPEX = maintenance + fuel + other expenses.
- Gross revenue = sum of revenue on completed trips.
- Net profit = gross revenue − OPEX.
- Net margin = net profit ÷ gross revenue × 100, rounded to one decimal place; zero when revenue is zero.
- Cost per km = OPEX ÷ completed trips' planned distance, rounded to two decimals; zero when distance is zero.
- Per-vehicle ROI = `(revenue − maintenance cost − fuel cost) ÷ acquisition cost × 100`,
  rounded to an integer. It is explicitly **0% when no revenue has yet been earned** or
  acquisition cost is zero, so a new vehicle does not show a misleading negative ROI before its
  first completed/revenue-producing work. The same shared helper powers the dashboard and PDF.

### Driver safety score (0–100)

Start at 100 and apply the following factors; clamp the final score to 0–100:

- Incidents: −8 each, maximum penalty −40.
- Licence: −25 if expired; −5 if expiring within 30 days.
- Fuel discipline: evaluate up to 10 most recent completed trips with positive planned distance and
  fuel data. If fewer than 3 are evaluable, no fuel penalty. Otherwise compare planned distance
  divided by entered fuel with 85% of the vehicle's rated efficiency; penalty is proportional to the fraction of inefficient trips,
  up to −15.
- Experience: +1 for each 25 completed trips, capped at +5.

Score bands: 90–100 Excellent, 75–89 Good, 60–74 Needs attention, below 60 High risk. It is a
project-defined heuristic, not a validated safety or insurance standard.

The KPI service currently reports `onTimeDepartureRate` as the fixed placeholder `94.5`; the model
does not record a promised departure timestamp from which a genuine on-time rate could be derived.
State this limitation if asked.

## 9. Database schema: every model and field

Schema source: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Most tables have
`tenantId` and a tenant index so organization-scoped queries can be efficient. Fields such as
status and role are strings, not Prisma enums. The design currently uses scalar IDs rather than
formal Prisma relations/foreign keys for most cross-model links.

### `User` — login identity and account

| Field | Purpose |
|---|---|
| `id` | Primary key, generated UUID. |
| `tenantId` | Organization boundary used in API filters. |
| `email` | Login/contact email; globally unique. |
| `passwordHash` | bcrypt password hash, never plaintext. |
| `fullName` | Display name. |
| `role` | Role string used by backend authorization. |
| `isDemoAccount` | Identifies a seeded demo identity. |
| `avatarUrl` | Optional profile image URL. |
| `driverId` | Optional scalar link to the Driver profile. |
| `contactNumber` | Optional phone, especially for driver-role accounts. |
| `licenseNumber`, `licenseCategory`, `licenseExpiryDate` | Optional driver identity/compliance data mirrored from the Driver profile. |
| `createdAt`, `updatedAt` | Creation and last-update timestamps. |

### `Vehicle` — fleet asset

`id` is the primary key; `tenantId` scopes the organization. `registrationNumber` is the normalized
plate identifier; `name`, `model`, and `type` are display/classification data. `maxCapacityKg`
stores rated payload; `currentOdometerKm` stores latest odometer. `acquisitionCost` supports ROI.
`status` stores Available/On Trip/In Shop/Retired state. `region` supports fleet grouping.
`revenueGenerated` stores cumulative vehicle revenue; `fuelEfficiencyKmPerLiter` is the rated km/L
baseline for safety calculations. `documents` is a JSON-encoded string of vehicle document
metadata. `createdAt`/`updatedAt` record timestamps.

### `Driver` — driver profile/compliance record

`id` primary key; `tenantId` tenant scope; `name`, `email`, `contactNumber` identify the person.
`licenseNumber`, `licenseCategory`, `licenseExpiryDate` store licence data. `safetyScore` stores
the calculated 0–100 score; `status` stores availability/suspension. `tripsCount`,
`totalTripsCompleted`, and `incidentHistoryCount` support operational/safety summaries.
`identityUserId` links to the login account; `lastLicenseReminderKey` prevents duplicate scheduled
reminders for the same expiry-date/week bucket. `createdAt`/`updatedAt` are timestamps.

### `Trip` — freight movement

`id` primary key; `tenantId` tenant scope; `tripCode` human-readable reference; `source` and
`destination` route endpoints. `vehicleId`/`driverId` refer to assigned records. `vehicleRegNumber`,
`vehicleName`, and `driverName` snapshot display identifiers for historical records. `cargoWeightKg`
and `plannedDistanceKm` store load and plan; `revenue` stores expected/earned trip revenue.
`status` is Draft/Dispatched/Completed/Cancelled. `dispatchedAt` and `completedAt` store lifecycle
timestamps. `finalOdometerKm` and `fuelConsumedLiters` are completion readings. `createdAt` and
`updatedAt` track record changes.

### `MaintenanceRecord` — repair/service work order

`id` primary key; `tenantId` scope; `vehicleId` and the snapshot fields
`vehicleRegNumber`/`vehicleName` identify the asset. `serviceType`, `description`, `cost`, and
`technicianNotes` describe work. `date` and `startDate` record start; `completedDate` and
`completedAt` record completion. `status` distinguishes active from completed work. Timestamps
track record creation/update.

### `Expense` — operating expense

`id` primary key; `tenantId` scope; `vehicleId`/`tripId` optional operational references.
`vehicleRegNumber`/`vehicleName` are optional snapshots. `type` and `category` classify the cost.
`amount` is the recorded amount; `cost` is a compatibility/duplicate amount field used by some
frontend calculations. `date` and `expenseDate` are date representations used by existing UI/API
paths. `liters`/`fuelLiters` store fuel volume; `odometerReading` stores an optional reading.
`description`/`notes` provide text. `createdAt`/`updatedAt` are timestamps.

### `SubscriptionPlan` — purchasable plan

`id` primary key; `name` display name; `amountPaise` integer price in paise (100 paise = ₹1);
`currency` ISO currency string (default INR); `termMonths` billing period; `features` JSON encoded
as a string.

### `PurchaseSession` — temporary subscription/setup workflow

`id` primary key; `purchaseSecret` identifies/authorizes the pending workflow; `organizationName`,
`fullName`, `email` capture prospective customer/admin. `verificationCode` and `emailVerified`
represent email verification. `planId`, `orderId`, `paymentId`, and `paymentVerified` represent
plan/payment progress. `receiptEmailSent` and `setupEmailSent` prevent duplicate sends;
`setupCompleted` marks account setup completion. `createdAt` records session creation.

## 10. Background work, email, PDF, and external services

| Technology | Why it is present |
|---|---|
| `node-cron` | Schedules the driver licence/safety check at the start of every hour in Asia/Kolkata and runs the same check once at server startup. |
| Nodemailer | Sends SMTP email: subscription, account setup, and licence reminders. |
| PDFKit | Generates payment receipts, trip receipts, fleet ROI, and ledger PDFs. |
| Razorpay REST API | Subscription checkout/order/payment verification. Configure live or test credentials; do not treat demo fallback credentials as production settings. |
| Socket.IO | Pushes tenant-scoped updates to currently connected browser sessions. |
| Swagger UI | Serves the API description at `/swagger` and `/api-docs`. |
| PostgreSQL health query | `/api/health` checks database connectivity. |

The hourly job suspends expired-licence drivers, recalculates scores, and sends reminders for
licences expiring within 30 days. Reminder keys are stored to avoid weekly duplicates for an expiry
date. Up to five drivers are processed concurrently to reduce serial SMTP delay; a failed send
restores the prior key so a later run can retry. Driver list retrieval also
refreshes expiry status/score so an expired licence is not left with a stale score until the next
cron run. SMTP connection/greeting/socket timeouts bound the wait for a mail server response.

There is no durable job queue in this project. `node-cron` runs inside the web process; if Render
restarts or multiple web instances run, each instance can schedule work. For a larger production
deployment, use a single dedicated worker/queue and an idempotent distributed lock.

## 11. Node packages and what each does

Versions and the complete dependency list are in root `package.json`.

### Runtime packages

| Package | Use |
|---|---|
| `react`, `react-dom` | Build and mount the browser UI. |
| `express` | HTTP API and static/Vite middleware host. |
| `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg` | Typed database client, schema/CLI, PostgreSQL adapter, and connection pool. |
| `bcryptjs` | Password hashing and verification. |
| `jsonwebtoken` | Sign and verify JWT authentication tokens. |
| `cookie-parser` | Read the authentication cookie in Express. |
| `cors` | Configure cross-origin request handling. |
| `dotenv` | Load environment variables from `.env` for local execution. |
| `zod` | Runtime request validation for schemas such as login, account, and subscription inputs. |
| `socket.io`, `socket.io-client` | Realtime server and browser client. |
| `node-cron` | Scheduled compliance work. |
| `nodemailer` | SMTP mail sending. |
| `pdfkit` | PDF document generation. |
| `csv-stringify` | Escape/format CSV exports. |
| `swagger-ui-express` | Host interactive API documentation. |
| `vite`, `@vitejs/plugin-react` | Frontend development/build tooling and React transform. |
| `@tailwindcss/vite`, `tailwindcss` | Utility CSS integration and styling. |
| `lucide-react` | Icons. |
| `recharts` | Charts. |
| `motion` | UI animation. |
| `@microsoft/signalr` | Legacy dependency retained in the manifest; Socket.IO is the active realtime transport. |

### Development/type packages

`typescript` type-checks source. `tsx` runs TypeScript entry points in Node. `@types/*` packages
provide types for dependencies that need them. `autoprefixer` adds browser CSS prefixes.
`esbuild` is a fast JavaScript bundler used by tooling.

## 12. React hooks: the beginner version

A hook is a React function that lets a function component use state, side effects, context, or
other React behavior. Hooks must be called at the top level of a React component/custom hook, not
inside conditions or loops.

| Hook | Meaning | Where it is used |
|---|---|---|
| `useState` | Stores UI state and re-renders when it changes. | Forms, open/closed modals, filters, selected tabs, loading/errors, notifications. |
| `useEffect` | Runs synchronization after render, such as loading data or attaching event listeners. | App session/data loading, view synchronization, modal vehicle selection, toast timers, dashboard KPI loads. |
| `useMemo` | Reuses a computed value until its dependencies change. | Not currently used in this source; add it only if profiling shows an expensive derived value needs memoization. |
| `useCallback` | Reuses a function identity until dependencies change. | Context/API actions and effect dependencies, preventing unnecessary resubscription/reload. |
| `useRef` | Holds a mutable value without causing a render. | Toast timer bookkeeping, socket/client instances, and values that must persist between renders. |
| `useContext` | Reads a value supplied by a parent Provider. | `useApp()` reads AppContext; `useTheme()` reads ThemeContext. |
| `useApp`, `useTheme` | Project-defined custom hooks built on `useContext`. | Provide typed access to application data/actions and theme state without importing context internals into each component. |
| `createContext` | Creates a context container that can be supplied to descendants. | App and theme context definitions. |

The hooks currently used are `useState`, `useEffect`, `useCallback`, `useRef`, and `useContext`.
`createContext` creates the App/Theme context containers but is not itself a hook. `useMemo` and
`useReducer` are not currently used. To find a behavior, search for the component and the relevant
hook rather than assuming every screen works identically.

## 13. Demonstration script (about 8–10 minutes)

Prepare two browser windows in a side-by-side/split-screen layout. Use two accounts in the **same
demo organization** for realtime. Keep one window as Fleet Manager and the other as Driver or
Safety Officer. Avoid showing real credentials or secret environment values.

| Time | Demo action | What to explain |
|---|---|---|
| 0:00–0:45 | Introduce TransitOps and show the five roles. | The problem: operations, compliance, and finance data should be organization-scoped. |
| 0:45–1:30 | Sign in as Organization Admin; show staff list and role assignments. | JWT authentication and server-side authorization; admin manages staff, not every fleet operation. |
| 1:30–2:15 | Open a second window and sign in as Fleet Manager. | Each role gets a different dashboard; both windows belong to the same tenant. |
| 2:15–3:15 | Create a Draft trip in Fleet Manager; observe it appear for its assigned Driver. | A driver sees assigned trips only; a draft is awaiting dispatch. |
| 3:15–4:00 | Dispatch the trip; point out the realtime status update in both windows without refresh. | Socket.IO push event, tenant room, UI update; backend revalidates vehicle/driver eligibility. |
| 4:00–4:45 | Complete the dispatched trip from Driver; enter final odometer/fuel. | The driver cannot complete another driver's trip; readings feed operating/safety information. |
| 4:45–5:30 | Show capacity warning, an invalid phone/licence/registration, and validation message. | Browser feedback is convenient; server validation is authoritative; Sarathi/VAHAN is not queried. |
| 5:30–6:15 | Show a vehicle moved In Shop by maintenance and then close the work order. | Maintenance status prevents dispatch until resolved. |
| 6:15–7:00 | Show licence status/score and explain the expiry penalty/reminder job. | The compliance job runs at startup and hourly in IST; list reads refresh stale expiry state. |
| 7:00–8:00 | Open reports or ROI PDF; compare it with dashboard. | Shared ROI helper, ₹ currency, PDF export; zero earned revenue is 0% ROI. |
| 8:00–9:00 | Explain tenant boundary and limitations. | API queries carry tenantId; no GPS coordinates, no government licence lookup, fixed 94.5 on-time placeholder. |
| 9:00–10:00 | Conclude with deployment architecture and security. | One Render service, PostgreSQL, environment secrets; never expose `.env` or use development/test payment keys in production. |

### Protected-route/isolation demo

For an ethical local demo, log in with one role and try a forbidden API operation using the
browser's own developer tools or Swagger with that user's session. Show `401` when unauthenticated
and `403` for an authenticated role without permission. For tenant isolation, create two local test
organizations and show that a user cannot fetch the other tenant's record by changing an ID. Do not
test against a third-party system or production customer data.

## 14. Viva questions and beginner-friendly answers

### Product and architecture

1. **What problem does TransitOps solve?**
   It centralizes fleet assets, drivers, dispatch, maintenance, expenses, compliance, and reporting
   so each organization works from consistent operational records.

2. **Why is this a web application?**
   Multiple roles can access the same organization workspace from a browser without separate
   desktop installations; the backend remains the central authority.

3. **What does SaaS mean here?**
   Organizations use a hosted service and subscription flow instead of installing and maintaining
   their own application server.

4. **Why React?**
   Its component model lets dashboards, forms, and modals be composed and updated independently.

5. **Why TypeScript?**
   It catches many incorrect property names and data-shape mistakes before runtime and documents
   the expected domain objects.

6. **Why Express?**
   It is a small Node.js framework for routing HTTP requests and composing middleware.

7. **Why PostgreSQL?**
   The data is relational and benefits from durable records, indexing, transactional writes, and
   a mature managed-hosting ecosystem.

8. **Why Prisma?**
   It generates a typed client from a schema, makes common queries readable, and provides a
   consistent way to connect TypeScript code to PostgreSQL.

9. **Is this Clean Architecture?**
   No. It is feature-module based. Shared services and middleware are separated, but route handlers
   still contain request-level business logic and Prisma calls. That is a deliberate simplicity
   tradeoff at this project size, not a claim of strict Clean Architecture.

10. **Should controllers be separated from routes?**
    Routes define HTTP paths; controllers handle request/response; services hold reusable business
    rules. The current modules combine the first two because they are feature-local. Extracting a
    controller is useful when handlers become long, reused, or difficult to test; adding wrappers to
    every small endpoint today would add indirection without value.

11. **How does a trip request travel through the system?**
    React calls the API service; Express middleware authenticates and authorizes; the route checks
    tenant and business rules; Prisma writes PostgreSQL; the route responds and emits a Socket.IO
    event; React updates state.

12. **Where does production serve the frontend?**
    Express serves the Vite build from `dist` and mounts API routes on the same origin.

### Authentication, authorization, and data safety

13. **What is authentication?**
    Checking identity. The login endpoint verifies the password hash and issues a JWT.

14. **What is authorization?**
    Checking permission after identity is known. `requireRole` enforces roles on the API.

15. **What is a JWT?**
    A signed token containing claims. The server verifies its signature and expiry; the payload is
    not encrypted and must not contain secrets.

16. **Where is the JWT stored?**
    In an HttpOnly cookie named `transitops_jwt`; the API can also accept a bearer token.

17. **Why hash passwords?**
    If a database copy is exposed, a salted one-way hash does not directly reveal users' passwords.
    TransitOps uses bcryptjs and never needs to decrypt the stored hash.

18. **How are organizations isolated?**
    A verified JWT carries tenantId; every protected resource query is filtered by that tenant, and
    realtime events are emitted to tenant rooms.

19. **Is hiding a button enough for security?**
    No. UI visibility is not an authorization boundary. The server verifies role and tenant on each
    protected operation.

20. **Can one driver see all trips?**
    No. The backend resolves the user's linked Driver record and filters trip reads/completion/PDF
    access to that driver ID.

21. **What is a 401 vs a 403?**
    `401` means no valid authentication; `403` means authenticated but not allowed for that action.

22. **Are all relationships database foreign keys?**
    No. Many cross-model references are scalar IDs, so API validation and tenant-scoped queries
    must check linked records. This is a known area for future schema hardening.

### Operations, metrics, and compliance

23. **What is a Draft trip?**
    A planned trip awaiting dispatch. It is visible to the assigned driver as awaiting dispatch.

24. **What changes on dispatch?**
    Trip becomes Dispatched; associated vehicle and driver become On Trip; a realtime update is sent.

25. **What prevents an unavailable vehicle from being dispatched?**
    Server-side checks require an available vehicle, eligible driver, valid licence, and valid trip
    state. The browser filter alone is not trusted.

26. **Why record final odometer and fuel?**
    To preserve completion readings and support operational cost/safety analysis.

27. **How does maintenance affect dispatch?**
    An active maintenance action puts a vehicle In Shop, removing it from dispatch eligibility.

28. **How is ROI calculated?**
    `(revenue − maintenance − fuel) / acquisition cost × 100`; zero when no revenue has yet been
    earned or acquisition cost is zero. Dashboard and fleet ROI PDF share the same helper.

29. **What is fleet utilization?**
    On-trip vehicles divided by non-retired vehicles, multiplied by 100.

30. **How is the safety score calculated?**
    It starts at 100 and applies incident, licence, fuel-discipline, and experience factors, then
    clamps to 0–100. The factors are heuristics defined by the project.

31. **What happens when a licence expires?**
    The driver is suspended and receives the expiry score penalty. The background job checks hourly
    and at startup; driver list reads also refresh status and score.

32. **Does the application validate a licence with Sarathi?**
    No. It checks Indian-format plausibility and date consistency only. There is no live Sarathi or
    VAHAN API integration.

33. **Does the route radar show live GPS?**
    No. It displays saved trip route data; there are no persisted live latitude/longitude coordinates.

34. **Is the on-time rate calculated from real trip timestamps?**
    Not yet. The KPI currently has a fixed 94.5 placeholder; the schema lacks a promised departure
    time needed for a real calculation.

### Database and implementation

35. **Why does every business record have tenantId?**
    To associate it with an organization and make tenant-scoped queries explicit.

36. **Why store snapshot names/registration on trips?**
    To retain readable historical trip information if a vehicle or driver display name changes.

37. **Why are monetary values floats?**
    The current academic implementation uses Float fields for operational amounts. A production
    accounting system should prefer integer minor units or fixed-precision Decimal and apply
    currency/rounding policies consistently.

38. **What is an index?**
    A database structure that speeds selected lookups. Tenant indexes support common organization
    filters but add write/storage overhead.

39. **What does Prisma schema do?**
    It declares models, columns, defaults, and indexes used to generate the typed client and manage
    schema pushes.

40. **What is a transaction?**
    A group of database changes that succeed or fail together. Account/profile creation uses a
    transaction to avoid creating only half of a driver account.

41. **Why does User.email have global uniqueness?**
    Email is a global login identity in this schema. Vehicle/licence duplicate checks are tenant
    scoped; another tenant cannot use the same login email.

42. **What is the difference between `amount` and `cost` on Expense?**
    They are compatibility fields that currently duplicate the same value in the create route.
    A cleanup migration could consolidate them after checking legacy data.

### Packages, deployment, and testing

43. **Why use node-cron?**
    It schedules the recurring compliance routine inside Node; it is simple for a single-instance
    academic deployment but is not a durable distributed queue.

44. **Why use Nodemailer?**
    It provides a standard Node SMTP transport for setup, receipt, and reminder messages.

45. **Why PDFKit?**
    It creates downloadable PDF receipts and operational/financial reports on the server.

46. **Why Socket.IO?**
    It provides a persistent realtime connection and event delivery to connected clients.

47. **Why use an HttpOnly cookie instead of localStorage for JWT?**
    JavaScript cannot directly read an HttpOnly cookie, reducing token theft through ordinary
    script access; cookie security flags and CSRF controls still matter in production.

48. **What is CORS?**
    Browser policy controlling whether a page on one origin may call another. Configure allowed
    origins deliberately in production.

49. **What should be secret in Render?**
    Database URL, JWT secret, SMTP credentials, Razorpay keys, and any API secret. Configure them as
    environment variables, never commit them.

50. **What does `/api/health` test?**
    It runs a simple database query and reports healthy/unavailable; it is a connectivity check,
    not a full end-to-end business test.

51. **What does `npm run lint` do here?**
    It runs TypeScript type-checking (`tsc --noEmit`), not necessarily ESLint.

52. **What does `npm run build` do?**
    It builds the frontend bundle with Vite. It does not prove that the configured production
    database, SMTP, or payment provider is reachable.

53. **Why not run `prisma db push` against production during a demo?**
    It changes the schema. Review the migration/schema impact, back up important data, and use the
    approved deployment procedure.

54. **What is the biggest current production scaling concern?**
    The cron job runs inside the web process and may run on every instance; use a single worker or
    distributed scheduler/lock before horizontal scaling.

55. **What is one important future improvement?**
    Add strict server-side Zod schemas for every operational form, relational foreign keys and
    composite tenant constraints, monetary Decimal/minor units, tests, and a durable job queue.

## 15. A short answer if you forget everything

> “TransitOps is a multi-tenant React and Node.js application for fleet operations. React provides
> role-specific screens; Express authenticates JWTs, checks roles and tenant ownership, and accesses
> PostgreSQL through Prisma. It manages vehicles, drivers, trips, maintenance, expenses, and
> compliance. Socket.IO updates connected same-organization screens, node-cron checks licence
> expiry, Nodemailer sends mail, and PDFKit generates reports. The Indian licence/registration
> rules are format checks only, not a live government verification.”
