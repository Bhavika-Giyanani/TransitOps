import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { pdfService } from '../../services/pdf';
import { kpiService } from '../../services/kpi';
import { stringify } from 'csv-stringify';
import { requireAuth } from '../../middleware/auth';

export const reportsRouter = Router();

reportsRouter.get('/export/pdf/payment-receipt', async (req: Request, res: Response) => {
  const purchaseSecret = typeof req.query.token === 'string' ? req.query.token : '';
  if (!purchaseSecret) return res.status(400).json({ detail: 'A valid purchase receipt token is required.' });

  const session = await prisma.purchaseSession.findFirst({
    where: { purchaseSecret, paymentVerified: true },
  });
  if (!session || !session.emailVerified || !session.planId || !session.orderId || !session.paymentId) {
    return res.status(404).json({ detail: 'Verified subscription receipt not found.' });
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: session.planId } });
  if (!plan) return res.status(404).json({ detail: 'Subscription plan for this receipt no longer exists.' });

  const receiptData = {
    organizationName: session.organizationName,
    fullName: session.fullName,
    email: session.email,
    planName: plan.name,
    termMonths: plan.termMonths,
    amountPaise: plan.amountPaise,
    orderId: session.orderId,
    paymentId: session.paymentId,
    date: new Date(session.createdAt).toLocaleDateString('en-IN'),
  };

  const buffer = await pdfService.createPaymentReceiptBuffer(receiptData);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="transitops-tax-invoice-${receiptData.paymentId}.pdf"`
  );
  return res.send(buffer);
});

reportsRouter.use(requireAuth);

reportsRouter.get('/export/pdf/ledger', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const expenses = await prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
  const maintenance = await prisma.maintenanceRecord.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
  const kpis = await kpiService.getFinancialKpis(tenantId);

  pdfService.generateLedgerPdf(res, expenses, maintenance, kpis);
});

reportsRouter.get('/export/pdf/fleet-roi', async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: req.user!.tenantId },
    orderBy: { acquisitionCost: 'desc' },
  });
  pdfService.generateFleetRoiPdf(res, vehicles);
});

reportsRouter.get('/export/pdf/trip/:id', async (req: Request, res: Response) => {
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId },
  });
  if (!trip) return res.status(404).json({ detail: 'Trip not found' });
  pdfService.generateTripReceiptPdf(res, trip);
});

reportsRouter.get('/export/csv/ledger', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const expenses = await prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
  const maintenance = await prisma.maintenanceRecord.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });

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

reportsRouter.get('/export/csv/fleet-roi', async (req: Request, res: Response) => {
  const vehicles = await prisma.vehicle.findMany({ where: { tenantId: req.user!.tenantId } });

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
