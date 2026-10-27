# TransitOps Validation Record

This record lists checks actually run for the current source changes. It is not a claim that the
live database, SMTP provider, Razorpay account, or Render deployment was exercised.

| Check | Result | Notes |
|---|---|---|
| `npm run lint` | Pass | TypeScript check (`tsc --noEmit`). |
| `npm run build` | Pass | Vite production bundle built. Vite reports the main JavaScript chunk is above 500 kB. |
| `npm run db:validate` | Pass | Prisma schema validates using the configured Prisma CLI config. |
| Shared ROI smoke cases | Pass | Verify zero revenue gives 0% and positive revenue applies revenue less maintenance/fuel over capital. |
| `git diff --check` | Pass | No whitespace errors in changed tracked files. |

No Prisma schema changes were made in this task, and no database push or destructive database
operation was run. SMTP, Razorpay, and Render behavior require credentials/environment and were not
validated here.

## Recommended manual regression checks

1. Sign in as a first-time user for each role; confirm the role-specific guide appears once and
   dismissal remains account-specific.
2. As Fleet Manager, add a vehicle before creating a trip; confirm the guide remains available.
   Create a first trip, then open the dashboard and verify the onboarding flow can be dismissed.
3. Place a vehicle with no completed/revenue-producing trip into maintenance; confirm both dashboard
   and fleet ROI PDF show 0%.
4. Create a vehicle with completed revenue and recorded maintenance/fuel costs; compare dashboard
   and PDF per-vehicle ROI.
5. Test an expired driver's list retrieval; verify status becomes Suspended and the score includes
   the expired-licence penalty. Test reminders using a controlled SMTP inbox.
6. Attempt a vehicle mutation as a non-Fleet Manager and a maintenance mutation as a non-Fleet
   Manager; verify the API rejects the request.
7. Attempt to create an overweight trip or complete with a lower odometer; verify the API returns
   a clear validation error.
8. Use two same-tenant browser sessions for the realtime trip workflow, then verify records from a
   separate test tenant remain inaccessible.
