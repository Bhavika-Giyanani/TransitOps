# TransitOps Architecture

## Application components

```mermaid
flowchart LR
    Browser["Browser<br/>React 19 + TypeScript"]
    FE["frontend/src<br/>views, components, context,<br/>API client, UI types"]
    Host["backend/server.ts<br/>Express host"]
    API["backend/src/modules/<br/>auth, admin, vehicles, drivers,<br/>trips, expenses, reports, ..."]
    Middleware["backend/src/middleware<br/>JWT authentication and role checks"]
    Services["backend/src/services<br/>PDF, email, KPI, safety scoring"]
    Prisma["Prisma Client"]
    Schema["backend/prisma/schema.prisma"]
    DB[("PostgreSQL")]
    SMTP["SMTP provider"]
    Razorpay["Razorpay"]
    Socket["Socket.IO"]

    Browser --> FE
    FE -->|"HTTP /api, same origin"| Host
    FE <-->|"Authenticated realtime"| Socket
    Host --> API
    API --> Middleware
    API --> Services
    API --> Prisma
    Prisma --> Schema
    Prisma --> DB
    Services --> SMTP
    Services --> Razorpay
    Host --> Socket
```

## Feature module layout

Backend route handlers are grouped by domain under `backend/src/modules/<feature>/`. Shared
authentication middleware, database setup, realtime support, and services remain in common
locations. Prisma is the persistence model and its schema lives in `backend/prisma/`.

## Single-service deployment

The root npm manifest coordinates both folders. Vite builds the frontend into root `dist/`;
`backend/server.ts` serves that static bundle and the API from one Express process. Render's
`render.yaml` uses `npm run build` and `npm start`, with `/api/health` as its database-aware health
check.
