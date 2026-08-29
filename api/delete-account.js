const STORAGE_BUCKET = "loonietrack-4c0d2.firebasestorage.app";

async function getGoogleAccessToken() {
  const { GoogleAuth } = require("google-auth-library");
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function getUserDoc(uid, token) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function deleteFirestoreDoc(uid, token) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  await fetch(url, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
}

async function deleteAllReceipts(uid, token) {
  // List every object under receipts/{uid}/ then delete each one.
  const prefix = encodeURIComponent(`receipts/${uid}/`);
  const listUrl = `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o?prefix=${prefix}`;
  const listRes = await fetch(listUrl, { headers: { "Authorization": `Bearer ${token}` } });
  if (!listRes.ok) return;
  const data = await listRes.json();
  const items = data.items || [];
  await Promise.all(items.map(item => {
    const objUrl = `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o/${encodeURIComponent(item.name)}`;
    return fetch(objUrl, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
  }));
}

async function cancelPaddleSubscription(subscriptionId) {
  if (!subscriptionId) return;
  try {
    const base = "https://api.paddle.com";
    await fetch(`${base}/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PADDLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "immediately" }),
    });
  } catch (e) {
    console.error("Paddle cancel failed (continuing with deletion):", e.message);
  }
}

async function deleteFirebaseAuthUser(uid, token) {
  // Admin-level delete using our service account (via localId) — unlike the
  // self-service idToken path, this has NO "recent login" requirement.
  const res = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error("AUTH_DELETE_FAILED:" + (data?.error?.message || res.status));
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: "Unauthorized - please sign in" });

  let uid;
  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_SERVER_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
    );
    const verifyData = await verifyRes.json();
    if (verifyData.error || !verifyData.users || !verifyData.users[0]) {
      return res.status(401).json({ error: "Unauthorized - invalid session, please sign in again" });
    }
    uid = verifyData.users[0].localId;
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized - could not verify session" });
  }

  try {
    const token = await getGoogleAccessToken();
    const doc = await getUserDoc(uid, token);
    const subscriptionId = doc?.fields?.paddleSubscriptionId?.stringValue;

    await cancelPaddleSubscription(subscriptionId);
    await deleteAllReceipts(uid, token);
    await deleteFirestoreDoc(uid, token);
    await deleteFirebaseAuthUser(uid, token);

    return res.status(200).json({ deleted: true });
  } catch (e) {
    console.error("Account deletion error:", e.message);
    return res.status(500).json({ error: "Something went wrong deleting your account. Please contact hello@loonietrack.ca." });
  }
};