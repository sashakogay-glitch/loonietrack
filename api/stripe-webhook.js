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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const plan = session.metadata?.plan;
    console.log("Payment completed:", { userId, plan });

    if (userId && plan) {
      try {
        await updateFirestore(userId, plan, session.customer, session.subscription);
        console.log("Firestore updated for user:", userId);
      } catch (e) {
        console.error("Firestore error:", e.message);
      }
    }
  }

  res.status(200).json({ received: true });
};