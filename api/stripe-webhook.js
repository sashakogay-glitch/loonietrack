const Stripe = require("stripe");
module.exports.config = { api: { bodyParser: false } };
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function getAccessToken() {
  const { GoogleAuth } = require("google-auth-library");
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}
async function updateFirestore(userId, plan, customerId, subscriptionId) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
  const body = {
    fields: {
      plan: { stringValue: plan },
      stripeCustomerId: { stringValue: customerId || "" },
      subscriptionId: { stringValue: subscriptionId || "" },
    }
  };
  const res = await fetch(url + "?updateMask.fieldPaths=plan&updateMask.fieldPaths=stripeCustomerId&updateMask.fieldPaths=subscriptionId", {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Firestore PATCH failed: " + err);
  }
  return res.json();
}

// Find the Firestore userId by the Stripe customer ID (needed for renewal events,
// which don't carry client_reference_id like the initial checkout does).
async function findUserByCustomerId(customerId) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "stripeCustomerId" },
            op: "EQUAL",
            value: { stringValue: customerId },
          }
        },
        limit: 1,
      }
    }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const docRow = (rows || []).find(r => r.document);
  if (!docRow) return null;
  const name = docRow.document.name; // .../documents/users/{userId}
  return name.split("/").pop();
}

// Map a Stripe price ID back to our plan name (for restoring the correct plan on renewal).
function planFromPriceId(priceId) {
  if (priceId === "price_1TjScOB9AP57Tw0HZ19oxRzy") return "personal";
  if (priceId === "price_1TjSfhB9AP57Tw0H13vLpuUN") return "business";
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await getRawBody(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).json({ error: err.message });
  }

  try {
    // ── First payment (initial checkout) ─────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const plan = session.metadata?.plan;
      console.log("Payment completed:", { userId, plan });
      if (userId && plan) {
        await updateFirestore(userId, plan, session.customer, session.subscription);
        console.log("Firestore updated for user:", userId);
      }
    }

    // ── Failed renewal charge → downgrade to free ────────────────────────────
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      console.log("Renewal payment FAILED for customer:", customerId);
      const userId = await findUserByCustomerId(customerId);
      if (userId) {
        await updateFirestore(userId, "free", customerId, invoice.subscription || "");
        console.log("User downgraded to free after failed payment:", userId);
      } else {
        console.error("No user found for customer:", customerId);
      }
    }

    // ── Successful renewal → confirm/restore plan ────────────────────────────
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      const priceId = invoice.lines?.data?.[0]?.price?.id;
      const plan = planFromPriceId(priceId);
      if (plan) {
        const userId = await findUserByCustomerId(customerId);
        if (userId) {
          await updateFirestore(userId, plan, customerId, invoice.subscription || "");
          console.log("Renewal confirmed, plan set:", { userId, plan });
        }
      }
    }

    // ── Subscription cancelled entirely → downgrade to free ──────────────────
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId = sub.customer;
      console.log("Subscription cancelled for customer:", customerId);
      const userId = await findUserByCustomerId(customerId);
      if (userId) {
        await updateFirestore(userId, "free", customerId, "");
        console.log("User downgraded to free after cancellation:", userId);
      }
    }
  } catch (e) {
    console.error("Webhook processing error:", e.message);
    // Still return 200 so Stripe doesn't endlessly retry — errors are logged for review.
  }

  res.status(200).json({ received: true });
};