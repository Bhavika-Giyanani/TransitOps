import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { calculateDriverSafetyScore } from '../../services/safetyScore';
import { realtimeEmitter } from '../../realtime';
import { requireAuth } from '../../middleware/auth';

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

tripsRouter.get('/', async (req: Request, res: Response) => {
  const trips = await prisma.trip.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(trips);
});

tripsRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const tenantId = req.user!.tenantId;
  const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
  const driver = await prisma.driver.findFirst({ where: { id: data.driverId, tenantId } });
  if (!vehicle) return res.status(404).json({ detail: 'Select a vehicle in your organization.' });
  if (!driver) return res.status(404).json({ detail: 'Select a driver in your organization.' });

  const newTrip = await prisma.trip.create({
    data: {
      tenantId,
      tripCode: `TRIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      source: data.source,
      destination: data.destination,
      vehicleId: data.vehicleId,
      vehicleRegNumber: vehicle.registrationNumber,
      vehicleName: vehicle.name,
      driverId: data.driverId,
      driverName: driver.name,
      cargoWeightKg: Number(data.cargoWeightKg) || 1000,
      plannedDistanceKm: Number(data.plannedDistanceKm) || 250,
      revenue: Number(data.revenue) || 25000,
      status: 'Draft',
    },
  });

  return res.status(201).json(newTrip);
});

tripsRouter.post('/:id/dispatch', async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });

  if (vehicle && vehicle.status === 'In Shop') {
    return res.status(400).json({ detail: 'Vehicle is currently In Shop for maintenance and cannot be dispatched.' });
  }
  if (driver && driver.status === 'Suspended') {
    return res.status(400).json({ detail: 'Driver is currently Suspended and cannot be dispatched.' });
  }

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: {
      status: 'Dispatched',
      dispatchedAt: new Date(),
    },
  });

  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'On Trip', tenantId);
  }

  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.driverStatus(driver.id, 'On Trip', tenantId);
  }

  realtimeEmitter.tripDispatched(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Dispatched',
    message: `${updatedTrip.tripCode}: ${updatedTrip.source} -> ${updatedTrip.destination} is now in transit.`,
    tenantId,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/complete', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { finalOdometerKm, fuelConsumedLiters } = req.body;

  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const finalOdo = Number(finalOdometerKm) || trip.plannedDistanceKm + 100000;
  const fuel = Number(fuelConsumedLiters) || Math.round(trip.plannedDistanceKm / 6);

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: {
      status: 'Completed',
      completedAt: new Date(),
      finalOdometerKm: finalOdo,
      fuelConsumedLiters: fuel,
    },
  });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: {
        status: 'Available',
        currentOdometerKm: finalOdo,
        revenueGenerated: { increment: trip.revenue || 0 },
      },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available', tenantId);
  }

  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });
  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: {
        status: 'Available',
        tripsCount: { increment: 1 },
        totalTripsCompleted: { increment: 1 },
      },
    });
    await calculateDriverSafetyScore(tenantId, driver.id);
    realtimeEmitter.driverStatus(driver.id, 'Available', tenantId);
  }

  realtimeEmitter.tripCompleted(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Completed',
    message: `${updatedTrip.tripCode} completed successfully. Fuel and odometer readings logged.`,
    tenantId,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const trip = await prisma.trip.findFirst({ where: { id, tenantId } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const updatedTrip = await prisma.trip.update({
    where: { id, tenantId },
    data: { status: 'Cancelled' },
  });

  const vehicle = await prisma.vehicle.findFirst({ where: { id: trip.vehicleId, tenantId } });
  if (vehicle && vehicle.status === 'On Trip') {
    await prisma.vehicle.update({
      where: { id: vehicle.id, tenantId },
      data: { status: 'Available' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available', tenantId);
  }

  const driver = await prisma.driver.findFirst({ where: { id: trip.driverId, tenantId } });
  if (driver && driver.status === 'On Trip') {
    await prisma.driver.update({
      where: { id: driver.id, tenantId },
      data: { status: 'Available' },
    });
    realtimeEmitter.driverStatus(driver.id, 'Available', tenantId);
  }

  return res.json(updatedTrip);
});
