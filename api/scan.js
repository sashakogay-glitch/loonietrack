export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  try {
    const { b64, mime, type } = req.body;
    const cat = type==="corp" ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz" : "grocery|gas|food_out|car|phone|house|other";
    const tax = type!=="corp" ? ",\"taxTag\":\"medical|donations|childcare|none\"" : "";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":process.env.REACT_APP_ANTHROPIC_KEY,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:400,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime||"image/jpeg",data:b64}},{type:"text",text:"Parse receipt. JSON only: {\"merchant\":\"?\",\"amount\":0.00,\"hst\":0.00,\"date\":\"YYYY-MM-DD\",\"category\":\""+cat+"\",\"confidence\":85"+tax+"}"}]}]})
    });
    const d = await r.json();
    if(d.error) return res.status(400).json({error:d.error.message});
    const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
    return res.status(200).json(JSON.parse(txt.replace(/```json|```/g,"").trim()));
  } catch(e) { return res.status(500).json({error:e.message}); }
}
