import Stripe from 'stripe';
import { verifyAuth } from './_verifyAuth.js';
import { db } from './_firebaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Resolve (or create) the ONE Stripe customer that belongs to this uid and
 * persist its id on the user doc. Pinning a single customer per uid is what
 * makes the webhook's customer->uid lookup reliable: without it, every
 * checkout minted a fresh customer, so invoice/charge/customer events could
 * resolve to the wrong user or none (audit C3). The customer also carries
 * firebaseUserId in metadata as a second mapping hint.
 */
async function getOrCreateCustomerId(userId, userEmail) {
  const userRef = db.collection('users').doc(userId);
  const stored = (await userRef.get()).data()?.stripeCustomerId || null;

  if (stored) {
    try {
      const existing = await stripe.customers.retrieve(stored);
      if (existing && !existing.deleted) return stored;
    } catch {
      // Stored id no longer resolves in Stripe — fall through and recreate.
    }
  }

  const customer = await stripe.customers.create({
    email: userEmail || undefined,
    metadata: { firebaseUserId: userId },
  });
  await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the caller's Firebase ID token. The uid we use to attribute
  // payment ALWAYS comes from the verified token — never from the request
  // body — so an attacker can't make someone else's account premium.
  const decoded = await verifyAuth(req, res);
  if (!decoded) return;
  const userId = decoded.uid;
  const userEmail = decoded.email;

  try {
    const customerId = await getOrCreateCustomerId(userId, userEmail);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      // Pin the checkout to this uid's single Stripe customer.
      customer: customerId,
      // firebaseUserId is what the webhook uses to locate the Firestore doc.
      metadata: {
        firebaseUserId: userId,
      },
      // subscription_data.metadata so the same uid is on the subscription
      // object too — webhook events that don't include the checkout session
      // (e.g. customer.subscription.updated, customer.subscription.deleted)
      // still get a uid hint without relying on a stripeCustomerId lookup.
      subscription_data: {
        metadata: {
          firebaseUserId: userId,
        },
      },
      // Pass the uid through to the success URL so the client can poll for
      // the webhook-applied premium status on return.
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://dynastytracker.app'}/?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://dynastytracker.app'}/?payment=canceled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    // Log details server-side; return a generic message (audit M6).
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Unable to start checkout. Please try again.' });
  }
}
