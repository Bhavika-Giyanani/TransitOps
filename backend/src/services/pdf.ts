import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { calculateVehicleRoi } from '../../../shared/vehicleRoi';

// Corporate Design Tokens
const COLORS = {
  navyDark: '#0c0e12',
  navyCard: '#14171e',
  brandAmber: '#ccff00',
  brandEmerald: '#84cc16',
  slateDark: '#14171e',
  slateText: '#334155',
  slateMuted: '#64748b',
  borderLight: '#e2e8f0',
  bgLight: '#f8fafc',
  bgZebra: '#f1f5f9',
  white: '#ffffff',
};

interface FleetRoiPdfVehicle {
  registrationNumber: string;
  name: string;
  model: string;
  type: string;
  status: string;
  acquisitionCost: number | null;
  revenueGenerated: number | null;
  maintenanceCost?: number;
  fuelCost?: number;
  profit?: number;
  roiPercent?: number;
}

function drawHeaderBanner(
  doc: PDFKit.PDFDocument,
  title: string,
  docType: string,
  refCode: string
) {
  // Top Header Banner
  doc.rect(0, 0, 595.28, 94).fill(COLORS.navyDark);

  // Accent Line
  doc.rect(0, 94, 595.28, 4).fill(COLORS.brandAmber);

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
    .fontSize(11.5)
    .fillColor(COLORS.white)
    .text(title.toUpperCase(), 300, 22, { align: 'right', width: 255, height: 28, ellipsis: true });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(`REF: ${refCode}  |  DATE: ${new Date().toLocaleDateString('en-IN')}`, 300, 61, {
      align: 'right',
      width: 255,
      height: 12,
      ellipsis: true,
    });

  doc.y = 114;
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

    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text('Operational Ledger Breakdown');
    doc.moveDown(0.6);

    const drawTableHeader = () => {
      const tableTop = doc.y;
      doc.rect(40, tableTop, 515.28, 22).fill(COLORS.slateDark);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
      doc.text('Date', 50, tableTop + 6);
      doc.text('Type', 125, tableTop + 6);
      doc.text('Vehicle Asset', 215, tableTop + 6);
      doc.text('Description / Work Order', 315, tableTop + 6);
      doc.text('Amount (INR)', 470, tableTop + 6, { align: 'right', width: 75 });
      return tableTop + 22;
    };

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
    ];

    let pageNumber = 1;
    let rowY = drawTableHeader();
    if (items.length === 0) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted)
        .text('No financial activity is available for this reporting period.', 50, rowY + 12);
      rowY += 36;
    }
    items.forEach((item, index) => {
      if (rowY > 755) {
        drawFooter(doc, pageNumber++);
        doc.addPage({ margin: 40, size: 'A4' });
        drawHeaderBanner(doc, 'Executive Financial Ledger', 'LEDGER', `TX-LED-${Date.now().toString().slice(-6)}`);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.slateDark).text('Operational Ledger Breakdown');
        doc.moveDown(0.6);
        rowY = drawTableHeader();
      }
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

    drawFooter(doc, pageNumber);
    doc.end();
  },

  generateFleetRoiPdf: (res: Response, vehicles: FleetRoiPdfVehicle[]) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops-fleet-roi.pdf"');
    doc.pipe(res);

    drawHeaderBanner(doc, 'Fleet Asset ROI Matrix', 'CAPITAL ROI', `ROI-${Date.now().toString().slice(-6)}`);

    const summaryTop = doc.y + 10;
    doc.roundedRect(40, summaryTop, 515.28, 48, 6).fillAndStroke(COLORS.bgLight, COLORS.borderLight);

    const totalAcq = vehicles.reduce((sum, v) => sum + (v.acquisitionCost || 0), 0);
    const totalRev = vehicles.reduce((sum, v) => sum + (v.revenueGenerated || 0), 0);
    const totalProfit = vehicles.reduce((sum, v) => sum + Number(v.profit ?? calculateVehicleRoi({
      acquisitionCost: Number(v.acquisitionCost || 0),
      revenue: Number(v.revenueGenerated || 0),
      maintenanceCost: Number(v.maintenanceCost || 0),
      fuelCost: Number(v.fuelCost || 0),
    }).profit), 0);
    const fleetAvgRoi = totalAcq > 0 && totalRev > 0
      ? Math.round((totalProfit / totalAcq) * 100)
      : 0;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.slateMuted);
    doc.text('TOTAL CAPITAL INVESTMENT', 55, summaryTop + 10);
    doc.text('CUMULATIVE EARNINGS', 230, summaryTop + 10);
    doc.text('FLEET RETURN ON ASSETS', 405, summaryTop + 10);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.slateDark);
    doc.text(`INR ${totalAcq.toLocaleString('en-IN')}`, 55, summaryTop + 24);
    doc.text(`INR ${totalRev.toLocaleString('en-IN')}`, 230, summaryTop + 24);
    doc.fillColor(COLORS.brandEmerald).text(`${fleetAvgRoi}% ROI`, 405, summaryTop + 24);

    doc.y = summaryTop + 65;

    const drawTableHeader = () => {
      const tableTop = doc.y;
      doc.rect(40, tableTop, 515.28, 22).fill(COLORS.slateDark);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.white);
      doc.text('Registration', 50, tableTop + 6);
      doc.text('Vehicle Model / Name', 140, tableTop + 6);
      doc.text('Operational Status', 270, tableTop + 6);
      doc.text('Acq. Cost (INR)', 360, tableTop + 6, { align: 'right', width: 75 });
      doc.text('Revenue (INR)', 445, tableTop + 6, { align: 'right', width: 65 });
      doc.text('ROI', 515, tableTop + 6, { align: 'right', width: 30 });
      return tableTop + 22;
    };

    let pageNumber = 1;
    let rowY = drawTableHeader();

    vehicles.forEach((v, index) => {
      if (rowY > 755) {
        drawFooter(doc, pageNumber++);
        doc.addPage({ margin: 40, size: 'A4' });
        drawHeaderBanner(doc, 'Fleet Asset ROI Matrix', 'CAPITAL ROI', `ROI-${Date.now().toString().slice(-6)}`);
        rowY = drawTableHeader();
      }
      const acq = Number(v.acquisitionCost || 0);
      const rev = Number(v.revenueGenerated || 0);
      const roi = Number(v.roiPercent ?? calculateVehicleRoi({
        acquisitionCost: acq,
        revenue: rev,
        maintenanceCost: Number(v.maintenanceCost || 0),
        fuelCost: Number(v.fuelCost || 0),
      }).roiPercent);

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
        .fillColor(isAvail ? '#166534' : '#92400e')
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

    drawFooter(doc, pageNumber);
    doc.end();
  },

  generateTripReceiptPdf: (res: Response, trip: any) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="trip-receipt-${trip.tripCode || trip.id}.pdf"`);
    doc.pipe(res);

    drawHeaderBanner(doc, 'Official Freight Consignment Receipt', 'WAYBILL', trip.tripCode || trip.id);

    const cardY = doc.y + 12;
    const labelX = 55;
    const valueX = 180;
    const valueWidth = 360;
    const sections = [
      {
        title: '1. ROUTE & DISPATCH ITINERARY',
        fields: [
          ['Origin Terminal:', String(trip.source || '—')],
          ['Destination:', String(trip.destination || '—')],
        ],
      },
      {
        title: '2. VEHICLE & ASSIGNED DRIVER',
        fields: [
          ['Vehicle Assigned:', `${trip.vehicleName || '—'} (${trip.vehicleRegNumber || '—'})`],
          ['Authorized Driver:', String(trip.driverName || '—')],
        ],
      },
      {
        title: '3. CONSIGNMENT & REVENUE AUDIT',
        fields: [
          ['Cargo Net Weight:', `${trip.cargoWeightKg} KG`],
          ['Route Distance:', `${trip.plannedDistanceKm} KM`],
          ['Dispatch Status:', String(trip.status || '—').toUpperCase()],
          ['Billed Freight Total:', `INR ${Number(trip.revenue || 0).toLocaleString('en-IN')}`],
        ],
      },
    ];
    const measureFieldHeight = (value: string) => {
      doc.font('Helvetica-Bold').fontSize(9);
      return Math.max(14, doc.heightOfString(value, { width: valueWidth }));
    };
    const cardHeight = sections.reduce((height, section) => (
      height + 22 + section.fields.reduce((sectionHeight, [, value]) => (
        sectionHeight + measureFieldHeight(value) + 5
      ), 0) + 8
    ), 16);
    doc.roundedRect(40, cardY, 515.28, cardHeight, 8).fillAndStroke(COLORS.bgLight, COLORS.borderLight);

    let curY = cardY + 14;
    sections.forEach((section, sectionIndex) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.slateDark);
      doc.text(section.title, labelX, curY);
      curY += 17;

      section.fields.forEach(([label, value]) => {
        const rowHeight = measureFieldHeight(value);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.slateMuted);
        doc.text(label, labelX, curY, { width: 115 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.slateDark);
        doc.text(value, valueX, curY, { width: valueWidth });
        curY += rowHeight + 5;
      });

      if (sectionIndex < sections.length - 1) {
        doc.rect(labelX, curY, 485, 0.5).fill(COLORS.borderLight);
        curY += 8;
      }
    });

    doc.y = cardY + cardHeight + 22;

    // Statutory Declaration Callout
    const declarationY = doc.y;
    const declarationText =
      'This receipt is an electronic carriage receipt issued pursuant to Rule 138 of the Central Motor Vehicles Rules and Indian GST E-Way freight transport regulations. Recorded electronically by TransitOps Logistics Hub.';
    const declarationTextY = declarationY + 27;
    doc.font('Helvetica').fontSize(8);
    const declarationTextHeight = doc.heightOfString(declarationText, { width: 485 });
    const declarationHeight = declarationTextY - declarationY + declarationTextHeight + 10;
    doc.roundedRect(40, declarationY, 515.28, declarationHeight, 6).fillAndStroke('#eff6ff', '#bfdbfe');
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#1e40af')
      .text('STATUTORY CARRIAGE DECLARATION', 55, declarationY + 12);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#1e3a8a')
      .text(declarationText, 55, declarationTextY, { width: 485 });

    drawFooter(doc, 1);
    doc.end();
  },

  // Generate Payment Receipt PDF for Download or Email Attachment
  createPaymentReceiptBuffer: (receiptData: {
    organizationName: string;
    fullName: string;
    email: string;
    planName: string;
    termMonths: number;
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
      doc.text(`${receiptData.termMonths} Month${receiptData.termMonths === 1 ? '' : 's'}`, 300, itemY + 8);
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

      const confirmationY = breakY + 45;
      const confirmationText =
        'Thank you for your business. Your payment has been received and your TransitOps organization workspace is active. For support or enterprise GSTIN invoicing adjustments, contact accounts@transitops.com.';
      const confirmationTextY = confirmationY + 24;
      doc.font('Helvetica').fontSize(8);
      const confirmationTextHeight = doc.heightOfString(confirmationText, { width: 485 });
      const confirmationHeight = confirmationTextY - confirmationY + confirmationTextHeight + 10;
      doc.roundedRect(40, confirmationY, 515.28, confirmationHeight, 6).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#065f46')
        .text('TAX INVOICE CONFIRMATION', 55, confirmationY + 10);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#047857')
        .text(confirmationText, 55, confirmationTextY, { width: 485 });

      drawFooter(doc, 1);
      doc.end();
    });
  },
};
