import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../db';
import { emailService } from '../../services/email';
import { pdfService } from '../../services/pdf';

export const onboardingRouter = Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_transitops_demo';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'secret_test_transitops_key';

function setupUrlFor(req: Request, token: string): string {
  const baseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${baseUrl}/setup-account?token=${encodeURIComponent(token)}`;
}

// Zod Validation Schemas
const beginOnboardingSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters.')
    .trim(),
  fullName: z
    .string()
    .min(2, 'Administrator full name must be at least 2 characters.')
    .trim(),
  email: z
    .string()
    .email('Please enter a valid corporate email address.')
    .trim()
    .toLowerCase(),
});

const verifyEmailSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase session identifier is required.'),
  purchaseSecret: z.string().min(1, 'Purchase session secret is required.'),
  code: z
    .string()
    .min(6, 'Verification code must be 6 digits.')
    .max(6, 'Verification code must be 6 digits.'),
});

const createOrderSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase session identifier is required.'),
  purchaseSecret: z.string().min(1, 'Purchase session secret is required.'),
  planId: z.string().min(1, 'Subscription plan selection is required.'),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required.'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required.'),
  razorpaySignature: z.string().min(1, 'Payment signature is required.'),
});

const completeSetupSchema = z.object({
  token: z.string().min(1, 'Setup token is required.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.'),
});

onboardingRouter.get('/plans', async (_req: Request, res: Response) => {
  const dbPlans = await prisma.subscriptionPlan.findMany();
  const formatted = dbPlans.map((p) => ({
    ...p,
    features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features,
  }));
  return res.json(formatted);
});

onboardingRouter.post('/begin', async (req: Request, res: Response) => {
  const validation = beginOnboardingSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg, errors: validation.error.flatten().fieldErrors });
  }

  const { organizationName, fullName, email } = validation.data;
  const registeredAccount = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (registeredAccount) {
    return res.status(409).json({
      detail: 'This email is already registered with a TransitOps organization. Sign in with that account or use another administrator email.',
    });
  }
  const existingPaidSubscription = await prisma.purchaseSession.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      paymentVerified: true,
    },
    select: { id: true },
  });
  if (existingPaidSubscription) {
    return res.status(409).json({
      detail: 'This email already has a paid TransitOps subscription awaiting account setup. Use the activation link sent by email or contact support.',
    });
  }
  const verificationCode = String(crypto.randomInt(100000, 1000000));
  const purchaseSecret = `sec_${crypto.randomBytes(16).toString('hex')}`;

  const session = await prisma.purchaseSession.create({
    data: {
      organizationName,
      fullName,
      email,
      verificationCode,
      purchaseSecret,
    },
  });

  try {
    await emailService.sendVerificationCode(email, organizationName, verificationCode);
  } catch (err) {
    console.error('[TransitOps Onboarding] Verification email could not be delivered:', err);
    return res.status(202).json({
      purchaseId: session.id,
      purchaseSecret: session.purchaseSecret,
      verificationEmailSent: false,
      message: 'Your onboarding session was saved, but the verification email could not be delivered. Check the mail service and retry sending the code.',
    });
  }

  return res.json({
    purchaseId: session.id,
    purchaseSecret: session.purchaseSecret,
    verificationEmailSent: true,
    message: `Verification code dispatched to ${email} for ${organizationName}.`,
  });
});

onboardingRouter.post('/verify-email', async (req: Request, res: Response) => {
  const validation = verifyEmailSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg });
  }

  const { purchaseId, purchaseSecret, code } = validation.data;
  const session = await prisma.purchaseSession.findFirst({
    where: { id: purchaseId, purchaseSecret },
  });

  if (!session) {
    return res.status(404).json({ detail: 'Purchase session not found.' });
  }

  if (session.verificationCode === code) {
    await prisma.purchaseSession.update({
      where: { id: purchaseId },
      data: { emailVerified: true },
    });
    return res.json({ verified: true, message: 'Email confirmed. You can now choose a subscription tier.' });
  }

  return res.status(400).json({ detail: 'Invalid 6-digit confirmation code. Please check your email and retry.' });
});

onboardingRouter.post('/resend-verification', async (req: Request, res: Response) => {
  const validation = z.object({
    purchaseId: z.string().min(1),
    purchaseSecret: z.string().min(1),
  }).safeParse(req.body);
  if (!validation.success) return res.status(400).json({ detail: 'Purchase session credentials are required.' });

  const session = await prisma.purchaseSession.findFirst({
    where: {
      id: validation.data.purchaseId,
      purchaseSecret: validation.data.purchaseSecret,
      emailVerified: false,
    },
  });
  if (!session) return res.status(404).json({ detail: 'Unverified purchase session not found.' });

  const newCode = String(crypto.randomInt(100000, 1000000));
  await prisma.purchaseSession.update({
    where: { id: session.id },
    data: { verificationCode: newCode },
  });
  try {
    await emailService.sendVerificationCode(session.email, session.organizationName, newCode);
  } catch (err) {
    console.error('[TransitOps Onboarding] Verification email retry failed:', err);
    return res.status(502).json({ detail: 'Verification email could not be delivered. Check the mail service and try again.' });
  }
  return res.json({ emailSent: true, message: 'A new confirmation code was sent to your organization email.' });
});

onboardingRouter.post('/orders', async (req: Request, res: Response) => {
  const validation = createOrderSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg });
  }

  const { purchaseId, purchaseSecret, planId } = validation.data;
  const session = await prisma.purchaseSession.findFirst({
    where: { id: purchaseId, purchaseSecret, emailVerified: true },
  });
  if (!session) return res.status(404).json({ detail: 'Verified purchase session not found. Verify your email and retry.' });
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ detail: 'Selected subscription plan was not found.' });
  const amountPaise = plan.amountPaise;

  let orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
  const hasRealRazorpayKeys =
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('demo') &&
    !RAZORPAY_KEY_SECRET.includes('demo');

  if (!hasRealRazorpayKeys && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ detail: 'Razorpay production credentials are not configured.' });
  }

  if (hasRealRazorpayKeys) {
    try {
      const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: `rcpt_${session.id.substring(0, 14)}`,
          notes: {
            purchaseId: session.id,
            planId,
            organization: session.organizationName,
          },
        }),
      });

      const rzpData = (await rzpResponse.json()) as any;
      if (rzpResponse.ok && rzpData.id) {
        orderId = rzpData.id;
        console.log(`[TransitOps Razorpay] Successfully generated official Razorpay order: ${orderId}`);
      } else {
        console.warn('[TransitOps Razorpay Warning] Razorpay API rejected order creation:', rzpData);
        return res.status(502).json({ detail: 'Razorpay could not create the subscription order. Please retry.' });
      }
    } catch (err) {
      console.error('[TransitOps Razorpay Error] Failed to reach Razorpay API:', err);
      return res.status(502).json({ detail: 'Razorpay is temporarily unavailable. Please retry shortly.' });
    }
  }

  if (purchaseId) {
    await prisma.purchaseSession.update({
      where: { id: purchaseId },
      data: { planId, orderId },
    });
  }

  return res.json({
    orderId,
    publicKeyId: RAZORPAY_KEY_ID,
    amountPaise,
    currency: 'INR',
    planId,
    planName: plan.name,
    termMonths: plan.termMonths,
  });
});

onboardingRouter.post('/verify-payment', async (req: Request, res: Response) => {
  const validation = verifyPaymentSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = validation.data;

  const hasRealRazorpayKeys =
    RAZORPAY_KEY_ID &&
    RAZORPAY_KEY_SECRET &&
    !RAZORPAY_KEY_ID.includes('demo') &&
    !RAZORPAY_KEY_SECRET.includes('demo');

  let isSignatureValid = false;
  if (hasRealRazorpayKeys) {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    const provided = Buffer.from(razorpaySignature, 'hex');
    isSignatureValid = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  } else if (process.env.NODE_ENV !== 'production') {
    isSignatureValid = razorpaySignature.startsWith('demo_sig_');
  }

  if (!isSignatureValid) {
    return res.status(400).json({ detail: 'Payment signature could not be verified.' });
  }

  const session = await prisma.purchaseSession.findFirst({
    where: { orderId: razorpayOrderId, emailVerified: true, planId: { not: null } },
  });
  if (!session || !session.planId) {
    return res.status(404).json({ detail: 'Verified subscription order was not found.' });
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: session.planId } });
  if (!plan) return res.status(404).json({ detail: 'Subscription plan for this order was not found.' });

  await prisma.purchaseSession.update({
    where: { id: session.id },
    data: { paymentVerified: true, paymentId: razorpayPaymentId },
  });

  const setupUrl = setupUrlFor(req, session.purchaseSecret);
  let receiptEmailSent = false;
  try {
    const receiptData = {
      organizationName: session.organizationName,
      fullName: session.fullName,
      email: session.email,
      planName: plan.name,
      amountPaise: plan.amountPaise,
      termMonths: plan.termMonths,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      date: new Date().toLocaleDateString('en-IN'),
    };

    const pdfBuffer = await pdfService.createPaymentReceiptBuffer(receiptData);
    await emailService.sendPaymentReceiptAndSetupEmail({
      toEmail: session.email,
      organizationName: session.organizationName,
      fullName: session.fullName,
      planName: plan.name,
      amountPaise: plan.amountPaise,
      termMonths: plan.termMonths,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      setupUrl,
      pdfBuffer,
    });
    await prisma.purchaseSession.update({
      where: { id: session.id },
      data: { receiptEmailSent: true, setupEmailSent: true },
    });
    receiptEmailSent = true;
  } catch (err) {
    console.warn('[TransitOps Receipt Email Dispatch Warning]', err);
  }

  return res.json({
    verified: true,
    receiptEmailSent,
    setupEmailSent: receiptEmailSent,
    setupCompleted: session.setupCompleted,
    accountToken: session.purchaseSecret,
    setupUrl,
    message: receiptEmailSent
      ? 'Payment verified. Your organization admin setup link and professional PDF receipt were emailed.'
      : 'Payment verified, but the email could not be delivered. Check the email service settings and retry delivery.',
  });
});

onboardingRouter.post('/progress', async (req: Request, res: Response) => {
  const validation = z.object({
    purchaseId: z.string().min(1),
    purchaseSecret: z.string().min(1),
  }).safeParse(req.body);
  if (!validation.success) return res.status(400).json({ detail: 'Purchase session credentials are required.' });
  const session = await prisma.purchaseSession.findFirst({
    where: { id: validation.data.purchaseId, purchaseSecret: validation.data.purchaseSecret },
  });
  if (!session) return res.status(404).json({ detail: 'Purchase session not found.' });

  const setupUrl = setupUrlFor(req, session.purchaseSecret);

  return res.json({
    emailVerified: session.emailVerified,
    paymentVerified: session.paymentVerified,
    receiptEmailSent: session.receiptEmailSent,
    setupEmailSent: session.setupEmailSent,
    setupCompleted: session.setupCompleted,
    accountToken: session.purchaseSecret,
    orderId: session.orderId,
    planId: session.planId,
    setupUrl,
    setupLinkExpiresAtUtc: null,
    paymentStatus: session.paymentVerified ? 'captured' : 'pending',
  });
});

onboardingRouter.post('/retry-emails', async (req: Request, res: Response) => {
  const validation = z.object({
    purchaseId: z.string().min(1),
    purchaseSecret: z.string().min(1),
  }).safeParse(req.body);
  if (!validation.success) return res.status(400).json({ detail: 'Purchase session credentials are required.' });
  const session = await prisma.purchaseSession.findFirst({
    where: {
      id: validation.data.purchaseId,
      purchaseSecret: validation.data.purchaseSecret,
      emailVerified: true,
      paymentVerified: true,
    },
  });
  if (!session || !session.planId || !session.orderId || !session.paymentId) {
    return res.status(404).json({ detail: 'Verified paid subscription was not found.' });
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: session.planId } });
  if (!plan) return res.status(404).json({ detail: 'Subscription plan for this receipt was not found.' });
  const setupUrl = setupUrlFor(req, session.purchaseSecret);
  const receiptData = {
    organizationName: session.organizationName,
    fullName: session.fullName,
    email: session.email,
    planName: plan.name,
    amountPaise: plan.amountPaise,
    termMonths: plan.termMonths,
    orderId: session.orderId,
    paymentId: session.paymentId,
    date: new Date(session.createdAt).toLocaleDateString('en-IN'),
  };
  try {
    const pdfBuffer = await pdfService.createPaymentReceiptBuffer(receiptData);
    await emailService.sendPaymentReceiptAndSetupEmail({
      toEmail: session.email,
      organizationName: session.organizationName,
      fullName: session.fullName,
      planName: plan.name,
      amountPaise: plan.amountPaise,
      termMonths: plan.termMonths,
      orderId: session.orderId,
      paymentId: session.paymentId,
      setupUrl,
      pdfBuffer,
    });
    await prisma.purchaseSession.update({
      where: { id: session.id },
      data: { receiptEmailSent: true, setupEmailSent: true },
    });
  } catch (err) {
    console.error('[TransitOps Onboarding] Payment email retry failed:', err);
    return res.status(502).json({ detail: 'Receipt and activation email could not be delivered. Check the mail service and retry.' });
  }

  return res.json({
    verified: true,
    receiptEmailSent: true,
    setupEmailSent: true,
    setupCompleted: session.setupCompleted,
    accountToken: session.purchaseSecret,
    setupUrl,
    message: 'Receipt and activation credentials sent to your inbox.',
  });
});

onboardingRouter.post('/complete-account-setup', async (req: Request, res: Response) => {
  const validation = completeSetupSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map((e) => e.message).join(' ');
    return res.status(400).json({ detail: errorMsg });
  }

  const { token, password } = validation.data;

  const session = await prisma.purchaseSession.findFirst({
    where: { purchaseSecret: token, emailVerified: true, paymentVerified: true },
  });
  if (!session) return res.status(404).json({ detail: 'A verified paid subscription setup session was not found.' });
  if (session.setupCompleted) {
    return res.status(409).json({ detail: 'Organization admin password setup has already been completed.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existingUser = await prisma.user.findUnique({ where: { email: session.email } });
  if (existingUser && existingUser.tenantId !== session.id) {
    return res.status(409).json({ detail: 'This email is already associated with another organization.' });
  }

  await prisma.$transaction(async (transaction) => {
    if (existingUser) {
      await transaction.user.update({
        where: { id: existingUser.id, tenantId: session.id },
        data: { passwordHash, fullName: session.fullName, role: 'organization_admin' },
      });
    } else {
      await transaction.user.create({
        data: {
          email: session.email,
          passwordHash,
          fullName: session.fullName,
          role: 'organization_admin',
          tenantId: session.id,
          isDemoAccount: false,
        },
      });
    }
    await transaction.purchaseSession.update({
      where: { id: session.id },
      data: { setupCompleted: true },
    });
  });

  return res.json({ email: session.email, success: true, message: 'Organization administrator credentials created successfully.' });
});

onboardingRouter.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!webhookSecret) return res.status(503).json({ detail: 'Payment webhook secret is not configured.' });
  if (!signature || !rawBody) {
    return res.status(400).json({ status: 'invalid_signature', detail: 'Webhook signature or raw payload is missing.' });
  }
  const digest = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expected = Buffer.from(digest, 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(400).json({ status: 'invalid_signature' });
  }

  const event = req.body?.event;
  const payload = req.body?.payload;
  console.log(`[Razorpay Webhook] Processed event: ${event}`);

  if (event === 'payment.captured' || event === 'order.paid') {
    const payment = payload?.payment?.entity;
    if (payment?.order_id) {
      await prisma.purchaseSession.updateMany({
        where: { orderId: payment.order_id, emailVerified: true },
        data: { paymentVerified: true, paymentId: payment.id },
      });
    }
  }

  return res.json({ status: 'ok', received: true });
});
