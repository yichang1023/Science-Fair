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
             
             const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
             
             // [絕對指令] 不管前端傳什麼，這裡強制鎖定 1.5 Flash
             // 這是目前唯一保證能用的免費模型
             console.log("正在強制呼叫 gemini-1.5-flash...");
             const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
             
             const result = await geminiModel.generateContent(prompt);
             output = result.response.text();
        }

        const endTime = Date.now();
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        console.error("Server Error:", error);
        
        let errorMsg = `API 錯誤: ${error.message}`;
        
        // 如果這裡報錯說 "gemini-1.5-flash not found"，那就是 package.json 沒更新
        if (error.message.includes("not found") && error.message.includes("1.5-flash")) {
             errorMsg = "嚴重錯誤：Vercel 正在使用舊版驅動程式，不認識 1.5 Flash。請檢查 package.json 版本是否為 ^0.21.0";
        }

        res.status(500).json({ 
            error: errorMsg,
            details: error.toString() 
        });
    }
};
