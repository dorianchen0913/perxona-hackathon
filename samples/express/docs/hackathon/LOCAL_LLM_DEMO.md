# Local LLM 診間練習室

這個 Demo 實作最新版 `ref/goal.md` 的無 RAG 展示架構：使用者輸入診所條件、從三種固定困難情境中選一種，Local LLM 生成虛構病例；另一個 prompt 扮演病人，Perxona Avatar 朗讀回覆；最後由評分 prompt 產生結構化回饋。

## 1. 設定 `.env`

在 `samples/express/.env` 保留原本的 Perxona 金鑰與固定 Avatar 設定，再加入 Local LLM：

```env
LLM_PROVIDER=openai
LLM_API_KEY=<你的 Local LLM API Key>
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=<已載入的模型名稱>
```

`LLM_BASE_URL` 必須是 OpenAI-compatible API 的 base URL，伺服器會呼叫 `<base URL>/chat/completions`。常見設定：

- LM Studio：`http://localhost:1234/v1`
- Ollama：`http://localhost:11434/v1`；若未啟用驗證，可將 `LLM_API_KEY` 設為僅供本機使用的任意非空值，例如 `ollama`
- vLLM：依啟動參數設定，通常是 `http://localhost:8000/v1`

不要把 API Key 寫進 `public/`、前端 JavaScript、Git commit 或畫面輸入框。

## 2. 啟動

先啟動 Local LLM 的 API server，確認指定模型已載入。接著執行：

```powershell
cd C:\Users\user\Desktop\code\AI_avatar\perxona-connect-kit\samples\express
npm run dev
```

開啟：

```text
http://localhost:8083/demos/hackathon/
```

修改 `.env` 後請按 `Ctrl+C` 停止 Express，再重新執行 `npm run dev`。

## 3. Demo API

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/hackathon/config` | 回傳三種情境、模型名稱與 Presenter 設定，不回傳 API Key |
| `POST` | `/api/hackathon/scenario` | 由診所條件和情境類型生成 structured scenario |
| `POST` | `/api/hackathon/patient` | 根據 scenario、病人狀態與對話紀錄生成下一句 |
| `POST` | `/api/hackathon/score` | 依同一份 scenario rubric 評估溝通對話 |

三個 POST endpoint 都只接受 JSON，會限制輸入欄位、對話輪數與總字數。Local LLM 的回覆也會經過伺服器正規化後才交給前端。

## 4. 對應 `goal.md`

- Demo：無 RAG，只有 scenario、patient、scoring 三個 agent prompt。
- 報告：保留第二張圖的 RAG 作為未來架構；不在本 Demo 假裝已完成。
- 固定輸入：三種困難情境之一。
- 診所輸入：服務、可用資源、不可用資源、平均時間，以及選填的追蹤方式與現場壓力。
- 生成輸出：病人設定、病例背景、隱藏需求、揭露規則、初始情緒狀態與共同評分規準。
- Motion：目前使用 `presenter.present(replyText)` 的 Perxona 自動動作；`motion_key` 保留為日後白名單映射，不讓 LLM 直接輸出 Motion ID。

## 5. 快速檢查

```powershell
npm run test:hackathon
Invoke-RestMethod http://localhost:8083/api/hackathon/config
```

設定正常時，`llmConfigured` 應為 `true`，而回傳內容不會包含 `LLM_API_KEY`。
