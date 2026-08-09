const crypto = require("crypto");

module.exports.config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => p.split("="))
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;
  const signedPayload = `${ts}:${rawBody.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1));
  } catch (e) {
    return false;
  }
}

async function getFirestoreAccessToken() {
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

async function updateFirestore(userId, plan, paddleCustomerId, paddleSubscriptionId) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = await getFirestoreAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
  const body = {
    fields: {
      plan: { stringValue: plan },
      paddleCustomerId: { stringValue: paddleCustomerId || "" },
      paddleSubscriptionId: { stringValue: paddleSubscriptionId || "" },
    },
  };
  const res = await fetch(
    url + "?updateMask.fieldPaths=plan&updateMask.fieldPaths=paddleCustomerId&updateMask.fieldPaths=paddleSubscriptionId",
    {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Firestore PATCH failed: " + err);
  }
  return res.json();
}

// Map a Paddle price ID back to our plan name.
function planFromPriceId(priceId) {
  if (priceId === "pri_01kzkgfpmw8pp3d725t63s1rd2") return "personal";
  if (priceId === "pri_01kzkg9gwswynch2gh2y9ay7ch") return "business";
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers["paddle-signature"];
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!verifyPaddleSignature(rawBody, signature, webhookSecret)) {
    console.error("Paddle webhook signature verification failed");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const eventType = event.event_type;
  const data = event.data || {};
  const customData = data.custom_data || {};

  try {
    // ── First purchase / subscription created ──────────────────────────────
    if (eventType === "transaction.completed" || eventType === "subscription.created") {
      const userId = customData.userId;
      const priceId = data.items?.[0]?.price?.id || data.items?.[0]?.price_id;
      const plan = customData.plan || planFromPriceId(priceId);
      const customerId = data.customer_id;
      const subscriptionId = data.subscription_id || data.id;
      console.log("Paddle purchase:", { userId, plan, eventType });
      if (userId && plan) {
        await updateFirestore(userId, plan, customerId, subscriptionId);
      }
    }

    // ── Catch-all subscription state changes (renewals, cancellations, pauses) ──
    if (eventType === "subscription.updated") {
      const status = data.status; // active | canceled | past_due | paused | trialing
      const customerId = data.customer_id;
      const subscriptionId = data.id;
      const priceId = data.items?.[0]?.price?.id;
      const userId = customData.userId;

      if (userId) {
        if (status === "active" || status === "trialing") {
          const plan = customData.plan || planFromPriceId(priceId);
          if (plan) await updateFirestore(userId, plan, customerId, subscriptionId);
        } else {
          // canceled, past_due, paused — downgrade to free
          await updateFirestore(userId, "free", customerId, subscriptionId);
        }
        console.log("Subscription updated:", { userId, status });
      }
    }

    if (eventType === "subscription.canceled") {
      const userId = customData.userId;
      if (userId) {
        await updateFirestore(userId, "free", data.customer_id, data.id);
        console.log("Subscription canceled, downgraded:", userId);
      }
    }
  } catch (e) {
    console.error("Paddle webhook processing error:", e.message);
    // Still return 200 so Paddle doesn't endlessly retry — errors are logged for review.
  }

  res.status(200).json({ received: true });
};