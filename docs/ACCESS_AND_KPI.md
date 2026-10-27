# TransitOps Access Model and KPI Definitions

The backend is authoritative for permissions. React may hide controls for a role, but every
protected operation must still pass `requireAuth`, `requireRole`, and tenant-scoped database
filters in the API.

## Role and access summary

| Resource/action | Organization Admin | Fleet Manager | Driver | Safety Officer | Financial Analyst |
|---|---|---|---|---|---|
| Manage organization staff accounts | Create/read/update/delete operational users | — | — | — | — |
| Read vehicles | — | Tenant | Tenant | Tenant | Tenant |
| Create/update/retire vehicles | — | Yes | — | — | — |
| Read drivers/compliance | — | Tenant | Own profile/trips only | Tenant | — |
| Create/update/suspend/remind drivers | — | Yes | — | Update/compliance actions | — |
| Record incident/read score details | — | Yes | — | Yes | — |
| Read trips | — | Tenant | Assigned trips only | — | Tenant |
| Create/dispatch/cancel trips | — | Yes | — | — | — |
| Complete trips | — | Yes | Assigned dispatched trip | — | — |
| Read maintenance | — | Tenant | — | Tenant | Tenant |
| Create/close maintenance | — | Yes | — | — | — |
| Read/create/delete expenses | — | Yes | — | — | Yes |
| Financial reports/ROI/ledger | — | Yes | Own trip receipt | — | Yes |
| Fleet/safety/financial dashboard | — | Fleet | Driver | Safety | Financial |

Exact endpoint policies can differ from the simplified screen matrix; inspect the `requireRole`
calls in the corresponding router when implementing a permission change. Organization Admins
cannot create or promote another Organization Admin through the current staff API.

## Tenant and data boundaries

- Protected API requests identify the user via JWT and use the JWT `tenantId` for Prisma reads and writes.
- User email is globally unique. Vehicle registration and licence duplicate checks are organization-scoped.
- Driver trip list, completion, and receipt operations require the linked driver profile and assigned trip.
- Realtime messages include tenant ownership and are emitted to the matching tenant room.
- Many model associations are scalar IDs without Prisma relations/foreign keys; API tenant checks are essential.
- A UI route or hidden button is not an authorization boundary.

## Fleet KPIs

| KPI | Definition |
|---|---|
| Total vehicles | Count with status other than `Retired`. |
| Active vehicles | Count with status `On Trip`. |
| Available vehicles | Count with status `Available`. |
| Maintenance holds | Count with status `In Shop`. |
| Active dispatches | Count trips with status `Dispatched`. |
| Pending departures | Count trips with status `Draft`. |
| Drivers on duty | Count drivers with status `On Duty`. |
| Utilization | `On Trip vehicles / non-retired vehicles × 100`, rounded to one decimal; zero if denominator is zero. |

## Financial KPIs and ROI

| KPI | Definition |
|---|---|
| Fuel spend | Sum expense `amount` where `type = Fuel`. |
| Maintenance spend | Sum `MaintenanceRecord.cost`. |
| Other expenses | Sum expense `amount` where `type != Fuel`. |
| Total OPEX | Maintenance + fuel + other expense. |
| Gross revenue | Sum trip revenue for `Completed` trips. |
| Net profit | Gross revenue − total OPEX. |
| Net margin | `net profit / gross revenue × 100`; zero if revenue is zero. |
| Cost per km | OPEX divided by completed trips' planned distance; zero if distance is zero. |
| Vehicle ROI | `(vehicle revenue − maintenance − fuel) / acquisition cost × 100`, rounded to integer. Zero if revenue or acquisition cost is zero. Dashboard and fleet ROI PDF use `shared/vehicleRoi.ts`. |

Vehicle revenue is operationally recognized when trips complete. A newly registered asset with
no completed/revenue-producing work therefore shows 0% ROI even if it has start-up maintenance cost;
this avoids presenting an unrealized return as a negative operating ROI.

## Driver safety score

Start at 100; add/subtract:

- Incidents: −8 each, maximum −40.
- Expired licence: −25; expires within 30 days: −5.
- Fuel discipline: up to 10 latest completed trips with positive distance and fuel. Fewer than 3
  qualifying trips means no penalty. Compare actual km/L to 85% of the vehicle rated efficiency;
  apply a proportional penalty up to −15.
- Experience: +1 per 25 completed trips, capped at +5.

Clamp to 0–100. Bands: 90+ Excellent; 75–89 Good; 60–74 Needs attention; under 60 High risk.
This project-defined score is not a certified government or insurance metric.

The `onTimeDepartureRate` driver KPI is currently a fixed `94.5` placeholder. A genuine rate needs
planned departure timestamps and actual departure data, which the current schema does not hold.
