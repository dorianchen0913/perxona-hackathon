import assert from "node:assert/strict";
import {
  SCENARIO_TYPES,
  dialoguePayloadError,
  hackathonInputError,
  normalizeScenario,
  normalizeScore,
  parseLlmJson,
  patientMessages,
} from "../lib/hackathon.mjs";

const input = {
  scenario_type: "unnecessary_request",
  clinic_condition: {
    specialty_services: "家醫科",
    available_resources: "常規抽血與轉診",
    unavailable_resources: "進階影像",
    average_visit_time: "10 分鐘",
  },
};

assert.equal(SCENARIO_TYPES.length, 3);
assert.deepEqual(parseLlmJson("```json\n{\"ok\":true}\n```"), { ok: true });
assert.equal(hackathonInputError(input), null);
assert.match(
  hackathonInputError({ ...input, clinic_condition: {} }),
  /Missing clinic fields/,
);

const scenario = normalizeScenario(
  {
    patient_profile: { display_name: "陳先生" },
    encounter_history: [{ visit: "A" }, { visit: "B" }, { visit: "C" }],
    success_criteria: ["辨識擔心", "提出下一步"],
  },
  input,
);
assert.equal(scenario.scenario_type, "unnecessary_request");
assert.equal(scenario.encounter_history.length, 2);
const patientPrompt = patientMessages(
  scenario,
  { trust: "low", anxiety: "high", cooperation: "low" },
  [{ role: "clinician", text: "請說明需求" }],
)[0].content;
assert.match(patientPrompt, /明顯不耐、懷疑或施壓/);
assert.match(patientPrompt, /不能因一次普通道歉就立刻緩和/);
assert.match(patientPrompt, /不得威脅暴力、歧視、髒話或人身羞辱/);
assert.equal(
  dialoguePayloadError({
    scenario,
    history: [{ role: "clinician", text: "請說明需求" }],
  }, true),
  null,
);
assert.match(
  dialoguePayloadError({
    scenario,
    history: [{ role: "patient", text: "我想照 MRI" }],
  }, true),
  /latest history turn/,
);

const score = normalizeScore({
  scores: {
    understanding: { score: 3, reason: "有確認需求" },
    empathy_explanation: { score: 2 },
    boundaries_resources: { score: 1 },
    collaboration_next_step: { score: -1 },
  },
});
assert.equal(score.scores.understanding.score, 2);
assert.equal(score.scores.collaboration_next_step.score, 0);
assert.equal(score.total, 5);

console.log("Hackathon module tests passed.");
