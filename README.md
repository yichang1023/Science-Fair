# Science-Fair（第五組平台）

本專案為「大型語言模型華語生成系統之幻覺評估與效能分析」之研究平台。
前端提供多種華語任務介面；後端以 Vercel Serverless Functions 統一呼叫模型，並支援評估模組。

## 專案結構
- `index.html`, `page1.html` ~ `page4.html`：前端頁面
- `js/apiClient.js`：前端呼叫 `/api` 的共用封裝
- `api/generate.js`：後端生成 API（代理呼叫 Gemini）
- `api/eval.js`：最小可用評估 API（可核對題的基本判定）
- `data/tasks.json`：固定題庫（可重現）
- `data/ground_truth.json`：可核對答案（可檢核）

## 部署（Vercel）
1. 將此 repo 連結到 Vercel 專案
2. 在 Vercel → Settings → Environment Variables 設定：
   - `GEMINI_API_KEY`
   - `DEFAULT_MODEL`（可選）
3. 部署後，前端呼叫 `/api/generate` 即可取得模型輸出

## API 使用
### POST `/api/generate`
Body:
```json
{ "prompt": "你的題目", "model": "gemini-1.5-flash", "temperature": 0.2 }

