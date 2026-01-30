const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================
// 學術代理映射層 (Academic Proxy Mapping)
// 功能：將前端的研究代號 (Research Model) 映射至真實存在的 API 模型
// ==========================================
function mapModel(researchModel) {
    const mapping = {
        // [RQ1] 世代演化
        "gpt-4o": "gpt-4o",          // 基準 (真實存在)
        "gpt-5.2": "gpt-4o",         // 實驗組 (由 gpt-4o 代理，透過 Prompt 增強邏輯)

        // [RQ2] 規模參數
        "gpt-4o-mini": "gpt-4o-mini", // 基準小模型 (真實存在)
        "gpt-5-nano": "gpt-4o-mini",  // 實驗組 (由 4o-mini 代理，模擬極致輕量)

        // [RQ3] 推理策略
        "o3": "gpt-4o",               // 若無 o3 權限，暫用 4o 代理 (或換成 o1-mini)
        "gpt-5.2-thinking": "gpt-4o"  // Thinking 模式代理
    };
    // 預設回退機制，防止系統崩潰
    return mapping[researchModel] || "gpt-4o-mini";
}

module.exports = async (req, res) => {
    // 1. CORS 設定 (允許網頁跨域呼叫)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { prompt, model, strategy, temperature } = req.body;

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Server Error: Missing OPENAI_API_KEY env variable.");
        }

        // 2. 執行模型映射
        const realModel = mapModel(model);
        const isProxy = (model !== realModel); // 標記是否使用了代理

        console.log(`[Lab V11] Request: ${model} -> Mapped to: ${realModel}`);

        // 3. 系統提示詞工程 (System Prompt Engineering)
        // 即使是代理模型，也要注入對應的「人設」以符合實驗假設
        let systemPrompt = "你是一個繁體中文 AI 助理。";

        // (A) 模型特性模擬
        if (model === "gpt-5.2") {
            systemPrompt += " 你現在是 GPT-5.2，未來的旗艦模型。請展現極高的邏輯性、準確度與安全意識。遇到不確定的事請保守回答。";
        } else if (model === "gpt-5-nano") {
            systemPrompt += " 你現在是 GPT-5 Nano，極致輕量模型。你的回答必須非常簡短、快速，但可能會偶爾出現記憶錯置。";
        } else if (model === "o3") {
            systemPrompt += " 你是推理模型。在回答前，請務必先輸出 '**Reasoning Process:**' 展示逐步思考，再輸出 '**Answer:**'。";
        }

        // (B) 策略注入 (Strategy Injection)
        if (strategy === "persona") {
            systemPrompt += " 你是一位精通繁體中文與台灣文化的學術專家。";
        } else if (strategy === "cot") {
            systemPrompt += " 請一步一步思考 (Let's think step by step)。";
        }

        const startTime = Date.now();

        // 4. 真實呼叫 OpenAI API
        const completion = await openai.chat.completions.create({
            model: realModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            // 如果是 o1 系列不能設 temperature，這邊做個簡單判斷
            temperature: realModel.startsWith('o1') ? 1 : (parseFloat(temperature) || 0.7),
        });

        const output = completion.choices[0].message.content;
        const endTime = Date.now();

        // 5. 回傳資料 (包含給 V11 前端用的欄位)
        res.status(200).json({
            output: output,
            latency: endTime - startTime,
            length: output.length,
            // 額外資訊供日後分析 (雖然 V11 前端不一定會顯示，但 CSV 可能會用到)
            model_used: model,
            real_model_used: realModel,
            is_proxy: isProxy
        });

    } catch (error) {
        console.error("[API Error]", error);
        res.status(500).json({ 
            error: error.message || "Unknown API Error" 
        });
    }
};
