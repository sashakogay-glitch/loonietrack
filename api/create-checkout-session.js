const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  personal: "price_1TnNf7BSXJwCfBy36QSqdUsm",
  business: "price_1TnNf6BSXJwCfBy3Woca1sCv"
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { plan, userId, email } = req.body || {};
  const priceId = PRICES[plan];
  if (!priceId) return res.status(400).json({ error: "Invalid plan" });
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer_email: email || undefined,
      metadata: { plan, userId },
      success_url: `${req.headers.origin}/?upgrade=success`,
      cancel_url: `${req.headers.origin}/?upgrade=cancelled`
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};