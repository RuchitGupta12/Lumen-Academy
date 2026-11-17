import express, { Router } from 'express';
import { env, isStripeEnabled } from '../config/env';
import { logger } from '../lib/logger';
import { stripeClient } from '../lib/stripe';
import { fulfillOrder } from '../services/payments';
import { Order } from '../models/commerce';

const router = Router();

/**
 * Mounted before express.json() so the raw body survives signature verification.
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!isStripeEnabled()) {
      return res.status(400).json({ ok: false, error: { code: 'not_configured', message: 'Stripe is off' } });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ ok: false, error: { code: 'bad_signature', message: 'Missing signature' } });
    }

    let event: any;
    try {
      event = stripeClient().webhooks.constructEvent(
        req.body,
        signature,
        env.stripeWebhookSecret,
      );
    } catch (error) {
      logger.warn({ error }, 'stripe webhook signature rejected');
      return res.status(400).json({ ok: false, error: { code: 'bad_signature', message: 'Invalid signature' } });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const orderId =
            session.metadata?.orderId ??
            (await Order.findOne({ providerSessionId: session.id }).lean())?._id;
          if (orderId) await fulfillOrder(String(orderId), session.id);
          break;
        }
        case 'checkout.session.expired': {
          const session = event.data.object as any;
          await Order.updateOne(
            { providerSessionId: session.id, status: 'pending' },
            { $set: { status: 'failed' } },
          );
          break;
        }
        default:
          logger.debug({ type: event.type }, 'stripe event ignored');
      }
      return res.json({ ok: true, received: true });
    } catch (error) {
      logger.error({ error, type: event.type }, 'stripe webhook failed');
      return res.status(500).json({ ok: false, error: { code: 'webhook_failed', message: 'Retry' } });
    }
  },
);

export default router;
