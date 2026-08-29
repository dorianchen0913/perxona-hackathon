export const SCENARIO_TYPES = [
  {
    id: "repeat_nonadherence",
    title: "不理會醫療建議又一直來看診",
    description:
      "病人未執行先前建議、症狀持續，卻反覆回診並期待不同結果。",
  },
  {
    id: "unrealistic_expectation",
    title: "對醫療照護有不切實際的想像",
    description: "病人期待立即治癒、完全保證或超出合理範圍的服務。",
  },
  {
    id: "unnecessary_request",
    title: "要求醫師開不必要的藥或檢測",
    description:
      "病人堅持特定藥物、影像或檢查，與醫療判斷或診所資源衝突。",
  },
];

const SCENARIO_IDS = new Set(SCENARIO_TYPES.map(({ id }) => id));
const LEVELS = new Set(["low", "medium", "high"]);
const SCORE_KEYS = [
  "understanding",
  "empathy_explanation",
  "boundaries_resources",
  "collaboration_next_step",
];

const text = (value, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;
const list = (value, fallback = []) =>
  Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : fallback;
const level = (value, fallback = "medium") =>
  LEVELS.has(value) ? value : fallback;

export function parseLlmJson(rawText) {
  const raw = text(rawText);
  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw Object.assign(new Error("Local LLM did not return a JSON object."), {
      status: 502,
    });
  }
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch (error) {
    throw Object.assign(
      new Error(`Local LLM returned invalid JSON: ${error.message}`),
      { status: 502 },
    );
  }
}

export function hackathonInputError(body) {
  if (!body || typeof body !== "object") return "Request body is required.";
  if (!SCENARIO_IDS.has(body.scenario_type))
    return "Unknown scenario_type.";
  const clinic = body.clinic_condition;
  if (!clinic || typeof clinic !== "object")
    return "clinic_condition is required.";
  const required = [
    "specialty_services",
    "available_resources",
    "unavailable_resources",
    "average_visit_time",
  ];
  const missing = required.filter((key) => !text(clinic[key]));
  if (missing.length) return `Missing clinic fields: ${missing.join(", ")}.`;
  if (JSON.stringify(body).length > 8_000) return "Clinic input is too large.";
  return null;
}

export function dialoguePayloadError(body, requireClinicianLast = false) {
  if (!body?.scenario || typeof body.scenario !== "object")
    return "scenario is required.";
  if (!SCENARIO_IDS.has(body.scenario.scenario_type))
    return "scenario has an unknown scenario_type.";
  if (!Array.isArray(body.history) || body.history.length === 0)
    return "history must be a non-empty array.";
  if (body.history.length > 20)
    return "history must contain 20 turns or fewer.";
  const invalidTurn = body.history.find(
    (turn) =>
      !turn ||
      !["clinician", "patient"].includes(turn.role) ||
      !text(turn.text),
  );
  if (invalidTurn) return "history contains an invalid turn.";
  const totalChars = body.history.reduce(
    (sum, turn) => sum + turn.text.length,
    0,
  );
  if (totalChars > 12_000) return "history is too large.";
  if (
    requireClinicianLast &&
    body.history.at(-1)?.role !== "clinician"
  )
    return "the latest history turn must be from the clinician.";
  return null;
}

export function normalizeScenario(raw, input) {
  const clinic = input.clinic_condition;
  const scenarioType = SCENARIO_TYPES.find(
    ({ id }) => id === input.scenario_type,
  );
  const patient = raw?.patient_profile ?? {};
  const visit = raw?.current_visit ?? {};
  const initial = raw?.initial_state ?? {};
  const history = Array.isArray(raw?.encounter_history)
    ? raw.encounter_history.slice(0, 2).map((item, index) => ({
        visit: text(item?.visit, `第 ${index + 1} 次就診`),
        patient_request: text(item?.patient_request, "未記錄"),
        clinician_response: text(item?.clinician_response, "未記錄"),
        patient_feeling: text(item?.patient_feeling, "未記錄"),
      }))
    : [];
  const successCriteria = list(raw?.success_criteria).slice(0, 4);

  return {
    version: 1,
    scenario_type: input.scenario_type,
    title: text(raw?.title, scenarioType.title),
    clinic_condition: {
      specialty_services: text(clinic.specialty_services),
      available_resources: text(clinic.available_resources),
      unavailable_resources: text(clinic.unavailable_resources),
      average_visit_time: text(clinic.average_visit_time),
      referral_followup: text(clinic.referral_followup, "未提供"),
      situational_pressure: text(clinic.situational_pressure, "未提供"),
    },
    patient_profile: {
      display_name: text(patient.display_name, "模擬病人"),
      age_range: text(patient.age_range, "成人"),
      background: text(patient.background, "一般門診病人"),
      health_literacy: text(patient.health_literacy, "中等"),
      speaking_style: text(patient.speaking_style, "口語、簡短"),
    },
    current_visit: {
      chief_complaint: text(visit.chief_complaint, "症狀未改善"),
      explicit_request: text(visit.explicit_request, scenarioType.description),
      clinic_conflict: text(
        visit.clinic_conflict,
        `要求與診所限制「${clinic.unavailable_resources}」衝突。`,
      ),
    },
    hidden_need: text(raw?.hidden_need, "希望確認醫師沒有忽略自己的擔心。"),
    interaction_pattern: text(
      raw?.interaction_pattern,
      scenarioType.description,
    ),
    encounter_history: history,
    initial_state: {
      trust: level(initial.trust),
      anxiety: level(initial.anxiety, "high"),
      cooperation: level(initial.cooperation),
    },
    disclosure_rules: list(raw?.disclosure_rules, [
      "只有在醫師先回應情緒或提出開放式問題後，才說出真正擔心。",
    ]).slice(0, 5),
    success_criteria:
      successCriteria.length >= 2
        ? successCriteria
        : ["辨識隱藏需求", "說明限制並提出可執行下一步"],
    scoring_rubric: {
      understanding: text(raw?.scoring_rubric?.understanding, "辨識隱藏需求"),
      empathy_explanation: text(
        raw?.scoring_rubric?.empathy_explanation,
        "回應情緒並清楚說明",
      ),
      boundaries_resources: text(
        raw?.scoring_rubric?.boundaries_resources,
        "守住專業界限並提供替代方案",
      ),
      collaboration_next_step: text(
        raw?.scoring_rubric?.collaboration_next_step,
        "形成可執行的追蹤或轉診計畫",
      ),
    },
  };
}

export function normalizePatientTurn(raw, previousState) {
  const state = raw?.state ?? {};
  return {
    reply_text: text(raw?.reply_text, "我還是不太放心，可以再說清楚一點嗎？").slice(
      0,
      600,
    ),
    state: {
      trust: level(state.trust, previousState.trust),
      anxiety: level(state.anxiety, previousState.anxiety),
      cooperation: level(state.cooperation, previousState.cooperation),
    },
    motion_key: text(raw?.motion_key, "auto"),
    should_end: raw?.should_end === true,
  };
}

export function normalizeScore(raw) {
  const scores = {};
  for (const key of SCORE_KEYS) {
    const item = raw?.scores?.[key] ?? {};
    scores[key] = {
      score: Math.max(0, Math.min(2, Number(item.score) || 0)),
      reason: text(item.reason, "沒有足夠證據。"),
    };
  }
  return {
    dialogue_summary: {
      what_happened: text(
        raw?.dialogue_summary?.what_happened,
        "完成一次模擬對話。",
      ),
      patient_outcome: text(
        raw?.dialogue_summary?.patient_outcome,
        "病人的最終狀態需要進一步確認。",
      ),
    },
    scores,
    total: SCORE_KEYS.reduce((sum, key) => sum + scores[key].score, 0),
    best_point: text(raw?.best_point, "願意與病人持續溝通。"),
    main_risk: text(raw?.main_risk, "尚未形成清楚的下一步。"),
    suggested_phrase: text(
      raw?.suggested_phrase,
      "我理解你最擔心的是症狀被忽略，我們一起確認現在能做的評估與下一步。",
    ),
  };
}

const jsonOnly =
  "只輸出一個有效 JSON object，不要 Markdown、code fence 或 JSON 以外文字。";

export function scenarioMessages(input) {
  const type = SCENARIO_TYPES.find(({ id }) => id === input.scenario_type);
  return [
    {
      role: "system",
      content: `你是困難醫療溝通訓練的 Scenario Generation Agent。案例必須是虛構的，只訓練溝通，不提供診斷或治療建議。困難情境來自病人期待、醫師回應與診所限制的交互作用，不使用人格疾病標籤。${jsonOnly}`,
    },
    {
      role: "user",
      content: `請依下列資料生成單一 scenario。\n情境：${type.title}\n定義：${type.description}\n診所條件：${JSON.stringify(input.clinic_condition)}\n\nJSON 欄位：title, patient_profile{display_name,age_range,background,health_literacy,speaking_style}, current_visit{chief_complaint,explicit_request,clinic_conflict}, hidden_need, interaction_pattern, encounter_history(0到2筆，每筆含visit,patient_request,clinician_response,patient_feeling), initial_state{trust,anxiety,cooperation，值只能low/medium/high}, disclosure_rules(陣列), success_criteria(2到4項), scoring_rubric{understanding,empathy_explanation,boundaries_resources,collaboration_next_step}。`,
    },
  ];
}

export function patientMessages(scenario, state, history) {
  const conversation = history
    .slice(-12)
    .map(({ role, text: message }) => ({
      role: role === "clinician" ? "user" : "assistant",
      content: message,
    }));
  return [
    {
      role: "system",
      content: `你是 Perxona Avatar 背後的高衝突 Patient Agent。你只能扮演 scenario 中的病人，不可變成醫療助理、不可評分醫師、不可提供診斷或治療建議。回覆預設帶有明顯不耐、懷疑或施壓，不要主動客氣、體諒或快速接受；每輪用繁體中文口語回答1到3句，至少呈現一個可聽出的情緒訊號，例如反問、抱怨、重申要求、打斷感或質疑說法，但不得威脅暴力、歧視、髒話或人身羞辱。當 anxiety=high、trust=low 或 cooperation=low 時，要強烈質疑、反覆要求並挑戰醫師解釋，不能因一次普通道歉就立刻緩和。只有醫師明確回應情緒、合理說明限制，並提出可執行下一步後，才逐輪降低衝突，不可一輪內突然變得合作。依情境加強衝突：repeat_nonadherence 會替自己辯解並要求換方法；unrealistic_expectation 會排斥不確定性並要求保證；unnecessary_request 會堅持指定藥物或檢查並追問為什麼不能做。遵守 disclosure_rules，只有條件符合才揭露隱藏資訊。根據醫師說法更新 state。不要使用 Markdown。${jsonOnly}`,
    },
    {
      role: "system",
      content: `SCENARIO=${JSON.stringify(scenario)}\nCURRENT_STATE=${JSON.stringify(state)}\n回傳欄位：reply_text, state{trust,anxiety,cooperation，值只能low/medium/high}, motion_key(目前填auto), should_end(boolean)。`,
    },
    ...conversation,
  ];
}

export function scoreMessages(scenario, history) {
  return [
    {
      role: "system",
      content: `你是困難醫療溝通訓練的 Scoring Agent。只評估溝通，不判斷診斷或治療正確性。必須依 structured scenario、success criteria、rubric 與實際對話證據評分。每項只能是0、1、2分。${jsonOnly}`,
    },
    {
      role: "user",
      content: `SCENARIO=${JSON.stringify(scenario)}\nDIALOGUE=${JSON.stringify(history.slice(-20))}\n\n回傳欄位：dialogue_summary{what_happened,patient_outcome}, scores{understanding{score,reason},empathy_explanation{score,reason},boundaries_resources{score,reason},collaboration_next_step{score,reason}}, best_point, main_risk, suggested_phrase。`,
    },
  ];
}
