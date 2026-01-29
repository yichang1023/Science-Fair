// api/generate.js - 2026 強制修復版
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // 設定 CORS (允許網頁跨網域呼叫)
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

        // --- 1. 處理 Groq (Llama 3.1) ---
        if (model.includes('llama') || model.includes('grok')) {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                // 確保 Groq 收到的是正確的 ID
                model: model.includes('70b') ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant",
            });
            output = chatCompletion.choices[0]?.message?.content || "";
        
        // --- 2. 處理 OpenAI (GPT-4o) ---
        } else if (model.includes('gpt')) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                // 簡單映射：如果是 mini 就用 mini，不然都用 4o
                model: model.includes('mini') ? "gpt-4o-mini" : "gpt-4o",
            });
            output = completion.choices[0].message.content;

        // --- 3. 處理 Google (Gemini) ---
        } else {
            // Google 部分：這是報錯的源頭，我們這裡做嚴格檢查
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // ⚠️ 強制修正：如果你傳來的是舊的 gemini-pro，我強制把你轉成 1.5-flash
            let targetModel = model;
            if (model === 'gemini-pro' || !model.includes('1.5')) {
                targetModel = "gemini-1.5-flash"; 
            }

            const geminiModel = genAI.getGenerativeModel({ model: targetModel });
            const result = await geminiModel.generateContent(prompt);
            output = result.response.text();
        }

        const endTime = Date.now();
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        console.error("API Error:", error);
        // 回傳詳細錯誤給前端，方便除錯
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
};
