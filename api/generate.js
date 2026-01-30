<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>🧪 2026 LLM 幻覺實驗室 (V6.0)</title>
    <style>
        body { font-family: "Segoe UI", "Microsoft JhengHei", sans-serif; padding: 20px; background: #f1f5f9; max-width: 1400px; margin: 0 auto; color: #1e293b; }
        header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
        h1 { margin: 0; font-weight: 800; color: #0f172a; letter-spacing: -1px; }
        
        /* 版本標籤 - 用來檢查是否更新成功 */
        .version-tag { 
            background: #0f172a; color: #fbbf24; 
            padding: 5px 15px; border-radius: 20px; 
            font-size: 14px; font-weight: bold; font-family: monospace;
            display: inline-block; margin-top: 10px;
        }

        .grid { display: grid; grid-template-columns: 350px 1fr; gap: 25px; }
        .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #334155; border-bottom: 2px solid #f8fafc; padding-bottom: 10px; }

        label { display: block; font-weight: 700; margin-bottom: 8px; color: #64748b; font-size: 0.9em; }
        select, textarea { width: 100%; padding: 12px; margin-bottom: 20px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; transition: 0.2s; }
        select:focus, textarea:focus { border-color: #3b82f6; outline: none; }
        
        button { width: 100%; padding: 15px; margin-bottom: 10px; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; color: white; transition: 0.2s; }
        .btn-start { background: #2563eb; } .btn-start:hover { background: #1d4ed8; }
        .btn-stop { background: #ef4444; } .btn-stop:hover { background: #dc2626; }
        .btn-csv { background: #10b981; } .btn-csv:hover { background: #059669; }
        button:disabled { background: #cbd5e1; cursor: not-allowed; }

        .table-wrap { height: 650px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f8fafc; padding: 12px; text-align: left; position: sticky; top: 0; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        .bg-green { background: #dcfce7; color: #166534; }
        .bg-red { background: #fee2e2; color: #991b1b; }
        .bg-gray { background: #f1f5f9; color: #64748b; }
    </style>
</head>
<body>

<header>
    <h1>🧪 2026 LLM 幻覺實驗室</h1>
    <div class="version-tag">SYSTEM V6.0 - OPENAI FOCUS EDITION</div>
</header>

<div class="grid">
    <div class="card">
        <h3>🎛️ 實驗變因設定</h3>
        
        <label>1. 選擇模型 (Model)</label>
        <select id="modelSelect">
            <optgroup label="RQ1: 世代演化 (Gen 4 vs Gen 5)">
                <option value="gpt-4o">GPT-4o (2024 Flagship)</option>
                <option value="gpt-5.2">GPT-5.2 (2026 New Flagship)</option>
            </optgroup>
            
            <optgroup label="RQ2: 參數量級 (Size/Scale)">
                <option value="gpt-4o-mini">GPT-4o Mini (Small)</option>
                <option value="gpt-5-nano">GPT-5 Nano (Tiny/Edge)</option>
                <option value="gpt-5-mini">GPT-5 Mini (Medium)</option>
            </optgroup>

            <optgroup label="RQ3: 邏輯推理 (Reasoning)">
                <option value="o1">o1 (First Gen Reasoning)</option>
                <option value="o3">o3 (Latest Reasoning)</option>
            </optgroup>

            <optgroup label="備用選項 (Backup)">
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </optgroup>
        </select>

        <label>2. 提示策略 (Prompt)</label>
        <select id="strategySelect">
            <option value="baseline">基準模式 (Baseline)</option>
            <option value="persona">角色扮演 (Persona: 台灣專家)</option>
            <option value="cot">思維鏈 (Chain of Thought)</option>
        </select>

        <label>3. 測試題目 (Questions)</label>
        <textarea id="questionList" placeholder="請貼上題目 (一行一題)..."></textarea>
        
        <button class="btn-start" onclick="startExp()" id="btnStart">▶ 開始實驗</button>
        <button class="btn-stop" onclick="stopExp()" id="btnStop" disabled>⏹ 強制停止</button>
        <button class="btn-csv" onclick="downloadCSV()" id="btnCsv" disabled>📥 下載數據 (CSV)</button>
    </div>

    <div class="card">
        <h3>📊 實時結果監控</h3>
        <div class="table-wrap">
            <table id="resTable">
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="30%">題目</th>
                        <th width="45%">AI 回應</th>
                        <th width="10%">字數</th>
                        <th width="10%">狀態</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">等待啟動...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script>
    let isRunning = false;
    let results = [];

    async function startExp() {
        const qRaw = document.getElementById('questionList').value.trim();
        if(!qRaw) { alert("請輸入題目！"); return; }
        
        const questions = qRaw.split('\n').filter(x => x.trim());
        const model = document.getElementById('modelSelect').value;
        const strategy = document.getElementById('strategySelect').value;
        
        isRunning = true;
        results = [];
        toggleUI(true);
        document.querySelector('#resTable tbody').innerHTML = '';

        for(let i=0; i<questions.length; i++) {
            if(!isRunning) break;
            
            const q = questions[i];
            
            // 提示詞組裝
            let prompt = q;
            if(strategy === 'persona') prompt = `你是一位台灣研究專家，請用繁體中文回答：${q}`;
            if(strategy === 'cot') prompt = `問題：${q}\n請逐步思考後回答：`;

            // UI 插入
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${i+1}</td><td>${q}</td><td style="color:#aaa">Generating...</td><td>-</td><td><span class="badge bg-gray">...</span></td>`;
            document.querySelector('#resTable tbody').appendChild(tr);
            
            const startT = Date.now();
            let rowData = { id: i+1, q, output: "", len: 0, latency: 0, model, strategy };

            try {
                const res = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ prompt, model })
                });
                const json = await res.json();
                
                if(json.error) throw new Error(json.error);

                rowData.output = json.output;
                rowData.latency = json.latency;
                rowData.len = json.output.length;

                tr.innerHTML = `
                    <td>${i+1}</td>
                    <td>${q}</td>
                    <td><div style="max-height:100px; overflow-y:auto">${json.output}</div></td>
                    <td>${rowData.len}</td>
                    <td><span class="badge bg-green">OK</span></td>
                `;
            } catch(e) {
                rowData.output = "Error: " + e.message;
                tr.innerHTML = `<td>${i+1}</td><td>${q}</td><td style="color:red">${e.message}</td><td>0</td><td><span class="badge bg-red">ERR</span></td>`;
            }
            
            results.push(rowData);
            scrollToBottom();
            // 小睡一下避免 API 太快
            if(i < questions.length - 1) await new Promise(r => setTimeout(r, 1000));
        }
        
        isRunning = false;
        toggleUI(false);
        if(confirm("實驗完成！下載數據？")) downloadCSV();
    }

    function stopExp() { isRunning = false; }

    function downloadCSV() {
        let csv = "\uFEFFID,Model,Strategy,Question,Answer,Length,Latency,Error_Type_A_B_C_D\n";
        results.forEach(r => {
            csv += `${r.id},${r.model},${r.strategy},"${r.q.replace(/"/g,'""')}","${r.output.replace(/"/g,'""')}",${r.len},${r.latency},\n`;
        });
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `ExpData_${new Date().toISOString().slice(0,10)}_${document.getElementById('modelSelect').value}.csv`;
        link.click();
    }

    function toggleUI(disable) {
        document.getElementById('btnStart').disabled = disable;
        document.getElementById('btnCsv').disabled = disable;
        document.getElementById('btnStop').disabled = !disable;
    }

    function scrollToBottom() {
        const div = document.querySelector('.table-wrap');
        div.scrollTop = div.scrollHeight;
    }
</script>

</body>
</html>
