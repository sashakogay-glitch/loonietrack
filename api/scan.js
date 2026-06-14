export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { b64, mime, type } = req.body;
  if (!b64 || !mime) {
    return res.status(400).json({ error: "Missing image data" });
  }

  const isCorP = type === "corp";
  const catList = isCorP
    ? "meals|vehicle|equipment|phone_biz|home_office|marketing|professional|office_sup|other_biz"
    : "grocery|gas|food_out|car|phone|house|other";

  const taxTag = isCorP ? "" : ',"taxTag":"medical|donations|childcare|none"';

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
            { type: "text", text: "Parse receipt. Return ONLY JSON: {\"merchant\":\"name\",\"amount\":0.00,\"hst\":0.00,\"date\":\"YYYY-MM-DD\",\"category\":\"" + catList + "\",\"confidence\":85" + taxTag + "}" }
          ]
        }]
      })
    });

    const d = await r.json();
    if (d.error) return res.status(400).json({ error: d.error.message });

    const txt = d.content?.find(b => b.type === "text")?.text || "{}";
    const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}