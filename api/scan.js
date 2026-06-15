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
      body: JSON.stringify({model:"claude-sonnet-4-6",max_tokens:400,messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:mime||"image/jpeg",data:b64}},
        {type:"text",text:"Parse receipt. JSON: {merchant,amount,hst,date,category:["+cat+"],confidence}"}
      ]}]})
    });
    clearTimeout(t);
    const d = await r.json();
    if(d.error) return res.status(400).json({error:d.error.message});
    const txt = (d.content||[]).find(b=>b.type==="text")?.text||"{}";
    return res.status(200).json(JSON.parse(txt.replace(/```json|```/g,"").trim()));
  } catch(e) {
    return res.status(500).json({error: e.name==="AbortError"?"Anthropic timeout 25s":e.message});
  }
};