import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { calculateDriverSafetyScore } from '../services/safetyScore';
import { realtimeEmitter } from '../realtime';

export const tripsRouter = Router();

tripsRouter.get('/', async (_req: Request, res: Response) => {
  const trips = await prisma.trip.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(trips);
});

tripsRouter.post('/', async (req: Request, res: Response) => {
  const data = req.body;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });

  const newTrip = await prisma.trip.create({
    data: {
      tenantId: 'demo_tenant',
      tripCode: `TRIP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      source: data.source,
      destination: data.destination,
      vehicleId: data.vehicleId,
      vehicleRegNumber: vehicle ? vehicle.registrationNumber : 'UNASSIGNED',
      vehicleName: vehicle ? vehicle.name : 'Unknown Asset',
      driverId: data.driverId,
      driverName: driver ? driver.name : 'Unknown Driver',
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
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: trip.vehicleId } });
  const driver = await prisma.driver.findUnique({ where: { id: trip.driverId } });

  if (vehicle && vehicle.status === 'In Shop') {
    return res.status(400).json({ detail: 'Vehicle is currently In Shop for maintenance and cannot be dispatched.' });
  }
  if (driver && driver.status === 'Suspended') {
    return res.status(400).json({ detail: 'Driver is currently Suspended and cannot be dispatched.' });
  }

  const updatedTrip = await prisma.trip.update({
    where: { id },
    data: {
      status: 'Dispatched',
      dispatchedAt: new Date(),
    },
  });

  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'On Trip');
  }

  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id },
      data: { status: 'On Trip' },
    });
    realtimeEmitter.driverStatus(driver.id, 'On Trip');
  }

  realtimeEmitter.tripDispatched(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Dispatched',
    message: `${updatedTrip.tripCode}: ${updatedTrip.source} -> ${updatedTrip.destination} is now in transit.`,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/complete', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { finalOdometerKm, fuelConsumedLiters } = req.body;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const finalOdo = Number(finalOdometerKm) || trip.plannedDistanceKm + 100000;
  const fuel = Number(fuelConsumedLiters) || Math.round(trip.plannedDistanceKm / 6);

  const updatedTrip = await prisma.trip.update({
    where: { id },
    data: {
      status: 'Completed',
      completedAt: new Date(),
      finalOdometerKm: finalOdo,
      fuelConsumedLiters: fuel,
    },
  });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: trip.vehicleId } });
  if (vehicle) {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        status: 'Available',
        currentOdometerKm: finalOdo,
        revenueGenerated: { increment: trip.revenue || 0 },
      },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available');
  }

  const driver = await prisma.driver.findUnique({ where: { id: trip.driverId } });
  if (driver) {
    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: 'Available',
        tripsCount: { increment: 1 },
        totalTripsCompleted: { increment: 1 },
      },
    });
    await calculateDriverSafetyScore(driver.id);
    realtimeEmitter.driverStatus(driver.id, 'Available');
  }

  realtimeEmitter.tripCompleted(updatedTrip);
  realtimeEmitter.notification({
    type: 'success',
    title: 'Trip Completed',
    message: `${updatedTrip.tripCode} completed successfully. Fuel and odometer readings logged.`,
  });

  return res.json(updatedTrip);
});

tripsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });

  const updatedTrip = await prisma.trip.update({
    where: { id },
    data: { status: 'Cancelled' },
  });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: trip.vehicleId } });
  if (vehicle && vehicle.status === 'On Trip') {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'Available' },
    });
    realtimeEmitter.vehicleStatus(vehicle.id, 'Available');
  }

  const driver = await prisma.driver.findUnique({ where: { id: trip.driverId } });
  if (driver && driver.status === 'On Trip') {
    await prisma.driver.update({
      where: { id: driver.id },
      data: { status: 'Available' },
    });
    realtimeEmitter.driverStatus(driver.id, 'Available');
  }

  return res.json(updatedTrip);
});
