const Stripe = require("stripe");

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

  // ── Look up this user's Stripe customer ID server-side (never trust a client-supplied ID) ──
  try {
    const doc = await getUserDoc(uid);
    const customerId = doc?.fields?.stripeCustomerId?.stringValue;
    if(!customerId) return res.status(400).json({error:"No active subscription found for this account"});

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://loonietrack.ca/",
    });
    return res.status(200).json({ url: session.url });
  } catch(e) {
    console.error("Portal session error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};