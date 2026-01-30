const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // 1. CORS 設定 (允許跨域)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, model } = req.body;
    console.log(`[System V6.0] 收到請求: Model=${model}`); // Log 版本號

    try {
        let output = "";
        const startTime = Date.now();

        // === 策略 A: OpenAI (全系列支援: GPT-4, GPT-5, O-Series) ===
        // 只要是 gpt 開頭或是 o 開頭 (o1, o3)，全部送往 OpenAI
        if (model.startsWith('gpt') || model.startsWith('o') || model.startsWith('chatgpt')) {
             if (!process.env.OPENAI_API_KEY) throw new Error("缺少 OPENAI_API_KEY");
             
             const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
             
             try {
                 const completion = await openai.chat.completions.create({
                     messages: [{ role: "user", content: prompt }],
                     model: model, 
                 });
                 output = completion.choices[0].message.content;
             } catch (e) {
                 console.error(`[OpenAI Error] ${model} 失敗:`, e.message);
                 output = `[API Error] 模型呼叫失敗 (${model}): ${e.message}`;
             }

        // === 策略 B: Google Gemini (備用) ===
        } else if (model.includes('gemini')) {
             if (!process.env.GEMINI_API_KEY) throw new Error("缺少 GEMINI_API_KEY");
             const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
             const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
             const result = await geminiModel.generateContent(prompt);
             output = result.response.text();

        // === 策略 C: Groq Llama (備用) ===
        } else {
             if (!process.env.GROQ_API_KEY) throw new Error("缺少 GROQ_API_KEY");
             const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
             const completion = await groq.chat.completions.create({
                 messages: [{ role: "user", content: prompt }],
                 model: "llama-3.1-70b-versatile",
             });
             output = completion.choices[0]?.message?.content || "";
        }

        const endTime = Date.now();
        
        // 回傳標準化數據
        res.status(200).json({ 
            output: output, 
            latency: endTime - startTime,
            token_approx: output.length 
        });

    } catch (error) {
        console.error("Critical Server Error:", error);
        res.status(500).json({ error: error.message });
    }
};
