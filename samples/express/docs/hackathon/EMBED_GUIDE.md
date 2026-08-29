# Perxona Hackathon：Persona、Motion 與 Embed 規格

本規格以官方 `samples/express` 的 Connect Chatbot 與 `<sv-presenter>` 為準。目標是保留最小、可穩定展示的整合：Connect Chatbot 負責回答，Embed 負責介面與動作，Presenter 負責 Avatar、語音和播放。

## 1. 檔案與責任

| 檔案 | 用途 | 如何套用 |
| --- | --- | --- |
| `persona.txt` | 角色、任務、語氣、對話規則與邊界 | 貼進 Studio 的 `System Instructions`，不是 Knowledge File |
| `motions.json` | 應用程式的 motion key→SDK motion ID 映射 | 由 Embed 載入並驗證後使用 |
| Knowledge File | 專案事實、FAQ、規章或資料 | 在 Studio 上傳 `.txt/.pdf/.doc/.docx/.csv` |

人物設定與專案知識必須分開。Persona 說明「怎麼回答」，Knowledge 說明「依據什麼回答」。兩者都不得包含 API Key。

範本：

- `persona.example.txt`
- `motions.example.json`

## 2. Persona TXT v1

規格：

- 編碼：UTF-8 純文字。
- 必填段落：`IDENTITY`、`GOAL`、`PERSONALITY`、`CONVERSATION RULES`、`FLOW`、`BOUNDARIES`、`DEMO SCENARIOS`。
- 回答必須適合朗讀：短句、無 Markdown、每次最多三句是建議預設。
- Persona 不得包含真實 Motion ID 或 `[MOTION ...]`。動作由 Embed 決定，避免模型捏造 ID 或注入控制標記。
- 完成後，在 Studio 選取 Chatbot，展開 `Create / Edit`，把內容貼到 `System Instructions` 並按 `Save`。

## 3. Motions JSON v1

根物件：

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `version` | integer | 固定為 `1` |
| `avatarId` | string | motion 所屬的 Avatar ID；必須與 Embed 使用的 Avatar 相同 |
| `defaultBehavior` | string | v1 固定建議為 `auto` |
| `motions` | array | 只收錄 Demo 真正會使用的動作，建議 3–6 個 |

每個 motion：

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `key` | string | App 使用的穩定語意名稱；唯一且使用 `a-z0-9_` |
| `motionId` | string | 從目前 Avatar motion catalog 複製，不可自行編造 |
| `label` | string | 給團隊看的中文名稱 |
| `delivery` | string | `markup` 或 `standalone` |
| `when` | string | 一句話描述觸發時機 |

`motions.json` 是專案設定，不是 Perxona SDK 直接接受的參數。Embed 必須先用 `key` 找到 `motionId`，再轉成下列其中一種 SDK 呼叫。

## 4. Motion 如何傳入 Presenter

### 4.1 預設：自動選擇動作

一般 Chatbot 回答不要加任何 tag：

```js
const result = await presenter.present(replyText);
```

這會保留 Perxona 對整句回答的自動 motion 選擇，應作為大多數回覆的預設。

### 4.2 隨語音在指定位置播放

把經驗證的 ID 插入文字：

```js
const content = `你好，很高興見到你。[MOTION ${motionId}:1] 我們開始吧。`;
const result = await presenter.present(content);
```

v1 一律使用官方範例採用的 priority `1`，不把 priority 開放成設定。

重要限制：

- 一則訊息只要含有任何 `[MOTION id:1]`，整則訊息就不再使用自動 motion 選擇。
- motion tag 太靠近句尾或整句太短時，語音結束會讓動作來不及完整播放。
- 無權存取或不存在的 ID 會被忽略，語音仍可能正常播放，因此上線前必須驗證 catalog。
- 不要讓 LLM 直接輸出 `[MOTION ...]`；由 App 使用白名單 key 注入。

### 4.3 不伴隨語音、獨立播放

```js
const result = await presenter.playMotion(motionId);
```

適合完成慶祝、按鈕互動或舞台提示。只在 Presenter 已進入 `Ready` 後呼叫。

### 4.4 最小白名單轉換

將完成的 `motions.json` 放到 `public/config/motions.json`，在 Embed 啟動時載入：

```js
const motionConfig = await fetch("/config/motions.json").then((res) => {
  if (!res.ok) throw new Error("motions.json unavailable");
  return res.json();
});

const motionByKey = new Map(
  motionConfig.motions.map((motion) => [motion.key, motion]),
);

function requireMotion(key, delivery) {
  const motion = motionByKey.get(key);
  if (!motion || motion.delivery !== delivery) {
    throw new Error(`Unknown ${delivery} motion: ${key}`);
  }
  return motion.motionId;
}

async function speakWithMotion(text, key) {
  const id = requireMotion(key, "markup");
  const result = await presenter.present(`[MOTION ${id}:1] ${text}`);
  if (!result?.success) throw new Error(result?.message ?? "present failed");
}

async function playGesture(key) {
  const id = requireMotion(key, "standalone");
  const result = await presenter.playMotion(id);
  if (result && !result.success) {
    throw new Error(result.message ?? "playMotion failed");
  }
}
```

MVP 不做 LLM 動態動作解析。一般回答維持自動 motion，只在開場、同理、成功等少數固定節點呼叫 `speakWithMotion()` 或 `playGesture()`。

## 5. 取得並驗證 ID

伺服器運作時，在另一個 PowerShell 執行：

```powershell
cd C:\Users\user\Desktop\code\AI_avatar\perxona-connect-kit\samples\express

(Invoke-RestMethod http://localhost:8083/api/avatars).items |
  Select-Object id,name

(Invoke-RestMethod http://localhost:8083/api/scenes).items |
  Select-Object id,name

(Invoke-RestMethod http://localhost:8083/api/voices).items |
  Select-Object id,name

(Invoke-RestMethod http://localhost:8083/api/chatbots).items |
  Select-Object id,name
```

選好 Avatar 後列出相容 motion：

```powershell
$avatarId = "貼上 Avatar ID"
(Invoke-RestMethod "http://localhost:8083/api/avatars/$avatarId/motions").items |
  Select-Object motion_id,name,tags
```

也可以使用官方 `tools/motion-browser` 預覽動作並複製 Motion ID。每次更換 Avatar 都必須重新驗證 motion catalog。

## 6. 固定 Embed 使用的資源

把選定的四個 ID 填進 `samples/express/.env`：

```env
DEMO_FIXED_AVATAR_ID=<avatar id>
DEMO_FIXED_SCENE_ID=<scene id>
DEMO_FIXED_VOICE_ID=<voice id>
DEMO_FIXED_CHATBOT_ID=<chatbot id>
```

規則：

- Avatar 與 Scene 必須一起設定；只填一個會被忽略。
- 使用 `present()` 時必須填 Voice。固定 Avatar/Scene 卻把 Voice 留白代表 BYO-TTS。
- `.env` 更新後按 `Ctrl+C` 停止伺服器，再執行 `npm run dev`。

開啟：

```text
http://localhost:8083/demos/embed/
```

第一次送出訊息同時是瀏覽器允許播放音訊的 user gesture，所以 Avatar 不會在頁面載入時自動說話。

## 7. 建立黑客松專屬 Embed

不要從 Studio 改。Studio 是管理與除錯工具；產品頁從 Embed 複製：

```powershell
Copy-Item -Recurse public\demos\embed public\demos\hackathon
```

新頁面位於：

```text
http://localhost:8083/demos/hackathon/
```

修改順序：

1. `public/demos/hackathon/index.html`：專案名稱、說明、按鈕與版面。
2. `style.css`：品牌色與響應式排版。
3. `app.js`：修改 `GREETING`、錯誤文字、固定劇情節點與 motion 呼叫。

如果先不重寫 JavaScript，HTML 必須保留下列元素或 ID：

- `<sv-presenter>`
- `#stage-loading`、`#stage-error`
- `#chat`、`#chat-log`
- `#chat-form`、`#chat-input`、`#send-btn`

核心啟動順序不可交換：

```text
先註冊 PRESENTER_STATUS listener
→ GET /api/config
→ 載入 Presenter CDN
→ GET /api/connect-key（只回傳 Publishable Key）
→ initializeWithConnectKey(key, fixedTarget)
→ 等待 Ready
→ 使用者第一次送出訊息時 resumeAudioPlayback()
→ 呼叫 Chatbot
→ presenter.present(reply)
```

Secret Key 永遠只能留在 Express server；不得放進 HTML、瀏覽器 JavaScript 或 `motions.json`。

## 8. 驗收清單

- Persona 已貼入 System Instructions，回答短、可朗讀且沒有 Markdown。
- Knowledge 與 Persona 分開管理。
- `.env` 已固定 Avatar、Scene、Voice、Chatbot 四個 ID。
- `motions.json.avatarId` 與 `.env` 的 Avatar ID 相同。
- 每個 Motion ID 都用目前 Avatar 實際預覽過。
- 一般回答仍使用自動 motion；顯式 motion 只用在關鍵節點。
- Presenter 未 Ready 時不呼叫 `present()` 或 `playMotion()`。
- 所有 `present()` 結果都有檢查 `success`。
- Secret Key 沒有出現在前端或版本控制中。
- 黑客松 Demo 至少完整跑過三次固定腳本。
