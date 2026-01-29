// api/generate.js
// 這是科展專案 "Science-Fair" 的後端核心
// 負責處理與 Google, OpenAI, Groq 的連線

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Groq = require("groq-sdk");

module.exports = async (req, res) => {
    // ---------------------------------------------------------
    // 1. 設定 CORS (這段是為了讓你的網頁可以跨網域呼叫 API)
    // ---------------------------------------------------------
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 如果瀏覽器只是來「問路」(Preflight)，直接說 OK
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ---------------------------------------------------------
    // 2. 接收前端傳來的資料
    // ---------------------------------------------------------
    const { prompt, model } = req.body;
    const startTime = Date.now();
    let output = "";

    try {
        console.log(`[Server Log] 收到請求: Model=${model}`); // 方便 Vercel 後台除錯

        // ==========================================
        // 策略 A: 處理 Groq (Llama 3.1 / Grok)
        // ==========================================
        if (model.includes('llama') || model.includes('grok')) {
            // [檢查 1] 確認有沒有安裝驅動
            if (typeof Groq === 'undefined') {
                throw new Error("伺服器缺少 groq-sdk 套件，請檢查 package.json");
            }
            // [檢查 2] 確認有沒有 Key
            if (!process.env.GROQ_API_KEY) {
                throw new Error("Vercel 後台找不到 GROQ_API_KEY");
            }

            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            
            // 確保模型 ID 正確 (防止前端傳錯)
            let targetGroqModel = "llama-3.1-8b-instant"; // 預設用快的
            if (model.includes("70b")) targetGroqModel = "llama-3.1-70b-versatile";

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: targetGroqModel,
                temperature: 0.7,
            });
            output = completion.choices[0]?.message?.content || "(無回應)";

        // ==========================================
        // 策略 B: 處理 OpenAI (GPT-4o)
        // ==========================================
        } else if (model.includes('gpt')) {
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("Vercel 後台找不到 OPENAI_API_KEY");
            }

            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: model.includes('mini') ? "gpt-4o-mini" : "gpt-4o",
            });
            output = completion.choices[0].message.content;

        // ==========================================
        // 策略 C: 處理 Google (Gemini) - 預設
        // ==========================================
        } else {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("Vercel 後台找不到 GEMINI_API_KEY");
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // [關鍵修復]：如果收到舊版 gemini-pro，強制轉成 1.5-flash
            // 這就是為什麼你之前會出現 404 Model Not Found 的原因
            let targetGemini = "gemini-1.5-flash"; 
            if (model.includes("pro") && model.includes("1.5")) {
                targetGemini = "gemini-1.5-pro";
            }
            // 如果是舊的 gemini-pro，上面這兩行會直接讓它變成 flash，解決問題

            const geminiModel = genAI.getGenerativeModel({ model: targetGemini });
            const result = await geminiModel.generateContent(prompt);
            output = result.response.text();
        }

        // ---------------------------------------------------------
        // 3. 成功！回傳結果
        // ---------------------------------------------------------
        const endTime = Date.now();
        res.status(200).json({ output: output, latency: endTime - startTime });

    } catch (error) {
        // ---------------------------------------------------------
        // 4. 失敗... 回傳 JSON 格式的錯誤 (重要！)
        // ---------------------------------------------------------
        console.error("API Error:", error);
        
        // 判斷是否為 API Key 錯誤 (401)
        let statusCode = 500;
        let errorMsg = `API 錯誤: ${error.message}`;

        if (error.message.includes("API Key") || error.status === 401) {
            statusCode = 401; // 告訴前端這是權限錯誤
            errorMsg = "API Key 無效或過期，請檢查 Vercel 設定。";
        }

        res.status(statusCode).json({ 
            error: errorMsg,
            details: error.toString() 
        });
    }
};
