import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { pdfService } from '../services/pdf';
import { kpiService } from '../services/kpi';
import { stringify } from 'csv-stringify';

export const reportsRouter = Router();

reportsRouter.get('/export/pdf/ledger', async (_req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
  const maintenance = await prisma.maintenanceRecord.findMany({ orderBy: { date: 'desc' } });
  const kpis = await kpiService.getFinancialKpis();

  pdfService.generateLedgerPdf(res, expenses, maintenance, kpis);
});

reportsRouter.get('/export/pdf/fleet-roi', async (_req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { acquisitionCost: 'desc' } });
  pdfService.generateFleetRoiPdf(res, vehicles);
});

reportsRouter.get('/export/pdf/trip/:id', async (req: Request, res: Response) => {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!trip) {
    return res.status(404).json({ detail: 'Trip not found' });
  }
  pdfService.generateTripReceiptPdf(res, trip);
});

reportsRouter.get('/export/csv/ledger', async (_req: Request, res: Response) => {
  const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
  const maintenance = await prisma.maintenanceRecord.findMany({ orderBy: { date: 'desc' } });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transitops-financial-ledger.csv"');

  const rows = [
    ['Date', 'Type', 'Vehicle', 'Description', 'Amount INR'],
    ...expenses.map((e) => [
      e.date,
      e.type,
      e.vehicleRegNumber || '',
      e.description || '',
      e.amount,
    ]),
    ...maintenance.map((m) => [
      m.date,
      'Maintenance',
      m.vehicleRegNumber,
      m.description,
      m.cost,
    ]),
  ];

  stringify(rows, (err, output) => {
    if (err) return res.status(500).send('Error generating CSV');
    return res.send(output);
  });
});

reportsRouter.get('/export/csv/fleet-roi', async (_req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany();

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="transitops-fleet-roi.csv"');

  const rows = [
    ['Registration', 'Name', 'Type', 'Acquisition Cost INR', 'Revenue INR', 'Status'],
    ...vehicles.map((v) => [
      v.registrationNumber,
      v.name,
      v.type,
      v.acquisitionCost || 0,
      v.revenueGenerated || 0,
      v.status,
    ]),
  ];

  stringify(rows, (err, output) => {
    if (err) return res.status(500).send('Error generating CSV');
    return res.send(output);
  });
});
