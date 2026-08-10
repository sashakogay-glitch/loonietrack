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

async function getUserDoc(uid) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token = await getFirestoreAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});

  // ── Verify the request comes from a real signed-in user ──────────────────
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if(!idToken) return res.status(401).json({error:"Unauthorized - please sign in"});

  let uid;
  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_SERVER_KEY}`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idToken }) }
    );
    const verifyData = await verifyRes.json();
    if(verifyData.error || !verifyData.users || !verifyData.users[0]) {
      return res.status(401).json({error:"Unauthorized - invalid session, please sign in again"});
    }
    uid = verifyData.users[0].localId;
  } catch(e) {
    return res.status(401).json({error:"Unauthorized - could not verify session"});
  }

  // ── Look up this user's Paddle customer/subscription IDs server-side ──────
  try {
    const doc = await getUserDoc(uid);
    const customerId = doc?.fields?.paddleCustomerId?.stringValue;
    const subscriptionId = doc?.fields?.paddleSubscriptionId?.stringValue;
    if(!customerId) return res.status(400).json({error:"No active subscription found for this account"});

    // TODO: switch to https://api.paddle.com when moving off Paddle Sandbox to Production
    const base = "https://sandbox-api.paddle.com";
    const body = subscriptionId ? { subscription_ids: [subscriptionId] } : {};
    const r = await fetch(`${base}/customers/${customerId}/portal-sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if(!r.ok) return res.status(500).json({ error: data?.error?.detail || "Could not open subscription management" });

    const url = data?.data?.urls?.subscriptions?.[0]?.cancelSubscription
      || data?.data?.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod
      || data?.data?.urls?.general?.overview;

    return res.status(200).json({ url });
  } catch(e) {
    console.error("Portal session error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};