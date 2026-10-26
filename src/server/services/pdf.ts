import PDFDocument from 'pdfkit';
import { Response } from 'express';

// Corporate Design Tokens
const COLORS = {
  navyDark: '#0b1329',
  navyCard: '#131e3a',
  brandAmber: '#d97706',
  brandEmerald: '#059669',
  slateDark: '#0f172a',
  slateText: '#334155',
  slateMuted: '#64748b',
  borderLight: '#e2e8f0',
  bgLight: '#f8fafc',
  bgZebra: '#f1f5f9',
  white: '#ffffff',
};

function drawHeaderBanner(
  doc: PDFKit.PDFDocument,
  title: string,
  docType: string,
  refCode: string
) {
  // Top Header Banner
  doc.rect(0, 0, 595.28, 85).fill(COLORS.navyDark);

  // Accent Line
  doc.rect(0, 85, 595.28, 4).fill(COLORS.brandAmber);

  // Brand Name & Tagline
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(20).text('TRANSITOPS', 40, 24);
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#94a3b8')
    .text(`FLEET OPERATIONS PLATFORM  •  ${docType}`, 40, 48);

  // Document Type & Reference on Right
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.white)
    .text(title.toUpperCase(), 300, 24, { align: 'right', width: 255 });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#94a3b8')
    .text(`REF: ${refCode}  |  DATE: ${new Date().toLocaleDateString('en-IN')}`, 300, 46, {
      align: 'right',
      width: 255,
    });

  doc.y = 105;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber = 1) {
  const pageBottom = 780;
  doc.rect(40, pageBottom, 515.28, 0.75).fill(COLORS.borderLight);

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.slateMuted)
    .text(
      'TransitOps Platform  •  Authorized Digital Dispatch & Accounting Document  •  Confidential',
      40,
      pageBottom + 8
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.slateMuted)
    .text(`Page ${pageNumber}`, 455, pageBottom + 8, { align: 'right', width: 100 });
}

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

    drawHeaderBanner(doc, 'Executive Financial Ledger', 'LEDGER', `TX-LED-${Date.now().toString().slice(-6)}`);

    // Executive KPI Summary Cards
    const kpiY = doc.y + 10;
    const cardWidth = 162;
    const cardHeight = 62;

    // Card 1: Gross Revenue
    doc.roundedRect(40, kpiY, cardWidth, cardHeight, 6).fillAndStroke(COLORS.bgLight, COLORS.borderLight);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.slateMuted).text('GROSS FREIGHT REVENUE', 52, kpiY + 12);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.brandEmerald)
      .text(`INR ${kpis.grossRevenue.toLocaleString('en-IN')}`, 52, kpiY + 28);

    // Card 2: Total Opex
    doc.roundedRect(216, kpiY, cardWidth, cardHeight, 6).fillAndStroke(COLORS.bgLight, COLORS.borderLight);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.slateMuted).text('TOTAL FLEET OPEX', 228, kpiY + 12);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#dc2626')
      .text(`INR ${kpis.totalOpex.toLocaleString('en-IN')}`, 228, kpiY + 28);

    // Card 3: Net Operating Margin
    doc.roundedRect(392, kpiY, cardWidth, cardHeight, 6).fillAndStroke(COLORS.bgLight, COLORS.borderLight);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.slateMuted).text('NET OPERATING PROFIT', 404, kpiY + 12);
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(COLORS.slateDark)
      .text(`INR ${kpis.netProfit.toLocaleString('en-IN')}`, 404, kpiY + 28);

    doc.y = kpiY + cardHeight + 25;

    // Table Header
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text('Operational Ledger Breakdown');
    doc.moveDown(0.6);

    const tableTop = doc.y;
    doc.rect(40, tableTop, 515.28, 22).fill(COLORS.slateDark);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
    doc.text('Date', 50, tableTop + 6);
    doc.text('Type', 125, tableTop + 6);
    doc.text('Vehicle Asset', 215, tableTop + 6);
    doc.text('Description / Work Order', 315, tableTop + 6);
    doc.text('Amount (INR)', 470, tableTop + 6, { align: 'right', width: 75 });

    let rowY = tableTop + 22;

    const items = [
      ...expenses.map((e) => ({
        date: String(e.date || e.expenseDate || '').substring(0, 10),
        category: e.type || 'Operational',
        vehicle: e.vehicleRegNumber || 'Fleet Wide',
        description: (e.description || e.notes || 'Operating Expense').substring(0, 32),
        amount: Number(e.amount || e.cost || 0),
      })),
      ...maintenance.map((m) => ({
        date: String(m.date || '').substring(0, 10),
        category: 'Maintenance',
        vehicle: m.vehicleRegNumber || 'Workshop',
        description: (m.description || m.serviceType || 'Service Order').substring(0, 32),
        amount: Number(m.cost || 0),
      })),
    ].slice(0, 22);

    items.forEach((item, index) => {
      const isZebra = index % 2 === 1;
      doc.rect(40, rowY, 515.28, 20).fill(isZebra ? COLORS.bgZebra : COLORS.white);

      doc.font('Helvetica').fontSize(8).fillColor(COLORS.slateText);
      doc.text(item.date, 50, rowY + 5);
      doc.text(item.category, 125, rowY + 5);
      doc.font('Helvetica-Bold').text(item.vehicle, 215, rowY + 5);
      doc.font('Helvetica').text(item.description, 315, rowY + 5);
      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.slateDark)
        .text(`INR ${item.amount.toLocaleString('en-IN')}`, 465, rowY + 5, {
          align: 'right',
          width: 80,
        });

      doc.rect(40, rowY + 20, 515.28, 0.5).fill(COLORS.borderLight);
      rowY += 20.5;
    });

    drawFooter(doc, 1);
    doc.end();
  },

  generateFleetRoiPdf: (res: Response, vehicles: any[]) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops-fleet-roi.pdf"');
    doc.pipe(res);

    drawHeaderBanner(doc, 'Fleet Asset ROI Matrix', 'CAPITAL ROI', `ROI-${Date.now().toString().slice(-6)}`);

    const summaryTop = doc.y + 10;
    doc.roundedRect(40, summaryTop, 515.28, 48, 6).fillAndStroke(COLORS.bgLight, COLORS.borderLight);

    const totalAcq = vehicles.reduce((sum, v) => sum + (v.acquisitionCost || 0), 0);
    const totalRev = vehicles.reduce((sum, v) => sum + (v.revenueGenerated || 0), 0);
    const fleetAvgRoi = totalAcq > 0 ? Math.round((totalRev / totalAcq) * 100) : 0;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.slateMuted);
    doc.text('TOTAL CAPITAL INVESTMENT', 55, summaryTop + 10);
    doc.text('CUMULATIVE EARNINGS', 230, summaryTop + 10);
    doc.text('FLEET RETURN ON ASSETS', 405, summaryTop + 10);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.slateDark);
    doc.text(`INR ${totalAcq.toLocaleString('en-IN')}`, 55, summaryTop + 24);
    doc.text(`INR ${totalRev.toLocaleString('en-IN')}`, 230, summaryTop + 24);
    doc.fillColor(COLORS.brandEmerald).text(`${fleetAvgRoi}% ROI`, 405, summaryTop + 24);

    doc.y = summaryTop + 65;

    // Table Header
    const tableTop = doc.y;
    doc.rect(40, tableTop, 515.28, 22).fill(COLORS.slateDark);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
    doc.text('Registration', 50, tableTop + 6);
    doc.text('Vehicle Model / Name', 140, tableTop + 6);
    doc.text('Operational Status', 270, tableTop + 6);
    doc.text('Acq. Cost (INR)', 360, tableTop + 6, { align: 'right', width: 75 });
    doc.text('Revenue (INR)', 445, tableTop + 6, { align: 'right', width: 65 });
    doc.text('ROI', 515, tableTop + 6, { align: 'right', width: 30 });

    let rowY = tableTop + 22;

    vehicles.forEach((v, index) => {
      const acq = Number(v.acquisitionCost || 1);
      const rev = Number(v.revenueGenerated || 0);
      const roi = Math.round((rev / acq) * 100);

      doc.rect(40, rowY, 515.28, 21).fill(index % 2 === 1 ? COLORS.bgZebra : COLORS.white);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.slateDark);
      doc.text(v.registrationNumber, 50, rowY + 5);

      doc.font('Helvetica').fillColor(COLORS.slateText);
      doc.text(`${v.name} (${v.model || v.type})`.substring(0, 26), 140, rowY + 5);

      // Status Badge
      const isAvail = v.status === 'Available';
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(isAvail ? COLORS.brandEmerald : COLORS.brandAmber)
        .text(v.status.toUpperCase(), 270, rowY + 5);

      doc
        .font('Helvetica')
        .fillColor(COLORS.slateText)
        .fontSize(8)
        .text(`INR ${acq.toLocaleString('en-IN')}`, 355, rowY + 5, { align: 'right', width: 80 });

      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.slateDark)
        .text(`INR ${rev.toLocaleString('en-IN')}`, 435, rowY + 5, { align: 'right', width: 75 });

      doc
        .font('Helvetica-Bold')
        .fillColor(roi >= 100 ? COLORS.brandEmerald : COLORS.slateDark)
        .text(`${roi}%`, 515, rowY + 5, { align: 'right', width: 30 });

      doc.rect(40, rowY + 21, 515.28, 0.5).fill(COLORS.borderLight);
      rowY += 21.5;
    });

    drawFooter(doc, 1);
    doc.end();
  },

  generateTripReceiptPdf: (res: Response, trip: any) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="trip-receipt-${trip.tripCode || trip.id}.pdf"`);
    doc.pipe(res);

    drawHeaderBanner(doc, 'Official Freight Consignment Receipt', 'WAYBILL', trip.tripCode || trip.id);

    const cardY = doc.y + 12;
    doc.roundedRect(40, cardY, 515.28, 220, 8).fillAndStroke(COLORS.bgLight, COLORS.borderLight);

    let curY = cardY + 16;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.slateDark);
    doc.text('1. ROUTE & DISPATCH ITINERARY', 55, curY);
    curY += 18;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted).text('Origin Terminal:', 55, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(trip.source, 150, curY);

    doc.font('Helvetica').fillColor(COLORS.slateMuted).text('Destination:', 310, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(trip.destination, 400, curY);

    curY += 22;
    doc.rect(55, curY, 485, 0.5).fill(COLORS.borderLight);
    curY += 12;

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.slateDark);
    doc.text('2. VEHICLE & ASSIGNED DRIVER', 55, curY);
    curY += 18;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted).text('Vehicle Assigned:', 55, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(`${trip.vehicleName} (${trip.vehicleRegNumber})`, 150, curY);

    doc.font('Helvetica').fillColor(COLORS.slateMuted).text('Authorized Driver:', 310, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(trip.driverName, 400, curY);

    curY += 22;
    doc.rect(55, curY, 485, 0.5).fill(COLORS.borderLight);
    curY += 12;

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.slateDark);
    doc.text('3. CONSIGNMENT & REVENUE AUDIT', 55, curY);
    curY += 18;

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted).text('Cargo Net Weight:', 55, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(`${trip.cargoWeightKg} KG`, 150, curY);

    doc.font('Helvetica').fillColor(COLORS.slateMuted).text('Route Distance:', 310, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(`${trip.plannedDistanceKm} KM`, 400, curY);

    curY += 20;
    doc.font('Helvetica').fillColor(COLORS.slateMuted).text('Dispatch Status:', 55, curY);
    doc.font('Helvetica-Bold').fillColor(COLORS.brandEmerald).text(String(trip.status).toUpperCase(), 150, curY);

    doc.font('Helvetica').fillColor(COLORS.slateMuted).text('Billed Freight Total:', 310, curY);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.slateDark)
      .text(`INR ${Number(trip.revenue || 0).toLocaleString('en-IN')}`, 415, curY);

    doc.y = cardY + 245;

    // Statutory Declaration Callout
    doc.roundedRect(40, doc.y, 515.28, 55, 6).fillAndStroke('#eff6ff', '#bfdbfe');
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#1e40af')
      .text('STATUTORY CARRIAGE DECLARATION', 55, doc.y + 12);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#1e3a8a')
      .text(
        'This receipt is an electronic carriage receipt issued pursuant to Rule 138 of the Central Motor Vehicles Rules and Indian GST E-Way freight transport regulations. Recorded electronically by TransitOps Logistics Hub.',
        55,
        doc.y + 26,
        { width: 485 }
      );

    drawFooter(doc, 1);
    doc.end();
  },

  // Generate Payment Receipt PDF for Download or Email Attachment
  createPaymentReceiptBuffer: (receiptData: {
    organizationName: string;
    fullName: string;
    email: string;
    planName: string;
    amountPaise: number;
    orderId: string;
    paymentId: string;
    date?: string;
  }): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      drawHeaderBanner(
        doc,
        'Official Tax Invoice & Receipt',
        'TAX INVOICE',
        receiptData.paymentId || receiptData.orderId
      );

      const amountInr = receiptData.amountPaise / 100;
      const baseAmount = amountInr / 1.18;
      const gstAmount = amountInr - baseAmount;

      const cardY = doc.y + 12;
      doc.roundedRect(40, cardY, 515.28, 110, 8).fillAndStroke(COLORS.bgLight, COLORS.borderLight);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.slateMuted).text('BILLED TO:', 55, cardY + 14);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text(receiptData.organizationName, 55, cardY + 28);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateText).text(`Attn: ${receiptData.fullName}`, 55, cardY + 44);
      doc.text(`Email: ${receiptData.email}`, 55, cardY + 58);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.slateMuted).text('PAYMENT DETAILS:', 310, cardY + 14);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateText).text(`Order ID: ${receiptData.orderId}`, 310, cardY + 28);
      doc.text(`Payment ID: ${receiptData.paymentId}`, 310, cardY + 44);
      doc.text(`Status: Captured & Confirmed (Paid)`, 310, cardY + 58);
      doc.text(`Date: ${receiptData.date || new Date().toLocaleDateString('en-IN')}`, 310, cardY + 72);

      doc.y = cardY + 130;

      // Invoice Items Table
      const tableTop = doc.y;
      doc.rect(40, tableTop, 515.28, 22).fill(COLORS.slateDark);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
      doc.text('Subscription Plan Description', 50, tableTop + 6);
      doc.text('Term', 300, tableTop + 6);
      doc.text('SAC Code', 380, tableTop + 6);
      doc.text('Amount (INR)', 470, tableTop + 6, { align: 'right', width: 75 });

      const itemY = tableTop + 22;
      doc.rect(40, itemY, 515.28, 26).fill(COLORS.white);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.slateDark);
      doc.text(`TransitOps ${receiptData.planName} SaaS Plan`, 50, itemY + 8);
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateText);
      doc.text('1 Month', 300, itemY + 8);
      doc.text('998313', 380, itemY + 8);
      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.slateDark)
        .text(`INR ${baseAmount.toFixed(2)}`, 465, itemY + 8, { align: 'right', width: 80 });

      // Breakdown Subtotals
      let breakY = itemY + 36;
      doc.rect(40, breakY, 515.28, 0.5).fill(COLORS.borderLight);
      breakY += 10;

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted).text('Taxable Subtotal:', 340, breakY);
      doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(`INR ${baseAmount.toFixed(2)}`, 450, breakY, { align: 'right', width: 95 });

      breakY += 16;
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted).text('CGST (9%) + SGST (9%):', 340, breakY);
      doc.font('Helvetica-Bold').fillColor(COLORS.slateDark).text(`INR ${gstAmount.toFixed(2)}`, 450, breakY, { align: 'right', width: 95 });

      breakY += 20;
      doc.rect(340, breakY, 215.28, 26).fill(COLORS.bgLight);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.brandEmerald).text('TOTAL PAID:', 350, breakY + 8);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(COLORS.slateDark)
        .text(`INR ${amountInr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, breakY + 7, {
          align: 'right',
          width: 95,
        });

      doc.y = breakY + 45;
      doc.roundedRect(40, doc.y, 515.28, 48, 6).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#065f46')
        .text('TAX INVOICE CONFIRMATION', 55, doc.y + 10);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#047857')
        .text(
          'Thank you for your business. Your payment has been received and your TransitOps organization workspace is active. For support or enterprise GSTIN invoicing adjustments, contact accounts@transitops.com.',
          55,
          doc.y + 22,
          { width: 485 }
        );

      drawFooter(doc, 1);
      doc.end();
    });
  },
};
