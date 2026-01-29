// api/generate.js - Groq 修復版
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // 1. 設定 CORS (允許網頁跨網域呼叫)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 處理預檢請求 (Preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, model } = req.body;

    try {
        let output = "";
        const startTime = Date.now();

        // === 1. 處理 Groq (Llama 3.1) ===
        if (model.includes('llama') || model.includes('grok')) {
            // [防呆] 檢查 Key 是否存在
            if (!process.env.GROQ_API_KEY) {
                throw new Error("Vercel 後台找不到 GROQ_API_KEY，請先設定並 Redeploy。");
            }

            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                // 確保傳送正確的模型 ID 給 Groq
                model: model.includes('70b') ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant",
                temperature: 0.7, // 稍微增加一點創意度
                max_tokens: 1024,
            });
            
            output = chatCompletion.choices[0]?.message?.content || "(無回應)";
        
        // === 2. 處理 OpenAI (GPT) ===
        } else if (model.includes('gpt')) {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("Vercel 後台找不到 OPENAI_API_KEY。");
            }
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: model.includes('mini') ? "gpt-4o-mini" : "gpt-4o",
            });
            output = completion.choices[0].message.content;

        // === 3. 處理 Google (Gemini) ===
        } else {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("Vercel 後台找不到 GEMINI_API_KEY。");
            }
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // 安全映射：如果型號怪怪的，一律用 flash
            let targetModel = "gemini-1.5-flash";
            if (model.includes("pro") && model.includes("1.5")) {
                targetModel = "gemini-1.5-pro";
            } else if (model.includes("pro") && !model.includes("1.5")) {
                // 處理舊版 gemini-pro 的情況
                targetModel = "gemini-1.5-flash"; 
            }

            const geminiModel = genAI.getGenerativeModel({ model: targetModel });
            const result = await geminiModel.generateContent(prompt);
            output = result.response.text();
        }

        const endTime = Date.now();
        // 成功回傳 JSON
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        console.error("Backend API Error:", error);
        // [關鍵修復] 這裡捕捉錯誤，並回傳 JSON 格式的錯誤訊息，而不是讓伺服器崩潰吐文字
        res.status(500).json({ 
            error: `API 錯誤: ${error.message}`,
            details: error.toString() 
        });
    }
};
