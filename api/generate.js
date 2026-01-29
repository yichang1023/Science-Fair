const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // 1. CORS 設定
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

        // === 策略 A: Groq ===
        if (model.includes('llama') || model.includes('grok')) {
             if (!process.env.GROQ_API_KEY) throw new Error("缺少 GROQ_API_KEY");
             const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
             const target = model.includes("70b") ? "llama-3.1-70b-versatile" : "llama-3.1-8b-instant";
             const completion = await groq.chat.completions.create({
                 messages: [{ role: "user", content: prompt }],
                 model: target,
             });
             output = completion.choices[0]?.message?.content || "";

        // === 策略 B: OpenAI ===
        } else if (model.includes('gpt')) {
             if (!process.env.OPENAI_API_KEY) throw new Error("缺少 OPENAI_API_KEY");
             const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
             const completion = await openai.chat.completions.create({
                 messages: [{ role: "user", content: prompt }],
                 model: model.includes('mini') ? "gpt-4o-mini" : "gpt-4o",
             });
             output = completion.choices[0].message.content;

        // === 策略 C: Google (Gemini) ===
        } else {
             if (!process.env.GEMINI_API_KEY) throw new Error("缺少 GEMINI_API_KEY");
             
             // [關鍵] 這裡不檢查版本，因為 package.json 已經強制更新了
             const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
             
             // [指定模型] 只有 1.5 Flash 是目前最穩定的免費模型
             // 如果這個還報錯 404，那就一定是 package.json 沒生效
             const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
             
             const result = await geminiModel.generateContent(prompt);
             output = result.response.text();
        }

        const endTime = Date.now();
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        console.error("Server Error:", error);
        
        // 幫你把錯誤訊息翻譯成中文，讓你知道下一步怎麼做
        let errorMsg = `API 錯誤: ${error.message}`;
        if (error.message.includes("404") && error.message.includes("gemini-1.5-flash")) {
             errorMsg = "核心錯誤：Vercel 尚未安裝新版驅動。請確認 GitHub 上的 package.json 裡的 @google/generative-ai 是 ^0.21.0 版本，並重新部署。";
        }

        res.status(500).json({ 
            error: errorMsg,
            details: error.toString() 
        });
    }
};
