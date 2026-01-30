const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, model } = req.body;
    console.log(`[V6.0 Request] Model: ${model}`);

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Server Error: Missing OPENAI_API_KEY.");
        }

        const startTime = Date.now();
        const isReasoning = model.startsWith('o');

        const completion = await openai.chat.completions.create({
            model: model,
            messages: [{ role: "user", content: prompt }],
            temperature: isReasoning ? 1 : 0.7, 
        });

        const output = completion.choices[0].message.content;
        const endTime = Date.now();

        res.status(200).json({
            output: output,
            latency: endTime - startTime,
            length: output.length,
            model_used: model
        });

    } catch (error) {
        console.error("[API Error]", error);
        res.status(500).json({ 
            error: error.message || "Unknown API Error"
        });
    }
};
