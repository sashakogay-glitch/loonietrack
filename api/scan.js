export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  try {
    const { b64, mime, type } = req.body;
    const isCorP = type === "corp";
    const cat = isCorP
      ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz"
      : "grocery|gas|food_out|car|phone|house|other";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:mime||"image/jpeg",data:b64}},
          {type:"text",text:"Parse receipt. Return JSON only: {merchant, amount, hst, date, category from ["+cat+"], confidence}"}
        ]}]
      })
    });
    const d = await r.json();
    if (d.error) return res.status(400).json({error:d.error.message});
    const txt = (d.content||[]).find(b=>b.type==="text")?.text || "{}";
    return res.status(200).json(JSON.parse(txt.replace(/```json|```/g,"").trim()));
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
}