# 3. Current Data Model

The diagram reflects the Prisma models in `backend/prisma/schema.prisma`. IDs that look like
associations are currently scalar fields; most are not declared Prisma relations or database
foreign keys. `tenantId` is the application-level organization boundary.

```mermaid
classDiagram
  class User {
    +String id PK
    +String tenantId
    +String email UNIQUE
    +String passwordHash
    +String fullName
    +String role
    +Boolean isDemoAccount
    +String? driverId
    +String? contactNumber
    +String? licenseNumber
    +String? licenseCategory
    +String? licenseExpiryDate
  }
  class Vehicle {
    +String id PK
    +String tenantId
    +String registrationNumber
    +String name
    +String model
    +String type
    +Float maxCapacityKg
    +Float currentOdometerKm
    +Float? acquisitionCost
    +String status
    +Float? revenueGenerated
  }
  class Driver {
    +String id PK
    +String tenantId
    +String name
    +String licenseNumber
    +String licenseCategory
    +String licenseExpiryDate
    +String contactNumber
    +Float safetyScore
    +String status
    +String? identityUserId
    +String? lastLicenseReminderKey
  }
  class Trip {
    +String id PK
    +String tenantId
    +String tripCode
    +String vehicleId
    +String driverId
    +Float cargoWeightKg
    +Float plannedDistanceKm
    +Float? revenue
    +String status
    +DateTime? dispatchedAt
    +DateTime? completedAt
    +Float? finalOdometerKm
    +Float? fuelConsumedLiters
  }
  class MaintenanceRecord {
    +String id PK
    +String tenantId
    +String vehicleId
    +String serviceType
    +Float cost
    +String status
    +DateTime? completedAt
  }
  class Expense {
    +String id PK
    +String tenantId
    +String vehicleId
    +String? tripId
    +String type
    +Float amount
    +Float? cost
  }
  class SubscriptionPlan {
    +String id PK
    +String name
    +Int amountPaise
    +String currency
    +Int termMonths
    +String features
  }
  class PurchaseSession {
    +String id PK
    +String purchaseSecret
    +String email
    +Boolean emailVerified
    +String? planId
    +Boolean paymentVerified
    +Boolean setupCompleted
  }

  User ..> Driver : driverId / identityUserId scalar link
  Driver ..> Trip : driverId scalar link
  Vehicle ..> Trip : vehicleId scalar link
  Vehicle ..> MaintenanceRecord : vehicleId scalar link
  Vehicle ..> Expense : vehicleId scalar link
  Trip ..> Expense : tripId scalar link
  SubscriptionPlan ..> PurchaseSession : planId scalar link
```

For field-by-field explanations, including timestamps and snapshot fields, see the database section
of [PROJECT_GUIDE.md](../PROJECT_GUIDE.md).
