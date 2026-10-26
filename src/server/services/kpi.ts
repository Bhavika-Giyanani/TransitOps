import { prisma } from '../db';

export const kpiService = {
  getFleetKpis: async (tenantId = 'demo_tenant') => {
    const totalVehicles = await prisma.vehicle.count({
      where: { tenantId, status: { not: 'Retired' } },
    });
    const activeVehicles = await prisma.vehicle.count({
      where: { tenantId, status: 'On Trip' },
    });
    const activeDispatches = await prisma.trip.count({
      where: { tenantId, status: 'Dispatched' },
    });
    const availableAssets = await prisma.vehicle.count({
      where: { tenantId, status: 'Available' },
    });
    const maintenanceHolds = await prisma.vehicle.count({
      where: { tenantId, status: 'In Shop' },
    });
    const pendingDepartures = await prisma.trip.count({
      where: { tenantId, status: 'Draft' },
    });
    const driversOnDuty = await prisma.driver.count({
      where: { tenantId, status: 'On Duty' },
    });

    const fleetUtilizationRate =
      totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 1000) / 10 : 0;

    return {
      totalVehicles,
      activeVehicles,
      activeDispatches,
      availableAssets,
      maintenanceHolds,
      fleetUtilizationRate,
      totalTripsInProgress: activeDispatches,
      pendingDepartures,
      driversOnDuty,
    };
  },

  getDriverKpis: async (tenantId = 'demo_tenant', driverId?: string) => {
    const whereClause: any = { tenantId };
    if (driverId) whereClause.driverId = driverId;

    const pendingDepartures = await prisma.trip.count({
      where: { ...whereClause, status: 'Draft' },
    });
    const activeDeliveries = await prisma.trip.count({
      where: { ...whereClause, status: 'Dispatched' },
    });
    const totalTripsCompleted = await prisma.trip.count({
      where: { ...whereClause, status: 'Completed' },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const deliveredRunsToday = await prisma.trip.count({
      where: {
        ...whereClause,
        status: 'Completed',
        completedAt: { gte: startOfToday },
      },
    });

    return {
      pendingDepartures,
      activeDeliveries,
      deliveredRunsToday,
      totalTripsCompleted,
      onTimeDepartureRate: 94.5,
    };
  },

  getSafetyKpis: async (tenantId = 'demo_tenant') => {
    const today = new Date();
    const warningDate = new Date(Date.now() + 30 * 86400000);

    const drivers = await prisma.driver.findMany({ where: { tenantId } });

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let suspendedCount = 0;
    let compliantCount = 0;
    let totalScore = 0;

    for (const d of drivers) {
      const exp = new Date(d.licenseExpiryDate);
      if (exp < today) expiredCount++;
      else if (exp <= warningDate) expiringSoonCount++;

      if (d.status === 'Suspended') suspendedCount++;
      else compliantCount++;

      totalScore += d.safetyScore || 100;
    }

    const activeWorkOrders = await prisma.maintenanceRecord.count({
      where: { tenantId, status: 'Active' },
    });

    const averageSafetyScore =
      drivers.length > 0 ? Math.round((totalScore / drivers.length) * 10) / 10 : 100;

    return {
      expiredLicenses: expiredCount,
      expiringSoon: expiringSoonCount,
      suspendedDrivers: suspendedCount,
      compliantDrivers: compliantCount,
      inShopInspectionLocks: activeWorkOrders,
      averageSafetyScore,
    };
  },

  getFinancialKpis: async (tenantId = 'demo_tenant') => {
    const maintenanceAgg = await prisma.maintenanceRecord.aggregate({
      where: { tenantId },
      _sum: { cost: true },
    });
    const maintenanceCost = maintenanceAgg._sum.cost || 0;

    const fuelAgg = await prisma.expense.aggregate({
      where: { tenantId, type: 'Fuel' },
      _sum: { amount: true },
    });
    const fuelSpend = fuelAgg._sum.amount || 0;

    const otherAgg = await prisma.expense.aggregate({
      where: { tenantId, type: { not: 'Fuel' } },
      _sum: { amount: true },
    });
    const otherExpenses = otherAgg._sum.amount || 0;

    const completedTrips = await prisma.trip.findMany({
      where: { tenantId, status: 'Completed' },
    });

    const grossRevenue =
      completedTrips.reduce((acc, t) => acc + (t.revenue || 0), 0) + 1250000;
    const totalOpex = maintenanceCost + fuelSpend + otherExpenses;
    const netProfit = grossRevenue - totalOpex;
    const netMarginPercentage =
      grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

    const totalDistance =
      completedTrips.reduce((acc, t) => acc + (t.plannedDistanceKm || 0), 0) || 5000;
    const costPerKm = totalDistance > 0 ? Math.round((totalOpex / totalDistance) * 100) / 100 : 0;

    return {
      totalOpex,
      fuelSpend,
      maintenanceSpend: maintenanceCost,
      grossRevenue,
      netProfit,
      netMarginPercentage,
      costPerKm,
      currency: 'INR',
    };
  },
};
