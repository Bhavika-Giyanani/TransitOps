import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'localhost';
const port = Number(process.env.SMTP_PORT || 1025);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const fromEmail = process.env.SMTP_FROM || 'no-reply@transitops.com';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: user && pass ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: false,
  },
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export const emailService = {
  sendLicenseReminder: async (toEmail: string, driverName: string, expiryDate: string) => {
    try {
      await transporter.sendMail({
        from: `"TransitOps Safety Desk" <${fromEmail}>`,
        to: toEmail,
        subject: `URGENT: Commercial Driving Licence Renewal Required (${driverName})`,
        text: `Dear ${driverName},\n\nYour commercial driver licence is scheduled to expire on ${expiryDate}. Under Indian Motor Vehicles Act guidelines, you must renew your licence before operating any transport vehicle.\n\nPlease visit your local RTO or the Sarathi Parivahan portal to complete your renewal.\n\nBest regards,\nTransitOps Operations Team`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
            <div style="background: #0b1329; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px;">
              <h2 style="color: #ffffff; margin: 0; font-size: 18px; letter-spacing: 1px;">TRANSITOPS <span style="color: #d97706; font-size: 13px;">| SAFETY DESK</span></h2>
            </div>
            <h3 style="color: #d97706; margin-top: 0;">Commercial Licence Renewal Notice</h3>
            <p>Dear <strong>${driverName}</strong>,</p>
            <p>Our regulatory compliance telemetry indicates that your commercial driver licence will expire on <strong>${expiryDate}</strong>.</p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">
                Please complete your licence renewal promptly via the Sarathi Parivahan portal or your local RTO to avoid suspension from active fleet dispatch.
              </p>
            </div>
            <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Warm regards,<br/><strong style="color: #1e293b;">TransitOps Safety & Compliance Team</strong></p>
          </div>
        `,
      });
      console.log(`[TransitOps SMTP] Licence reminder email dispatched to ${toEmail}`);
      return { success: true };
    } catch (err) {
      console.error('[TransitOps SMTP] Licence reminder could not be delivered:', err);
      throw err;
    }
  },

  sendVerificationCode: async (toEmail: string, orgName: string, code: string) => {
      const safeOrganizationName = escapeHtml(orgName);
      const safeCode = escapeHtml(code);
      await transporter.sendMail({
        from: `"TransitOps Onboarding" <${fromEmail}>`,
        to: toEmail,
        subject: `Your TransitOps Verification Code: ${code}`,
        text: `Welcome to TransitOps for ${orgName}!\n\nYour verification code is: ${code}\n\nUse this code to verify your fleet administration account.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 28px; color: #1e293b; background: #f8fafc; border-radius: 8px; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0;">
            <div style="background: #0b1329; padding: 18px 24px; border-radius: 6px; margin-bottom: 24px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">TRANSITOPS <span style="color: #10b981; font-size: 13px;">| ONBOARDING</span></h1>
            </div>
            <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">Confirm your Organization Email</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">
              You have initiated workspace registration for <strong>${safeOrganizationName}</strong>. Please enter the following 6-digit verification code to confirm your email:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 14px 28px; background: #0f172a; color: #ccff00; border-radius: 8px; display: inline-block;">
                ${safeCode}
              </span>
            </div>
            <p style="color: #64748b; font-size: 13px;">If you did not request this verification code, please disregard this message.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">TransitOps Smart Transport Operations Platform • Automated System Notice</p>
          </div>
        `,
      });
      console.log(`[TransitOps SMTP] Verification code sent to ${toEmail}`);
      return { success: true };
  },

  sendPaymentReceiptAndSetupEmail: async (data: {
    toEmail: string;
    organizationName: string;
    fullName: string;
    planName: string;
    amountPaise: number;
    orderId: string;
    paymentId: string;
    setupUrl: string;
    termMonths: number;
    pdfBuffer: Buffer;
  }) => {
    const amountInr = (data.amountPaise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    });
    const organizationName = escapeHtml(data.organizationName);
    const fullName = escapeHtml(data.fullName);
    const planName = escapeHtml(data.planName);
    const orderId = escapeHtml(data.orderId);
    const paymentId = escapeHtml(data.paymentId);
    const setupUrl = escapeHtml(data.setupUrl);

    const attachments = [
      {
        filename: `TransitOps-Tax-Invoice-${data.paymentId || data.orderId}.pdf`,
        content: data.pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

      await transporter.sendMail({
        from: `"TransitOps Accounts" <${fromEmail}>`,
        to: data.toEmail,
        subject: `Payment Confirmed & Account Setup: Welcome ${data.organizationName} to TransitOps!`,
        text: `Dear ${data.fullName},\n\nThank you for subscribing to TransitOps (${data.planName}).\n\nPayment Details:\n- Organization: ${data.organizationName}\n- Amount Paid: INR ${amountInr}\n- Order ID: ${data.orderId}\n- Payment ID: ${data.paymentId}\n\nSet up your organization admin credentials using this secure link:\n${data.setupUrl}\n\nBest regards,\nTransitOps Operations Team`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 28px; color: #1e293b; background: #f8fafc; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
            <div style="background: #0b1329; padding: 20px 24px; border-radius: 6px; margin-bottom: 24px; border-bottom: 3px solid #10b981;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 1px;">TRANSITOPS <span style="color: #10b981; font-size: 13px;">| OFFICIAL RECEIPT</span></h1>
            </div>
            
            <h2 style="color: #065f46; font-size: 18px; margin-top: 0;">Payment Successfully Confirmed</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              Dear <strong>${fullName}</strong>,<br/>
              We have received your payment for <strong>${organizationName}</strong>. Your organization workspace is now active on the <strong>${planName}</strong> plan.
            </p>

            <!-- Order Breakdown Box -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Organization:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${organizationName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Plan Selected:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #0f172a; text-align: right;">${planName} (${data.termMonths} Month${data.termMonths === 1 ? '' : 's'})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Order Reference:</td>
                  <td style="padding: 6px 0; font-family: monospace; color: #0f172a; text-align: right;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Payment ID:</td>
                  <td style="padding: 6px 0; font-family: monospace; color: #0f172a; text-align: right;">${paymentId}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0 4px; font-weight: bold; color: #065f46; font-size: 14px;">Total Paid:</td>
                  <td style="padding: 10px 0 4px; font-weight: bold; color: #065f46; font-size: 16px; text-align: right;">INR ${amountInr}</td>
                </tr>
              </table>
            </div>

            <!-- Credentials Setup CTA -->
            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <h3 style="color: #166534; margin: 0 0 8px; font-size: 16px;">Next Step: Set Up Your Administrator Password</h3>
              <p style="color: #15803d; font-size: 13px; margin: 0 0 16px; line-height: 1.5;">
                Click below to configure your master credentials and access your new organization dashboard.
              </p>
              <a href="${setupUrl}" style="background: #0f172a; color: #ccff00; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 6px; display: inline-block;">
                Set Up Admin Password &rarr;
              </a>
              <p style="color: #64748b; font-size: 11px; margin-top: 12px; margin-bottom: 0;">
                Direct URL: <span style="word-break: break-all; color: #0369a1;">${setupUrl}</span>
              </p>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
              An official Tax Invoice PDF has also been generated and attached to this email. You can download or print it at any time from your TransitOps organization portal.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">TransitOps Smart Transport Operations Platform • GSTIN Compliant Invoicing</p>
          </div>
        `,
        attachments,
      });
    console.log(`[TransitOps SMTP] Professional payment receipt & setup email sent to ${data.toEmail}`);
    return { success: true };
  },
};
