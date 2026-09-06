module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://localhost');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});

  // ── Verify the request comes from a real signed-in user ──────────────────
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if(!idToken) return res.status(401).json({error:"Unauthorized - please sign in"});

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_SERVER_KEY}`,
      { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idToken }) }
    );
    const verifyData = await verifyRes.json();
    if(verifyData.error || !verifyData.users || !verifyData.users[0]) {
      return res.status(401).json({error:"Unauthorized - invalid session, please sign in again"});
    }
  } catch(e) {
    return res.status(401).json({error:"Unauthorized - could not verify session"});
  }

  const key = process.env.ANTHROPIC_API_KEY || "";
  const { b64, mime, type } = req.body || {};
  if(!b64) return res.status(400).json({error:"No image data"});
  if(!key) return res.status(400).json({error:"API key missing"});
  try {
    const cat = type==="corp"
      ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz"
      : "grocery|gas|food_out|car|phone|house|other";
    const today = new Date().toISOString().split('T')[0];
    const currentYear = today.slice(0,4);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 25000);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      signal: controller.signal,
      method: "POST",
      headers: {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
      body: JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:400,
        messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:mime||"image/jpeg",data:b64}},
          {type:"text",text:"You are a receipt-parsing API. Today's real-world date is "+today+". Respond with ONLY a raw JSON object, no markdown, no explanation, no preamble. Format: {\"merchant\":\"store name\",\"amount\":0.00,\"hst\":0.00,\"date\":\"YYYY-MM-DD\",\"category\":\"one of: "+cat+"\",\"confidence\":85}. Read the date carefully from the receipt itself. If the year on the receipt is missing, cut off, or genuinely unreadable, use "+currentYear+" as the year (today's year) instead of guessing an older year. Never default to a year before "+currentYear+" unless the receipt clearly and explicitly shows an older year printed on it. If this is not a receipt, still respond with that exact JSON shape using your best guess and confidence:10."}
        ]}]
      })
    });
    clearTimeout(t);
    const d = await r.json();
    if(d.error) return res.status(400).json({error:d.error.message});
    const txt = (d.content||[]).find(b=>b.type==="text")?.text||"{}";
    const match = txt.match(/\{[\s\S]*\}/);
    if(!match) return res.status(500).json({error:"No JSON found in response: " + txt.slice(0,150)});
    try {
      const parsed = JSON.parse(match[0]);
      return res.status(200).json(parsed);
    } catch(parseErr) {
      return res.status(500).json({error:"JSON parse failed: " + match[0].slice(0,150)});
    }
  } catch(e) {
    return res.status(500).json({error: e.name==="AbortError"?"Anthropic timeout 25s":e.message});
  }
};