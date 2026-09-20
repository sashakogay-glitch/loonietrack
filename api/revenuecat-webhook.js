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

async function updatePlan(userId, plan) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = await getFirestoreAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
  const body = { fields: { plan: { stringValue: plan }, source: { stringValue: "play" } } };
  const res = await fetch(url + "?updateMask.fieldPaths=plan&updateMask.fieldPaths=source", {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Firestore PATCH failed: " + (await res.text()));
  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization || "";
  if (!process.env.RC_WEBHOOK_SECRET || auth !== process.env.RC_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const event = req.body && req.body.event;
    if (!event) return res.status(400).json({ error: "No event" });

    const uid = event.app_user_id;
    if (!uid) return res.status(400).json({ error: "No app_user_id" });

    const ents = event.entitlement_ids || [];
    const type = event.type;

    const ENDED = ["EXPIRATION", "REFUND", "SUBSCRIPTION_PAUSED"];
    let plan = null;

    if (ENDED.includes(type)) {
      plan = "free";
    } else if (ents.includes("business")) {
      plan = "business";
    } else if (ents.includes("personal")) {
      plan = "personal";
    }

    if (plan) await updatePlan(uid, plan);
    return res.status(200).json({ ok: true, plan });
  } catch (e) {
    console.error("RevenueCat webhook error", e);
    return res.status(500).json({ error: String(e.message || e) });
  }
};
