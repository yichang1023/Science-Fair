// api/generate.js
// POST /api/generate
// body: { prompt: string, model?: string, temperature?: number }

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { prompt, model, temperature } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      res.status(400).send("Missing or invalid 'prompt'");
      return;
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      res.status(500).send("Missing GEMINI_API_KEY in environment variables.");
      return;
    }

    const usedModel = model || process.env.DEFAULT_MODEL || "gemini-1.5-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(usedModel)}:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;

    const t0 = Date.now();

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: typeof temperature === "number" ? temperature : 0.2,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - t0;

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).send(errText);
      return;
    }

    const data = await resp.json();
    const outputText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    res.status(200).json({
      ok: true,
      model: usedModel,
      latencyMs,
      outputText,
      raw: data,
    });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
};

