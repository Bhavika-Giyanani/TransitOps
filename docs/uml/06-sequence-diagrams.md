# 6. Current Sequence Diagrams

These diagrams follow the current React, Express, JWT, Prisma, Socket.IO, Nodemailer, PDFKit, and
node-cron implementation.

## 6.1 Login and authenticated request

```mermaid
sequenceDiagram
  actor User
  participant UI as React UI
  participant API as Express API
  participant Auth as Auth middleware
  participant DB as PostgreSQL via Prisma
  User->>UI: Enter email and password
  UI->>API: POST /api/auth/login
  API->>DB: Find user by email
  DB-->>API: User + passwordHash + role + tenantId
  API->>API: bcrypt compare, sign JWT
  API-->>UI: HttpOnly transitops_jwt cookie + profile
  User->>UI: Open protected screen
  UI->>API: Request with cookie
  API->>Auth: Verify JWT
  Auth->>Auth: requireRole check when route requires it
  API->>DB: Query scoped by authenticated tenantId
  DB-->>UI: Tenant-authorized result
```

## 6.2 Draft, dispatch, and driver completion

```mermaid
sequenceDiagram
  actor FM as Fleet Manager
  actor Driver
  participant UI as React clients
  participant API as Express trip routes
  participant DB as PostgreSQL via Prisma
  participant Socket as Socket.IO
  FM->>UI: Create trip draft
  UI->>API: POST /api/trips
  API->>API: Authenticate, check Fleet Manager
  API->>DB: Validate tenant vehicle/driver and save Draft
  DB-->>API: Draft trip
  API-->>UI: 201 trip response
  FM->>UI: Dispatch trip
  UI->>API: POST /api/trips/{id}/dispatch
  API->>DB: Recheck trip, vehicle, driver and licence
  API->>DB: Update trip/vehicle/driver states
  API->>Socket: Emit tenant-scoped status/event
  Socket-->>UI: Update connected same-tenant clients
  Driver->>UI: Complete assigned trip
  UI->>API: POST completion action
  API->>DB: Check linked driver owns dispatched trip; save readings
  API-->>UI: Updated trip
```

## 6.3 Subscription and account setup

```mermaid
sequenceDiagram
  actor Admin
  participant UI as React onboarding
  participant API as Express onboarding routes
  participant DB as PostgreSQL via Prisma
  participant Mail as Nodemailer SMTP
  participant Pay as Razorpay
  Admin->>UI: Organization, name, email, plan
  UI->>API: Begin and request verification
  API->>DB: Create PurchaseSession
  API->>Mail: Send verification code
  Admin->>UI: Submit email code
  UI->>API: Verify code
  API->>DB: Mark email verified
  UI->>API: Create payment order
  API->>Pay: Create order
  Pay-->>API: Order id
  Admin->>Pay: Complete checkout
  Pay-->>UI: Payment details/signature
  UI->>API: Verify payment signature
  API->>DB: Mark payment verified
  API->>Mail: Send receipt and one-time setup link
  Admin->>UI: Set initial password
  UI->>API: Complete account setup
  API->>DB: Create organization admin with password hash
```

## 6.4 Licence compliance job

```mermaid
sequenceDiagram
  participant Cron as node-cron / server startup
  participant Job as Driver compliance function
  participant DB as PostgreSQL via Prisma
  participant Score as Safety score service
  participant Mail as Nodemailer SMTP
  Cron->>Job: Startup run and hourly Asia/Kolkata run
  Job->>DB: Load driver compliance records
  loop Each driver
    Job->>DB: Suspend when licence expired
    Job->>Score: Recalculate score
    Score->>DB: Read recent completed trips/vehicle ratings
    Score->>DB: Persist changed score
    opt Licence expires within 30 days and reminder not sent for bucket
      Job->>DB: Claim reminder key
      Job->>Mail: Send renewal reminder
      Mail-->>Job: Success or error
    end
  end
```
