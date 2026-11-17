import { env } from '../config/env';
import { logger } from '../lib/logger';
import { notFound } from '../lib/errors';
import { Course } from '../models/course';
import { Enrollment, LessonProgress } from '../models/learning';
import { LedgerEntry, Order } from '../models/commerce';
import { User } from '../models/user';

/**
 * Single fulfilment path used by both the Stripe webhook and the built-in
 * mock checkout. Idempotent: replaying a webhook never double-enrolls.
 */
export async function fulfillOrder(orderId: string, providerSessionId?: string) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order not found');

  if (providerSessionId && !order.providerSessionId) {
    order.providerSessionId = providerSessionId as any;
  }

  if (order.status === 'paid') {
    await order.save();
    return order;
  }

  const course = await Course.findById(order.course);
  if (!course) throw notFound('Course no longer exists');

  order.status = 'paid' as any;
  order.paidAt = new Date() as any;
  await order.save();

  await Enrollment.findOneAndUpdate(
    { student: order.student, course: order.course },
    {
      $setOnInsert: {
        student: order.student,
        course: order.course,
        pricePaid: order.amount,
        progressPct: 0,
      },
    },
    { upsert: true },
  );

  const existingLedger = await LedgerEntry.findOne({ order: order._id });
  if (!existingLedger) {
    const gross = order.amount;
    const fee = Math.round((gross * env.platformFeePct) / 100);
    await LedgerEntry.create({
      instructor: order.instructor,
      order: order._id,
      course: order.course,
      student: order.student,
      gross,
      platformFeePct: env.platformFeePct,
      fee,
      net: gross - fee,
      status: 'available',
      availableAt: new Date(),
    });
    await Course.updateOne({ _id: order.course }, { $inc: { 'stats.enrollmentCount': 1 } });
  }

  logger.info({ orderId, courseId: String(order.course) }, 'order fulfilled');
  return order;
}

export async function refundOrder(orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order not found');
  if (order.status === 'refunded') return order;

  order.status = 'refunded' as any;
  order.refundedAt = new Date() as any;
  await order.save();

  await LedgerEntry.updateOne(
    { order: order._id },
    { $set: { status: 'reversed', reversedAt: new Date() } },
  );

  await Enrollment.deleteOne({ student: order.student, course: order.course });
  await LessonProgress.deleteMany({ student: order.student, course: order.course });
  await Course.updateOne({ _id: order.course }, { $inc: { 'stats.enrollmentCount': -1 } });

  logger.info({ orderId }, 'order refunded');
  return order;
}

export async function createPendingOrder(input: {
  studentId: string;
  courseId: string;
  amount: number;
  provider: 'mock' | 'stripe';
  providerSessionId?: string;
}) {
  const course = await Course.findById(input.courseId).lean();
  if (!course) throw notFound('Course not found');

  const order = await Order.create({
    student: input.studentId,
    course: input.courseId,
    instructor: course.instructor,
    amount: input.amount,
    currency: 'usd',
    provider: input.provider,
    providerSessionId: input.providerSessionId ?? null,
    status: 'pending',
  });

  return order;
}

/** Instructor revenue rollup — used by overview, charts and CSV export. */
export async function instructorRevenue(instructorId: string, months = 6) {
  const since = new Date();
  if (months > 0) since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const match: Record<string, unknown> = { instructor: new (require('mongoose').Types.ObjectId)(instructorId) };
  if (months > 0) match.availableAt = { $gte: since };

  const rows = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$availableAt' } },
          status: '$status',
        },
        gross: { $sum: '$gross' },
        fee: { $sum: '$fee' },
        net: { $sum: '$net' },
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  const byMonth = new Map<string, { month: string; gross: number; net: number; fees: number }>();
  for (const row of rows) {
    const key = row._id.month as string;
    const entry = byMonth.get(key) ?? { month: key, gross: 0, net: 0, fees: 0 };
    if (row._id.status === 'reversed') {
      entry.gross -= row.gross;
      entry.net -= row.net;
      entry.fees -= row.fee;
    } else {
      entry.gross += row.gross;
      entry.net += row.net;
      entry.fees += row.fee;
    }
    byMonth.set(key, entry);
  }

  const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  return monthly;
}
