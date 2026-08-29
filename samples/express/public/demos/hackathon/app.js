/**
 * Hackathon demo — scenario generation, LLM patient, Perxona presenter,
 * and structured communication feedback. No RAG and no Connect Chatbot.
 */

/** @type {HTMLElement & import('@perxona/presenter-types').IPresentationWidget} */
const presenter = document.querySelector("sv-presenter");
const panels = [...document.querySelectorAll(".stage-panel")];
const steps = [...document.querySelectorAll(".steps li")];
const setupForm = document.getElementById("setup-form");
const optionRoot = document.getElementById("scenario-options");
const generateBtn = document.getElementById("generate-btn");
const startBtn = document.getElementById("start-btn");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const finishBtn = document.getElementById("finish-btn");
const chatLog = document.getElementById("chat-log");
const notice = document.getElementById("notice");

const STEP_ORDER = ["setup", "scenario", "simulation", "result"];
const SCORE_LABELS = {
  understanding: "理解病人與隱藏需求",
  empathy_explanation: "同理與清楚說明",
  boundaries_resources: "界限與資源運用",
  collaboration_next_step: "合作與下一步",
};

const app = {
  config: null,
  clinicInput: null,
  scenario: null,
  patientState: null,
  history: [],
  presenterReady: false,
  audioUnlocked: false,
  busy: false,
};

async function request(path, body) {
  const response = await fetch(path, body && {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message ?? data.error ?? response.statusText), {
      status: response.status,
      data,
    });
  }
  return data;
}

function showNotice(message = "") {
  notice.textContent = message;
  notice.hidden = !message;
}

function showStage(stage) {
  panels.forEach((panel) => { panel.hidden = panel.id !== `${stage}-panel`; });
  const activeIndex = STEP_ORDER.indexOf(stage);
  steps.forEach((step, index) => {
    step.classList.toggle("is-active", index === activeIndex);
    step.classList.toggle("is-done", index < activeIndex);
  });
  showNotice();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setButtonLoading(button, loading, normalText, loadingText) {
  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
}

function makeCard(label, title, detail = "", wide = false) {
  const article = document.createElement("article");
  article.className = `summary-card${wide ? " summary-card--wide" : ""}`;
  const eyebrow = document.createElement("span");
  eyebrow.textContent = label;
  const heading = document.createElement("h3");
  heading.textContent = title;
  article.append(eyebrow, heading);
  if (detail) {
    const paragraph = document.createElement("p");
    paragraph.textContent = detail;
    article.append(paragraph);
  }
  return article;
}

function renderScenario(scenario) {
  const root = document.getElementById("scenario-summary");
  const criteria = document.createElement("article");
  criteria.className = "summary-card summary-card--wide";
  const label = document.createElement("span");
  label.textContent = "這次的練習目標";
  const list = document.createElement("ul");
  list.className = "criteria";
  scenario.success_criteria.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  });
  criteria.append(label, list);
  root.replaceChildren(
    makeCard("情境", scenario.title, scenario.interaction_pattern, true),
    makeCard(
      "虛擬病人",
      `${scenario.patient_profile.display_name}｜${scenario.patient_profile.age_range}`,
      scenario.patient_profile.background,
    ),
    makeCard("主訴", scenario.current_visit.chief_complaint),
    makeCard("明確要求", scenario.current_visit.explicit_request),
    makeCard("診所限制", scenario.current_visit.clinic_conflict),
    criteria,
  );
  startBtn.disabled = !app.presenterReady;
  startBtn.textContent = app.presenterReady ? "開始對話" : "Avatar 載入中";
}

function renderOptions(types) {
  optionRoot.replaceChildren(...types.map((type, index) => {
    const label = document.createElement("label");
    label.className = "scenario-choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "scenario_type";
    input.value = type.id;
    input.required = true;
    input.checked = index === 0;
    const title = document.createElement("strong");
    title.textContent = type.title;
    const description = document.createElement("span");
    description.textContent = type.description;
    label.append(input, title, description);
    return label;
  }));
}

function setupPayload() {
  const form = new FormData(setupForm);
  return {
    scenario_type: form.get("scenario_type"),
    clinic_condition: {
      specialty_services: form.get("specialty_services")?.trim(),
      available_resources: form.get("available_resources")?.trim(),
      unavailable_resources: form.get("unavailable_resources")?.trim(),
      average_visit_time: form.get("average_visit_time")?.trim(),
      referral_followup: form.get("referral_followup")?.trim(),
      situational_pressure: form.get("situational_pressure")?.trim(),
    },
  };
}

async function generateScenario(payload = setupPayload()) {
  app.clinicInput = payload;
  setButtonLoading(generateBtn, true, "生成虛擬病例", "正在生成病例…");
  document.getElementById("regenerate-btn").disabled = true;
  showNotice();
  try {
    const { scenario } = await request("/api/hackathon/scenario", payload);
    app.scenario = scenario;
    renderScenario(scenario);
    showStage("scenario");
  } catch (error) {
    showNotice(`病例生成失敗：${error.message}`);
  } finally {
    setButtonLoading(generateBtn, false, "生成虛擬病例", "正在生成病例…");
    document.getElementById("regenerate-btn").disabled = false;
  }
}

function appendMessage(role, text) {
  const item = document.createElement("li");
  item.className = `message message--${role}`;
  const who = document.createElement("span");
  who.className = "message__role";
  who.textContent = role === "clinician" ? "你（醫療人員）" : app.scenario.patient_profile.display_name;
  const bubble = document.createElement("div");
  bubble.className = "message__bubble";
  bubble.textContent = text;
  item.append(who, bubble);
  chatLog.append(item);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updatePatientState() {
  const state = app.patientState;
  if (!state) return;
  const levels = { low: "低", medium: "中", high: "高" };
  document.getElementById("patient-state").textContent =
    `信任 ${levels[state.trust]}｜焦慮 ${levels[state.anxiety]}`;
}

async function speak(text) {
  if (!app.presenterReady) return;
  const result = await presenter.present(text);
  if (!result?.success) console.error("Presenter failed:", result?.code, result?.message);
}

async function requestPatientReply() {
  presenter.setThinking?.(true);
  try {
    const turn = await request("/api/hackathon/patient", {
      scenario: app.scenario,
      state: app.patientState,
      history: app.history.slice(-20),
    });
    app.patientState = turn.state;
    app.history.push({ role: "patient", text: turn.reply_text });
    appendMessage("patient", turn.reply_text);
    updatePatientState();
    await speak(turn.reply_text);
    if (turn.should_end) showNotice("病人的狀態已適合收尾；你可以結束並查看評分。");
  } finally {
    presenter.setThinking?.(false);
  }
}

async function unlockAudio() {
  if (app.audioUnlocked) return;
  await presenter.resumeAudioPlayback?.();
  app.audioUnlocked = true;
}

async function startSimulation() {
  if (!app.scenario || !app.presenterReady || app.busy) return;
  app.busy = true;
  startBtn.disabled = true;
  startBtn.textContent = "正在建立對話…";
  showNotice();
  try {
    await unlockAudio();
    app.patientState = app.scenario.initial_state;
    app.history = [];
    chatLog.replaceChildren();
    const opening = "您好，我是今天為您看診的醫療人員。請先告訴我，今天最希望處理什麼問題？";
    app.history.push({ role: "clinician", text: opening });
    appendMessage("clinician", opening);
    document.getElementById("patient-name").textContent = app.scenario.patient_profile.display_name;
    document.getElementById("patient-meta").textContent =
      `${app.scenario.patient_profile.age_range}・${app.scenario.patient_profile.speaking_style}`;
    document.getElementById("simulation-title").textContent = app.scenario.title;
    showStage("simulation");
    await requestPatientReply();
    chatInput.focus();
  } catch (error) {
    showNotice(`無法開始對話：${error.message}`);
  } finally {
    app.busy = false;
    startBtn.disabled = false;
    startBtn.textContent = "開始對話";
  }
}

async function sendClinicianTurn(text) {
  if (app.busy || app.history.length >= 20) return;
  app.busy = true;
  sendBtn.disabled = true;
  chatInput.disabled = true;
  showNotice();
  app.history.push({ role: "clinician", text });
  appendMessage("clinician", text);
  try {
    await requestPatientReply();
    if (app.history.length >= 20) {
      chatInput.disabled = true;
      sendBtn.disabled = true;
      showNotice("本次已達 10 輪上限，請結束並查看評分。");
    }
  } catch (error) {
    app.history.pop();
    showNotice(`病人回應失敗：${error.message}`);
  } finally {
    app.busy = false;
    if (app.history.length < 20) {
      sendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }
}

function textArticle(label, text) {
  const article = document.createElement("article");
  const heading = document.createElement("strong");
  heading.textContent = label;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(heading, paragraph);
  return article;
}

function renderScore(result) {
  document.getElementById("total-score").textContent = result.total;
  document.getElementById("score-summary").replaceChildren(
    textArticle("對話經過", result.dialogue_summary.what_happened),
    textArticle("病人結果", result.dialogue_summary.patient_outcome),
  );
  const items = Object.entries(SCORE_LABELS).map(([key, label]) => {
    const item = document.createElement("article");
    item.className = "score-item";
    const head = document.createElement("div");
    head.className = "score-item__head";
    const title = document.createElement("h3");
    title.textContent = label;
    const score = document.createElement("strong");
    score.textContent = `${result.scores[key].score} / 2`;
    const reason = document.createElement("p");
    reason.textContent = result.scores[key].reason;
    head.append(title, score);
    item.append(head, reason);
    return item;
  });
  document.getElementById("score-list").replaceChildren(...items);
  document.getElementById("best-point").textContent = result.best_point;
  document.getElementById("main-risk").textContent = result.main_risk;
  document.getElementById("suggested-phrase").textContent = result.suggested_phrase;
}

async function finishSimulation() {
  if (app.busy || app.history.length < 2) return;
  app.busy = true;
  finishBtn.disabled = true;
  finishBtn.textContent = "評分中…";
  showNotice();
  try {
    const result = await request("/api/hackathon/score", {
      scenario: app.scenario,
      history: app.history.slice(-20),
    });
    renderScore(result);
    showStage("result");
  } catch (error) {
    showNotice(`評分失敗：${error.message}`);
  } finally {
    app.busy = false;
    finishBtn.disabled = false;
    finishBtn.textContent = "結束並評分";
  }
}

async function loadPresenterEngine(url) {
  await new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), {
      type: "module",
      src: url,
      onload: resolve,
      onerror: () => reject(new Error("Presenter engine 載入失敗")),
    });
    document.head.append(script);
  });
}

presenter.addEventListener("PRESENTER_STATUS", (event) => {
  if (event.detail?.status !== "Ready") return;
  app.presenterReady = true;
  document.getElementById("presenter-loading")?.remove();
  if (app.scenario) {
    startBtn.disabled = false;
    startBtn.textContent = "開始對話";
  }
});

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateScenario();
});

document.getElementById("back-btn").addEventListener("click", () => showStage("setup"));
document.getElementById("regenerate-btn").addEventListener("click", () => generateScenario(app.clinicInput));
startBtn.addEventListener("click", startSimulation);
finishBtn.addEventListener("click", finishSimulation);

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  sendClinicianTurn(text);
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.getElementById("restart-btn").addEventListener("click", () => {
  app.scenario = null;
  app.patientState = null;
  app.history = [];
  chatLog.replaceChildren();
  showStage("setup");
});

async function start() {
  const connection = document.getElementById("connection-status");
  const connectionText = document.getElementById("connection-text");
  try {
    const config = await request("/api/hackathon/config");
    app.config = config;
    renderOptions(config.scenarioTypes);
    if (!config.llmConfigured) {
      throw new Error("請先在 .env 設定 LLM 的 API Key、Base URL 與 Model");
    }
    if (!config.fixedTarget) {
      throw new Error("請先在 .env 設定固定的 Avatar、Scene 與 Voice ID");
    }
    await loadPresenterEngine(config.presenterUrl);
    const { connect_key: connectKey } = await request("/api/connect-key");
    await presenter.initializeWithConnectKey(connectKey, config.fixedTarget);
    connection.dataset.state = "ready";
    connectionText.textContent =
      `${config.llmProvider.toUpperCase()}：${config.llmModel ?? "預設模型"}`;
  } catch (error) {
    connection.dataset.state = "error";
    connectionText.textContent = "設定尚未完成";
    const stageError = document.getElementById("presenter-error");
    stageError.textContent = error.message;
    stageError.hidden = false;
    showNotice(error.message);
    generateBtn.disabled = true;
    console.error(error);
  }
}

start();
