// api/generate.js
export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS 設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { prompt, model } = req.body;
    
    if (!prompt) throw new Error('Prompt is required');

    let outputText = "";
    
    // === 分流邏輯：根據模型名稱決定呼叫哪家 API ===

    // 1. Google Gemini 系列
    if (model.includes('gemini')) {
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        outputText = data.candidates[0].content.parts[0].text;
    } 
    
    // 2. OpenAI (GPT) 系列
    else if (model.includes('gpt')) {
        const apiKey = process.env.OPENAI_API_KEY;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        outputText = data.choices[0].message.content;
    }

    // 3. Groq (Llama 3) 系列
    else if (model.includes('llama') || model.includes('mixtral') || model.includes('gemma')) {
        const apiKey = process.env.GROQ_API_KEY;
        // Groq 的用法跟 OpenAI 幾乎一樣，只是網址不同
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        outputText = data.choices[0].message.content;
    } 
    
    else {
        throw new Error("未知的模型名稱");
    }

    // 計算耗時並回傳
    const endTime = Date.now();
    return res.status(200).json({ 
        output: outputText, 
        latency: endTime - startTime 
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || '生成失敗' });
  }
}
