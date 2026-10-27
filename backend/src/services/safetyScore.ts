import { prisma } from '../db';
import { getIndianDateString } from '../utils/indianDate';

export async function calculateDriverSafetyScore(tenantId: string, driverId: string) {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, tenantId } });
  if (!driver) throw new Error('Driver not found');

  const factors: { factor: string; points: number; detail: string }[] = [];

  // 1. Incidents: -8 per incident, capped at -40
  const incidentPoints = -Math.min(Math.max(driver.incidentHistoryCount || 0, 0) * 8, 40);
  factors.push({
    factor: 'Incidents',
    points: incidentPoints,
    detail:
      driver.incidentHistoryCount === 0
        ? 'No recorded incidents'
        : `${driver.incidentHistoryCount} recorded incident(s) × −8, capped at −40`,
  });

  // 2. Licence validity: -25 if expired, -5 if expires within 30 days
  const expiryDate = Date.parse(`${driver.licenseExpiryDate}T00:00:00Z`);
  const today = Date.parse(`${getIndianDateString()}T00:00:00Z`);
  const diffDays = Math.ceil((expiryDate - today) / 86_400_000);
  let licencePoints = 0;
  let licenceDetail = 'Licence valid';
  if (diffDays < 0) {
    licencePoints = -25;
    licenceDetail = `Licence expired on ${driver.licenseExpiryDate}`;
  } else if (diffDays <= 30) {
    licencePoints = -5;
    licenceDetail = `Licence expires on ${driver.licenseExpiryDate} (within 30 days)`;
  }
  factors.push({ factor: 'Licence validity', points: licencePoints, detail: licenceDetail });

  // 3. Fuel discipline
  const recentTrips = await prisma.trip.findMany({
    where: {
      tenantId,
      driverId: driver.id,
      status: 'Completed',
    },
    take: 10,
    orderBy: { completedAt: 'desc' },
  });

  const evaluated = recentTrips.filter(
    (t) => t.plannedDistanceKm > 0 && (t.fuelConsumedLiters || 0) > 0
  );

  let fuelPoints = 0;
  let fuelDetail = '';
  if (evaluated.length < 3) {
    fuelDetail = `Not enough completed trips with fuel data (${evaluated.length}/3)`;
  } else {
    let inefficientCount = 0;
    for (const t of evaluated) {
      const v = await prisma.vehicle.findFirst({ where: { id: t.vehicleId, tenantId } });
      const ratedKmPerL = v?.fuelEfficiencyKmPerLiter || 8.0;
      const actualKmPerL = t.plannedDistanceKm / (t.fuelConsumedLiters || 1);
      if (actualKmPerL < ratedKmPerL * 0.85) {
        inefficientCount++;
      }
    }
    fuelPoints = -Math.round(15 * (inefficientCount / evaluated.length));
    fuelDetail = `${inefficientCount} of ${evaluated.length} trips below 85% of rated km/L`;
  }
  factors.push({ factor: 'Fuel discipline', points: fuelPoints, detail: fuelDetail });

  // 4. Experience bonus: +1 per 25 completed trips, max +5
  const completedTrips = driver.totalTripsCompleted || driver.tripsCount || 0;
  const experiencePoints = Math.min(Math.floor(completedTrips / 25), 5);
  factors.push({
    factor: 'Experience',
    points: experiencePoints,
    detail: `${completedTrips} completed trips (+1 per 25, max +5)`,
  });

  const sumPoints = factors.reduce((acc, f) => acc + f.points, 0);
  const score = Math.max(0, Math.min(100, 100 + sumPoints));
  let band = 'High risk';
  if (score >= 90) band = 'Excellent';
  else if (score >= 75) band = 'Good';
  else if (score >= 60) band = 'Needs attention';

  // Update in database if changed
  if (driver.safetyScore !== score) {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: { safetyScore: score },
    });
  }

  return { score, band, factors };
}
