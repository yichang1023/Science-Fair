const OpenAI = require("openai");

// 初始化 OpenAI 設定
// 請確保 Vercel 的 Environment Variables 中有設定 OPENAI_API_KEY
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
    // 1. 設定 CORS (允許跨網域呼叫，避免瀏覽器擋住)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 處理預檢請求 (Preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 接收前端數據
    const { prompt, model } = req.body;
    console.log(`[V6.0 System] Request received - Model: ${model}`);

    try {
        // 3. 檢查 API Key
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Server Error: Missing OPENAI_API_KEY in environment variables.");
        }

        const startTime = Date.now();
        let output = "";

        // 4. 呼叫 OpenAI API
        // 針對 o1, o3 等推理模型 (Reasoning Models) 做特殊處理
        // 因為推理模型通常不支援 system role 或 stream
        const isReasoning = model.startsWith('o');

        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "user", content: prompt }
            ],
            // 如果是 GPT-4/5 系列，可以設定 temperature 讓實驗更穩定
            // 推理模型 (o-series) 通常強制固定 temperature，所以這裡設條件
            temperature: isReasoning ? 1 : 0.7, 
        });

        output = completion.choices[0].message.content;
        const endTime = Date.now();

        // 5. 回傳成功數據 (含量化指標)
        res.status(200).json({
            output: output,
            latency: endTime - startTime, // 延遲時間 (ms)
            length: output.length,        // 回應字數
            model_used: model             // 確認實際使用的模型
        });

    } catch (error) {
        console.error("[API Error]", error);
        
        // 回傳錯誤訊息給前端顯示
        res.status(500).json({ 
            error: error.message || "Unknown API Error",
            details: "Please check your API Key and Model ID."
        });
    }
};
