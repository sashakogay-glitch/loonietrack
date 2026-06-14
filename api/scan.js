sed -i '1s/^/export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };\n\n/' api/scan.jsexport default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const { b64, mime, type } = req.body;
  if(!b64 || !mime) return res.status(400).json({error:"Missing image data"});
  const catList = type==="corp" ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz" : "grocery|gas|food_out|car|phone|house|other";
  const catGuide = type==="corp" ? "meals=restaurant/food, vehicle=gas/parking/uber, equipment=electronics/software, phone_biz=phone/internet, home_office=rent/utilities, marketing=ads/printing, professional=lawyer/accountant, office_sup=supplies, other_biz=anything else" : "grocery=supermarket, gas=fuel/petro/shell, food_out=restaurant/cafe/takeout, car=lease/insurance/mechanic, phone=rogers/bell/telus, house=rent/hydro/utilities, other=everything else";
  const taxTagPart = type !== "corp" ? ',"taxTag":"medical|donations|childcare|none"' : "";
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: b64 } }, { type: "text", text: `Parse this receipt. Return ONLY valid JSON:\n{"merchant":"name","amount":23.45,"hst":2.71,"date":"YYYY-MM-DD","category":"${catList}","confidence":85${taxTagPart}}\n${catGuide}.` }] }] })
    });
    const data = await response.json();
    if(data.error) return res.status(400).json({error:`${data.error.type}: ${data.error.message}`});
    const txt = data.content?.find(b => b.type==="text")?.text || "{}";
    try { return res.status(200).json(JSON.parse(txt.replace(/```json|```/g,"").trim())); }
    catch { return res.status(500).json({error:`Parse failed: ${txt.slice(0,100)}`}); }
  } catch(err) { return res.status(500).json({error: err.message}); }
}
