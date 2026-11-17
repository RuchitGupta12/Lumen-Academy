import { Router } from 'express';
import { env, isStripeEnabled } from '../config/env';
import { ApiError, asyncHandler, badRequest, conflict, forbidden, notFound, send } from '../lib/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { Course } from '../models/course';
import { Enrollment } from '../models/learning';
import { Order } from '../models/commerce';
import { User } from '../models/user';
import { createPendingOrder, fulfillOrder, refundOrder } from '../services/payments';
import { createStripeCheckout, retrieveStripeSession } from '../lib/stripe';
import { liveMode } from '../services/livekit';

const router = Router();

router.get(
  '/config',
  asyncHandler(async (_req, res) =>
    send(res, {
      payments: isStripeEnabled() ? 'stripe' : 'mock',
      live: liveMode(),
      platformFeePct: env.platformFeePct,
    }),
  ),
);

router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) throw badRequest('courseId is required');

    const course = await Course.findById(courseId).lean();
    if (!course || course.status !== 'published') throw notFound('Course not found');

    const existing = await Enrollment.findOne({ student: req.auth!.userId, course: course._id }).lean();
    if (existing) throw conflict('You already own this course');

    if ((course.price ?? 0) === 0) {
      await Enrollment.create({
        student: req.auth!.userId,
        course: course._id,
        pricePaid: 0,
        progressPct: 0,
      });
      await Course.updateOne({ _id: course._id }, { $inc: { 'stats.enrollmentCount': 1 } });
      return send(res, { mode: 'free', courseSlug: course.slug, enrolled: true });
    }

    if (isStripeEnabled()) {
      const order = await createPendingOrder({
        studentId: req.auth!.userId,
        courseId: String(course._id),
        amount: course.price,
        provider: 'stripe',
      });
      const session = await createStripeCheckout({
        orderId: String(order._id),
        courseTitle: course.title,
        amount: course.price,
        customerEmail: (await User.findById(req.auth!.userId).lean())?.email ?? '',
        courseSlug: course.slug,
      });
      order.providerSessionId = session.id as any;
      await order.save();
      return send(res, {
        mode: 'stripe',
        orderId: String(order._id),
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }

    const order = await createPendingOrder({
      studentId: req.auth!.userId,
      courseId: String(course._id),
      amount: course.price,
      provider: 'mock',
    });
    return send(res, {
      mode: 'mock',
      orderId: String(order._id),
      checkoutUrl: `/checkout/${order._id}`,
      amount: course.price,
    });
  }),
);

router.get(
  '/orders/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(String(req.params.orderId))
      .populate('course', 'title slug cover price price instructor')
      .populate('instructor', 'name')
      .lean();
    if (!order) throw notFound('Order not found');
    if (String(order.student) !== req.auth!.userId && req.auth!.role !== 'admin') {
      throw forbidden('This order belongs to another account');
    }

    const course: any = order.course;
    return send(res, {
      id: String(order._id),
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      provider: order.provider,
      providerSessionId: order.providerSessionId,
      createdAt: order.createdAt,
      course: course
        ? {
            id: String(course._id),
            title: course.title,
            slug: course.slug,
            cover: course.cover,
            instructorName: (order as any).instructor?.name ?? '',
          }
        : null,
      paymentsMode: isStripeEnabled() ? 'stripe' : 'mock',
    });
  }),
);

router.post(
  '/orders/:orderId/pay',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(String(req.params.orderId));
    if (!order) throw notFound('Order not found');
    if (String(order.student) !== req.auth!.userId) throw forbidden('This order belongs to another account');
    if (order.provider === 'stripe' && isStripeEnabled()) {
      throw badRequest('Complete payment in the Stripe checkout window');
    }
    if (order.status === 'refunded') throw badRequest('This order was refunded');

    // Mock gateway: simulates a card authorisation. Real money never moves.
    const card = (req.body as { card?: string }).card ?? '4242424242424242';
    if (card.replace(/\s/g, '').endsWith('0002')) {
      order.status = 'failed' as any;
      await order.save();
      throw new ApiError(402, 'card_declined', 'Your card was declined (test card ending 0002)');
    }

    await fulfillOrder(String(order._id));
    const course = await Course.findById(order.course).lean();
    return send(res, { paid: true, courseSlug: course?.slug ?? null });
  }),
);

router.post(
  '/checkout/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId || !isStripeEnabled()) throw badRequest('Stripe session not available');
    const session = await retrieveStripeSession(sessionId);
    const orderId = session.metadata?.orderId;
    if (!orderId) throw badRequest('Session is missing its order');

    if (session.payment_status === 'paid') {
      await fulfillOrder(orderId, sessionId);
    }
    const order = await Order.findById(orderId).populate('course', 'slug').lean();
    return send(res, {
      status: session.payment_status,
      courseSlug: (order as any)?.course?.slug ?? null,
    });
  }),
);

router.post(
  '/orders/:orderId/refund',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const order = await refundOrder(String(req.params.orderId));
    return send(res, { refunded: true, status: order.status });
  }),
);

export default router;
