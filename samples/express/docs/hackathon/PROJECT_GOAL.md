# 專案目標：診所情境生成式 AI 困難病人模擬

## 1. 一句話形容專案

使用者輸入診所條件並選擇一種困難醫療情境後，由 Agent 自動生成符合該診所的虛構病人與病例背景，讓醫師透過 Perxona Avatar 練習溝通並取得即時評分。

## 2. 目標使用者

台灣基層診所的第一線醫師，以及負責院內溝通訓練的診所管理者。

## 3. 想解決的問題

現有 Virtual Patient 多使用固定案例，或要求使用者自行設定病人背景、人格、情緒與病史；建立成本高，也難反映每間診所真實的設備、流程與時間限制。

困難醫療情境也不是單純的「壞病人」，而是病人期待、醫師回應與照護環境共同形成。相同的病人要求，在不同診所可能因設備、轉診方式、看診時間與既往互動而形成不同衝突。

本專案因此聚焦於：

> **使用者先選擇要練習的困難情境，再由 Agent 依診所條件生成病人、病例背景與評分目標。**

Avatar 以語氣、表情與動作呈現病人的焦慮、不信任與挫折，讓訓練不只是文字問答。

## 4. 使用者輸入與情境生成

### (1) 使用者先選擇一種困難情境

Demo 固定提供三種選項：

| ID | 情境 | 核心互動問題 |
| --- | --- | --- |
| `repeat_nonadherence` | 不理會醫療建議又一直來看診 | 病人未執行建議、症狀持續，卻反覆回診並期待不同結果 |
| `unrealistic_expectation` | 對醫療照護有不切實際的想像 | 病人期待立即治癒、完全保證或超出合理範圍的服務 |
| `unnecessary_request` | 要求醫師開不必要的藥或檢測 | 病人堅持特定藥物、影像或檢查，與醫療判斷或診所資源衝突 |

使用者選的是「情境類型」，不是預先寫好的病人。選擇後才開始生成 scenario；同一類型可重新生成不同病人。

### (2) 使用者輸入診所條件

#### 必填 4 項

| 欄位 | 範例 |
| --- | --- |
| 科別與主要服務 | 家醫科；一般內科門診 |
| 可提供的資源 | 抽血、心電圖、X 光 |
| 無法提供／需轉診的資源 | CT、MRI |
| 平均看診時間 | 每位病人約 7 分鐘 |

#### 選填 2 項

| 欄位 | 範例 |
| --- | --- |
| 轉診或追蹤方式 | 合作醫院轉診、兩週後回診 |
| 當下壓力 | 候診人多、即將休診或家屬介入 |

所有資料都應是診所層級資訊，不輸入可識別的真實病歷或個資。

### (3) Scenario Generation Agent 輸出

Agent 接收 `clinic_condition + scenario_type`，生成一份 `structured_scenario`：

| 欄位 | 內容 |
| --- | --- |
| `scenario_type` | 三種固定情境之一 |
| `patient_profile` | 年齡區間、生活背景、健康識能與說話方式 |
| `current_visit` | 本次主訴、明確要求與診所限制 |
| `hidden_need` | 病人真正的焦慮、期待或不信任來源 |
| `interaction_pattern` | 可觀察行為，不使用人格疾病標籤 |
| `encounter_history` | 0–2 次關鍵既往互動 |
| `initial_state` | 信任、焦慮、合作意願（低／中／高） |
| `disclosure_rules` | 哪些資訊需在被正確詢問後才揭露 |
| `success_criteria` | 本次對話的 2–4 個溝通目標 |
| `scoring_rubric` | 此 scenario 專用的評分要點 |

生成後由醫師預覽、確認或重新生成，再進入 Avatar 對話。本產品只做虛構溝通訓練，不提供診斷或治療決策。

## 5. Demo 架構：無 RAG

黑客松 Demo 採第一張圖的最小架構，不建置向量資料庫或檢索流程。三種情境的必要知識與評分原則先放在固定 prompt／設定檔中。

```text
clinic condition + scenario selection
→ scenario generation agent
→ structured scenario
→ patient agent
→ Perxona patient avatar + query loop
→ structured dialogue summary
→ scoring agent（structured scenario + dialogue summary）
→ score output
```

### 各 Agent 責任

#### Scenario Generation Agent

- 只負責依診所條件與情境類型生成 `structured_scenario`。
- 不直接與受測醫師對話。

#### Patient Agent

- 僅依 `structured_scenario` 扮演病人。
- 保持角色一致，依 disclosure rules 逐步揭露資訊。
- 根據對話更新信任、焦慮與合作意願。
- 回覆文字交由 Perxona Avatar 說話並搭配 motion。

#### Scoring Agent

- 接收原始 `structured_scenario` 與 `structured_dialogue_summary`。
- 依 scenario 專用 rubric 評分，不自行改寫病例設定。
- 輸出四項分數、主要優點、主要風險與一句建議說法。

### 簡化評分

每項 0–2 分：

| 評分項目 | 判斷重點 |
| --- | --- |
| 理解需求 | 是否找到明確要求背後的擔心 |
| 同理與說明 | 是否回應情緒並清楚說明 |
| 界限與資源 | 是否守住專業界限並提供替代方案 |
| 合作與下一步 | 是否形成可執行的追蹤或轉診計畫 |

## 6. 報告／產品方向：加入 RAG

第二張圖是實際報告要呈現的擴充方向，不要求在 Demo 完成。

```text
expertise knowledge
→ chunk / embedding
→ PostgreSQL + pgvector

clinic condition + scenario selection
→ scenario generation agent
→ structured scenario
→ RAG query
→ relevant chunks

structured scenario
→ patient agent + Perxona query loop
→ structured dialogue summary

structured scenario + dialogue summary + relevant chunks
→ scoring agent
→ score output
```

RAG 的用途是讓 Scoring Agent 取得與該 scenario 相關的專業溝通原則與評分依據。Demo 先證明互動體驗與 Agent 流程，產品版再把固定 prompt 中的知識移到可維護、可追溯的知識庫。

## 7. 產品流程

```text
輸入診所條件
→ 選擇三種困難情境之一
→ 生成並預覽 scenario
→ 開始 Perxona Avatar 對話
→ 結束對話
→ 產生 structured dialogue summary
→ 顯示評分與建議
```

## 8. Why Perxona

- Avatar 用語氣、表情與姿態呈現焦慮、不信任或挫折。
- 同一句話可因病人狀態不同而有不同表現。
- 醫師必須觀察反應並即時調整說法，接近真實診間壓力。

若移除 Avatar，產品只剩文字案例生成器，會失去非語言觀察與臨場溝通訓練。這對應黑客松評分中占 60% 的 `Why Perxona`。

## 9. 黑客松 MVP

### 必須完成

- 診所條件輸入表單
- 三種固定情境選擇
- 無 RAG 的 Scenario Generation Agent
- `structured_scenario` 預覽與重新生成
- Patient Agent + Perxona Avatar 對話
- 對話摘要與 Scoring Agent
- 四項評分與建議說法
- 一套固定 Live Demo 腳本

### 本階段不做

- RAG、embedding、PostgreSQL 或 pgvector
- 真實病歷、個資或 HIS／EMR 串接
- 診斷或治療建議
- 完整長期病歷與永久多次就診狀態
- 多使用者權限或自訂評分權重

## 10. 團隊必須自行完成／確認的事項

以下內容需要產品決策或醫療專業判斷，不能交由生成模型自行決定：

1. **Demo 診所條件**：提供一組確定要上台使用的科別、資源、限制、看診時間與轉診方式。
2. **Live Demo 情境**：從三種情境中指定上台主要展示哪一種，另外兩種只需證明可選。
3. **三類情境的醫療審核**：每類確認一個合理案例、不可出現的危險內容，以及需要提醒轉診／緊急處置的紅旗界線。
4. **評分內容審核**：確認四項 rubric、合理回答與不當回答的判斷原則。
5. **人物設定**：完成病人的說話風格、角色邊界與不可透露規則；不得放入真實病人資料。
6. **Avatar 與 Motion**：選定 Avatar、Scene、Voice，以及 3–6 個已在該 Avatar 上測試過的 Motion ID。
7. **Demo 腳本**：準備一條成功對話路徑、必要時一條失敗路徑，以及 5 分鐘簡報分工。
8. **未來 RAG 資料**：確認哪些教材或指引有權使用，並由醫療專家確認內容與版本。

## 11. Codex 接手執行的設定

團隊完成第 10 節必要內容後，Codex 負責：

1. 三種 scenario type 設定與 UI。
2. `structured_scenario` 與 dialogue summary 的 JSON Schema。
3. Scenario Generation、Patient、Scoring 三個 Agent 的 prompt 與資料流。
4. 無 RAG Demo API 與錯誤處理。
5. Perxona Embed、角色設定、motion 白名單與播放邏輯。
6. 評分頁、固定 Demo seed、測試與操作文件。
7. 報告用 RAG 擴充說明與介面保留點，但不在 Demo 實作 pgvector。

## 12. 驗收與設計依據

- 三種情境都能被選擇，選擇後才生成 scenario。
- 生成內容必須與診所條件及所選情境直接相關。
- Patient Agent 不得脫離 structured scenario 或提早揭露隱藏資訊。
- Scoring Agent 必須同時使用 structured scenario 與 dialogue summary。
- `困難型病人.pdf`：困難情境由病人、醫師與照護系統共同形成。
- `0829 Perxona Taipei Hackathon.pdf`：產品價值 30%、Why Perxona 60%、Demo 與說故事 10%。
