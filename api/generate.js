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

    try {
        let output = "";
        const startTime = Date.now();

        // === 策略 A: Groq (Llama) ===
        if (model.includes('llama') || model.includes('grok')) {
             if (typeof Groq === 'undefined') throw new Error("缺少 groq-sdk，請檢查 package.json");
             if (!process.env.GROQ_API_KEY) throw new Error("Vercel 缺少 GROQ_API_KEY");
             
             const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
             // 確保使用正確 ID
             const target = model.includes("70b") ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant";
             
             const completion = await groq.chat.completions.create({
                 messages: [{ role: "user", content: prompt }],
                 model: target,
             });
             output = completion.choices[0]?.message?.content || "";

        // === 策略 B: OpenAI (GPT) ===
        } else if (model.includes('gpt')) {
             if (!process.env.OPENAI_API_KEY) throw new Error("Vercel 缺少 OPENAI_API_KEY");
             
             const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
             const completion = await openai.chat.completions.create({
                 messages: [{ role: "user", content: prompt }],
                 model: model.includes('mini') ? "gpt-4o-mini" : "gpt-4o",
             });
             output = completion.choices[0].message.content;

        // === 策略 C: Google (Gemini) - 智慧修復區 ===
        } else {
             if (!process.env.GEMINI_API_KEY) throw new Error("Vercel 缺少 GEMINI_API_KEY");
             
             const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
             
             // [關鍵修復 1] 強制使用精確版本號 (避免 404)
             // 嘗試順序: 1.5 Flash-001 -> 1.5 Pro-001 -> Pro (1.0)
             let targetModel = "gemini-1.5-flash-001"; // 預設用最穩的 001 版

             if (model.includes("pro") && model.includes("1.5")) {
                 targetModel = "gemini-1.5-pro-001";
             } else if (model === "gemini-pro" || model.includes("1.0")) {
                 targetModel = "gemini-pro";
             }

             console.log(`[Google] 嘗試呼叫模型: ${targetModel}`);

             try {
                 const geminiModel = genAI.getGenerativeModel({ model: targetModel });
                 const result = await geminiModel.generateContent(prompt);
                 output = result.response.text();
             } catch (geminiError) {
                 console.error(`[Google] ${targetModel} 失敗，嘗試降級...`);
                 
                 // [關鍵修復 2] 自動降級機制
                 // 如果 1.5 失敗 (404)，自動切換回最舊的 gemini-pro (1.0)，保證有回答
                 if (geminiError.message.includes("404") || geminiError.message.includes("not found")) {
                     const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
                     const fallbackResult = await fallbackModel.generateContent(prompt);
                     output = fallbackResult.response.text() + "\n(註：系統自動降級至 Gemini 1.0)";
                 } else {
                     throw geminiError; // 其他錯誤就拋出
                 }
             }
        }

        const endTime = Date.now();
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ 
            error: `API 錯誤 (${error.message})`,
            details: error.toString() 
        });
    }
};
