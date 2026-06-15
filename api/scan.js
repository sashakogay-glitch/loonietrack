export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  
  const key = process.env.REACT_APP_ANTHROPIC_KEY;
  console.log("Key present:", !!key, "Key start:", key ? key.slice(0,15) : "MISSING");
  console.log("Body keys:", req.body ? Object.keys(req.body) : "NO BODY");
  console.log("b64 length:", req.body?.b64?.length || 0);
  
  try {
    const { b64, mime, type } = req.body || {};
    if(!b64) return res.status(400).json({error: "No image data received"});
    if(!key) return res.status(400).json({error: "API key missing on server"});
    
    const cat = type === "corp"
      ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz"
      : "grocery|gas|food_out|car|phone|house|other";
    
    console.log("Calling Anthropic API...");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            {type:"image", source:{type:"base64", media_type: mime||"image/jpeg", data: b64}},
            {type:"text", text:"Parse receipt. Return JSON only: {merchant, amount, hst, date, category from ["+cat+"], confidence}"}
          ]
        }]
      })
    });
    
    console.log("Anthropic status:", r.status);
    const d = await r.json();
    console.log("Anthropic response:", JSON.stringify(d).slice(0,200));
    
    if (d.error) return res.status(400).json({error: d.error.message});
    const txt = (d.content||[]).find(b=>b.type==="text")?.text || "{}";
    return res.status(200).json(JSON.parse(txt.replace(/```json|```/g,"").trim()));
  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({error: e.message});
  }
}