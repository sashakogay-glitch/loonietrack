module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const key = process.env.REACT_APP_ANTHROPIC_KEY || "";
  const { b64, mime, type } = req.body || {};
  if(!b64) return res.status(400).json({error:"No image data"});
  if(!key) return res.status(400).json({error:"API key missing"});
  try {
    const cat = type==="corp"
      ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz"
      : "grocery|gas|food_out|car|phone|house|other";
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
          {type:"text",text:"You are a receipt-parsing API. Respond with ONLY a raw JSON object, no markdown, no explanation, no preamble. Format: {\"merchant\":\"store name\",\"amount\":0.00,\"hst\":0.00,\"date\":\"YYYY-MM-DD\",\"category\":\"one of: "+cat+"\",\"confidence\":85}. If this is not a receipt, still respond with that exact JSON shape using your best guess and confidence:10."}
        ]}]
      })
    });
    clearTimeout(t);
    const d = await r.json();
    if(d.error) return res.status(400).json({error:d.error.message});
    const txt = (d.content||[]).find(b=>b.type==="text")?.text||"{}";
    // Robust JSON extraction: find first {...} block even if there's surrounding text
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