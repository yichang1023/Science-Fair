// api/models.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const models = await client.models.list();

    // 只回傳 model id，最乾淨
    const ids = models.data.map(m => m.id);

    res.status(200).json({
      count: ids.length,
      models: ids,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}
