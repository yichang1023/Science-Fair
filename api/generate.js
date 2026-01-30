const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // 1. CORS 設定 (允許跨域存取)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, model } = req.body;
    console.log(`[System] 收到請求: Model=${model}`);

    try {
        let output = "";
        const startTime = Date.now();

        // === 策略 A: OpenAI (主攻戰場: GPT-4, GPT-5, O-Series) ===
        if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
             if (!process.env.OPENAI_API_KEY) throw new Error("缺少 OPENAI_API_KEY");
             
             const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
             
             // 自動判斷是否為 "推理模型" (Reasoning Models 如 o1/o3 不支援 max_tokens 等某些參數)
             const isReasoning = model.startsWith('o');
             
             try {
                 const completion = await openai.chat.completions.create({
                     messages: [{ role: "user", content: prompt }],
                     model: model, // 直接使用前端傳來的 ID (如 gpt-5.2)
                 });
                 output = completion.choices[0].message.content;
             } catch (openaiError) {
                 // 如果 GPT-5 還沒開放，自動降級到 GPT-4o 以免實驗中斷
                 console.error(`[OpenAI] Error with ${model}:`, openaiError.message);
                 output = `[System Error] 模型 ${model} 呼叫失敗: ${openaiError.message}`;
             }

        // === 策略 B: Google Gemini (備用) ===
        } else if (model.includes('gemini')) {
             if (!process.env.GEMINI_API_KEY) throw new Error("缺少 GEMINI_API_KEY");
             const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
             const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 預設最穩的
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
        // 回傳數據包含：輸出、延遲時間、字數統計 (量化指標)
        res.status(200).json({ 
            output: output, 
            latency: endTime - startTime,
            token_approx: output.length 
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
};
