import PDFDocument from 'pdfkit';
import { Response } from 'express';

export const pdfService = {
  generateLedgerPdf: (
    res: Response,
    expenses: any[],
    maintenance: any[],
    kpis: { grossRevenue: number; totalOpex: number; netProfit: number }
  ) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops-financial-ledger.pdf"');
    doc.pipe(res);

    // Header
    doc.fontSize(22).fillColor('#0f172a').text('TransitOps Financial Ledger', { align: 'left' });
    doc.fontSize(10).fillColor('#64748b').text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'left' });
    doc.moveDown(1.5);

    // Summary Box
    doc.rect(40, doc.y, 515, 65).fill('#f8fafc');
    doc.fillColor('#0f172a');
    doc.fontSize(11).text('FINANCIAL SUMMARY', 55, doc.y + 10, { underline: true });
    doc.fontSize(10).text(`Gross Revenue: INR ${kpis.grossRevenue.toLocaleString('en-IN')}`, 55, doc.y + 5);
    doc.text(`Total Operating Expenses: INR ${kpis.totalOpex.toLocaleString('en-IN')}`, 220, doc.y - 12);
    doc.text(`Net Operating Profit: INR ${kpis.netProfit.toLocaleString('en-IN')}`, 390, doc.y - 12);
    doc.moveDown(3);

    // Expense & Maintenance Records
    doc.fontSize(13).fillColor('#0f172a').text('Operational Line Items', 40, doc.y);
    doc.moveDown(0.5);

    const startY = doc.y;
    doc.fontSize(9).fillColor('#475569');
    doc.text('Date', 45, startY);
    doc.text('Category', 120, startY);
    doc.text('Vehicle', 210, startY);
    doc.text('Description', 300, startY);
    doc.text('Amount (INR)', 480, startY, { align: 'right' });
    doc.moveTo(40, startY + 15).lineTo(555, startY + 15).strokeColor('#cbd5e1').stroke();

    let curY = startY + 22;

    const items = [
      ...expenses.map((e) => ({
        date: String(e.date || e.expenseDate).substring(0, 10),
        category: e.type || 'Expense',
        vehicle: e.vehicleRegNumber || 'Fleet General',
        description: (e.description || e.notes || '').substring(0, 30),
        amount: e.amount || e.cost || 0,
      })),
      ...maintenance.map((m) => ({
        date: String(m.date).substring(0, 10),
        category: 'Maintenance',
        vehicle: m.vehicleRegNumber || 'In Shop',
        description: (m.description || '').substring(0, 30),
        amount: m.cost || 0,
      })),
    ].slice(0, 25); // Top 25 records on page 1

    for (const item of items) {
      if (curY > 750) {
        doc.addPage();
        curY = 50;
      }
      doc.fillColor('#1e293b').fontSize(8.5);
      doc.text(item.date, 45, curY);
      doc.text(item.category, 120, curY);
      doc.text(item.vehicle, 210, curY);
      doc.text(item.description, 300, curY);
      doc.text(`INR ${item.amount.toLocaleString('en-IN')}`, 450, curY, { align: 'right', width: 100 });
      curY += 18;
    }

    doc.end();
  },

  generateFleetRoiPdf: (res: Response, vehicles: any[]) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops-fleet-roi.pdf"');
    doc.pipe(res);

    doc.fontSize(22).fillColor('#0f172a').text('TransitOps Fleet Asset ROI Report');
    doc.fontSize(10).fillColor('#64748b').text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    const startY = doc.y;
    doc.fontSize(9).fillColor('#475569');
    doc.text('Reg Number', 45, startY);
    doc.text('Vehicle Asset', 135, startY);
    doc.text('Status', 255, startY);
    doc.text('Acq. Cost', 340, startY, { align: 'right', width: 75 });
    doc.text('Revenue', 425, startY, { align: 'right', width: 75 });
    doc.text('ROI (%)', 505, startY, { align: 'right', width: 45 });
    doc.moveTo(40, startY + 15).lineTo(555, startY + 15).strokeColor('#cbd5e1').stroke();

    let curY = startY + 22;
    for (const v of vehicles) {
      const acq = v.acquisitionCost || 1;
      const rev = v.revenueGenerated || 0;
      const roi = Math.round((rev / acq) * 100);

      doc.fillColor('#1e293b').fontSize(8.5);
      doc.text(v.registrationNumber, 45, curY);
      doc.text(v.name, 135, curY);
      doc.text(v.status, 255, curY);
      doc.text(`INR ${Number(v.acquisitionCost || 0).toLocaleString('en-IN')}`, 320, curY, { align: 'right', width: 95 });
      doc.text(`INR ${Number(rev).toLocaleString('en-IN')}`, 410, curY, { align: 'right', width: 90 });
      doc.text(`${roi}%`, 505, curY, { align: 'right', width: 45 });
      curY += 20;
    }

    doc.end();
  },

  generateTripReceiptPdf: (res: Response, trip: any) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="trip-receipt-${trip.tripCode || trip.id}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor('#0f172a').text('TransitOps Official Trip Receipt');
    doc.fontSize(11).fillColor('#64748b').text(`Receipt ID: ${trip.tripCode || trip.id}`);
    doc.moveDown(1.5);

    doc.rect(40, doc.y, 515, 180).fill('#f8fafc');
    let y = doc.y + 15;
    doc.fillColor('#0f172a').fontSize(11);
    doc.text(`Origin: ${trip.source}`, 60, y);
    doc.text(`Destination: ${trip.destination}`, 300, y);
    y += 24;
    doc.text(`Vehicle: ${trip.vehicleName} (${trip.vehicleRegNumber})`, 60, y);
    doc.text(`Driver: ${trip.driverName}`, 300, y);
    y += 24;
    doc.text(`Planned Distance: ${trip.plannedDistanceKm} km`, 60, y);
    doc.text(`Cargo Weight: ${trip.cargoWeightKg} kg`, 300, y);
    y += 24;
    doc.text(`Dispatched At: ${trip.dispatchedAt ? new Date(trip.dispatchedAt).toLocaleString('en-IN') : 'N/A'}`, 60, y);
    doc.text(`Completed At: ${trip.completedAt ? new Date(trip.completedAt).toLocaleString('en-IN') : 'In Transit'}`, 300, y);
    y += 24;
    doc.text(`Status: ${trip.status}`, 60, y);
    doc.text(`Total Billed Revenue: INR ${(trip.revenue || 0).toLocaleString('en-IN')}`, 300, y, { bold: true } as any);

    doc.moveDown(4);
    doc.fontSize(9).fillColor('#94a3b8').text('This is a computer-generated dispatch receipt valid under Indian GST freight carriage regulations.', 40, doc.y, { align: 'center' });
    doc.end();
  },
};
