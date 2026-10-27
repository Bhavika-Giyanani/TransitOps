# 4. Entity-Relationship / Data Model

The diagram is based on the current Prisma models in `backend/prisma/schema.prisma`. Most links
below are scalar ID fields checked in application code, not declared Prisma relationships or
database foreign keys. Every operational model is filtered by `tenantId` in the API.

```mermaid
erDiagram
    USER {
        string id PK
        string tenantId
        string email UK
        string passwordHash
        string fullName
        string role
        string driverId
    }
    VEHICLE {
        string id PK
        string tenantId
        string registrationNumber
        string name
        string model
        float maxCapacityKg
        float currentOdometerKm
        float acquisitionCost
        string status
        float revenueGenerated
    }
    DRIVER {
        string id PK
        string tenantId
        string identityUserId
        string name
        string licenseNumber
        string licenseExpiryDate
        string contactNumber
        float safetyScore
        string status
    }
    TRIP {
        string id PK
        string tenantId
        string tripCode
        string vehicleId
        string driverId
        float cargoWeightKg
        float plannedDistanceKm
        float revenue
        string status
        float finalOdometerKm
        float fuelConsumedLiters
    }
    MAINTENANCE_RECORD {
        string id PK
        string tenantId
        string vehicleId
        string serviceType
        float cost
        string status
    }
    EXPENSE {
        string id PK
        string tenantId
        string vehicleId
        string tripId
        string type
        float amount
        float cost
    }
    SUBSCRIPTION_PLAN {
        string id PK
        string name
        int amountPaise
        string currency
        int termMonths
    }
    PURCHASE_SESSION {
        string id PK
        string purchaseSecret
        string email
        boolean emailVerified
        string planId
        string orderId
        string paymentId
        boolean paymentVerified
        boolean setupCompleted
    }
    USER ||--o| DRIVER : "scalar driverId / identityUserId"
    DRIVER ||--o{ TRIP : "scalar driverId"
    VEHICLE ||--o{ TRIP : "scalar vehicleId"
    VEHICLE ||--o{ MAINTENANCE_RECORD : "scalar vehicleId"
    VEHICLE ||--o{ EXPENSE : "scalar vehicleId"
    TRIP ||--o{ EXPENSE : "optional scalar tripId"
    SUBSCRIPTION_PLAN ||--o{ PURCHASE_SESSION : "optional scalar planId"
```

See [PROJECT_GUIDE.md](../PROJECT_GUIDE.md#9-database-schema-every-model-and-field) for the
purpose of every schema field and known schema limitations.
