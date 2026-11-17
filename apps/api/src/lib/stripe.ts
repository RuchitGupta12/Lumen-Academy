import Stripe from 'stripe';
import { env, isStripeEnabled } from '../config/env';
import { badRequest } from '../lib/errors';

let client: Stripe | null = null;

export function stripeClient() {
  if (!isStripeEnabled()) throw badRequest('Stripe is not configured');
  if (!client) client = new Stripe(env.stripeSecretKey);
  return client;
}

export interface CheckoutSessionInput {
  orderId: string;
  courseTitle: string;
  amount: number;
  customerEmail: string;
  courseSlug: string;
}

export async function createStripeCheckout(input: CheckoutSessionInput) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: input.amount,
          product_data: {
            name: input.courseTitle,
            description: 'Lumen Academy — lifetime access',
          },
        },
      },
    ],
    metadata: { orderId: input.orderId },
    success_url: `${env.clientOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientOrigin}/courses/${input.courseSlug}`,
    allow_promotion_codes: true,
  });
  return session;
}

export async function retrieveStripeSession(sessionId: string) {
  const stripe = stripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}
