# perxona-hackathon

# Difficult-Patient Clinical Communication Simulation

## 1. Project Goal

Build a clinical communication training system for newly hired physicians. A virtual patient, presented through **Perxona Avatar**, simulates difficult outpatient encounters. The backend manages scenarios, patient state, LLM-based agents, conversation logs, and post-encounter evaluation.

### Core Flow

```text
Doctor
  ↓
Perxona Avatar
  ↓
Backend API
  ↓
Scenario + Patient State
  ↓
Patient Agent + LLM
  ↓
Patient Response
  ↓
Update State + Save Conversation
  ↓
Evaluation Agent
  ↓
Overall Score + Top Strengths + Top Improvements
```

---

## 2. Backend Architecture

```text
Frontend / Perxona
        │
        ↓
    FastAPI Backend
        │
        ├── Scenario Manager
        ├── Patient Agent
        ├── State Manager
        ├── Evaluation Agent
        └── Rule Engine
        │
        ├──────────────┐
        ↓              ↓
    PostgreSQL        LLM
```

### Recommended Stack

- **Backend:** Python + FastAPI
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Migration:** Alembic
- **LLM:** OpenAI / Gemini API
- **Avatar:** Perxona
- **Deployment:** Docker + cloud or institutional server

### Main Database Entities

```text
users
scenarios
patient_profiles
training_sessions
messages
evaluations
```

---

## 3. Patient Agent

The Patient Agent should combine an LLM with a controlled state machine.

### Patient State

```text
trust
anger
anxiety
cooperation
```

The LLM generates natural language, while deterministic rules control important scenario logic and hidden information.

### State Example

```json
{
  "trust": 0.30,
  "anger": 0.80,
  "anxiety": 0.60,
  "cooperation": 0.20
}
```

The patient's state should change according to the doctor's communication behavior, but the patient should not reveal protected/hidden information unless the scenario conditions are met.

---

## 4. Evaluation Framework

The Evaluation Agent uses three high-level domains:

### A. Relationship & Empathy

Assesses:

- Respect and rapport
- Active listening
- Recognition and acknowledgment of emotions
- Empathy
- Non-judgmental communication
- Trust building

Relevant communication concepts include **Calgary-Cambridge**, **NURSE**, and **OARS**.

### B. Information Gathering & Shared Understanding

Assesses:

- Appropriate open-ended questions
- Focused follow-up questions
- Active listening
- Clarification and summarization
- Understanding the patient's concerns, ideas, and expectations
- Clear explanations
- Confirmation of understanding
- Shared decision-making

### C. Emotional Regulation & De-escalation

Assesses:

- Maintaining professional composure
- Recognizing emotional escalation
- Responding to emotion before arguing or explaining
- Avoiding confrontation
- De-escalating conflict
- Setting appropriate boundaries
- Returning the conversation to the clinical objective

### Scoring

Suggested weighted score:

```text
Relationship & Empathy                  30%
Information Gathering & Understanding   30%
Emotional Regulation & De-escalation    40%
```

Final score: **0–100**

Use broad performance bands internally:

```text
90–100  Excellent
80–89   Good
70–79   Acceptable
60–69   Needs Improvement
<60     Significant Improvement Needed
```

The final user-facing report should contain only:

```text
Overall Score: XX/100

Strengths:
- 0–3 items

Suggested Improvements:
- 0–3 items
```

Feedback should be specific and behavior-based rather than generic. For example, prefer:

> "When the patient expressed frustration, you moved directly into explaining the clinic policy. Acknowledge the patient's concern first, then provide the explanation."

over:

> "Empathy needs improvement."

---

## 5. Evaluation Pipeline

```text
Conversation
    ↓
Behavior Extraction
    ↓
Evidence Collection
    ↓
Three-Domain Evaluation
    ↓
Rule-Based Safety / Critical Error Check
    ↓
Score Aggregation
    ↓
Feedback Generation
    ↓
Strict JSON Output
    ↓
PostgreSQL
```

The evaluator should require evidence from the conversation before assigning a score. It should not reward keywords alone.

---

# 6. Synthetic Patient Scenarios

> All patient data below are fictional and intended only for simulation/training.

| ID | Patient Profile | Main Difficulty | Hidden Information | Training Focus |
|---|---|---|---|---|
| P001 | **Mr. Chen, 52, male.** Chest tightness; impatient and distrustful after a previous unsatisfactory visit. | Angry, interrupts frequently, challenges the physician. | Smokes for 20 years; exertional chest pain; father had myocardial infarction. | Empathy, de-escalation, focused history taking. |
| P002 | **Ms. Lin, 34, female.** Recurrent headaches; highly anxious and convinced she has a brain tumor. | Catastrophizing, repeatedly requests imaging, difficult to reassure. | Symptoms are strongly associated with sleep deprivation; no major neurological red flags. | Anxiety management, risk communication, shared understanding. |
| P003 | **Mr. Huang, 67, male.** Diabetes follow-up; resistant to medication changes. | Distrusts medication, insists on his own treatment plan. | Frequently misses doses and has difficulty paying for medications. | Shared decision-making, exploring beliefs and barriers. |
| P004 | **Ms. Wang, 45, female.** Chronic abdominal discomfort; dissatisfied with previous doctors. | Gives long narratives, becomes upset when redirected. | Symptoms worsen during periods of significant work stress. | Active listening, summarization, agenda setting. |
| P005 | **Mr. Liu, 29, male.** Upper respiratory symptoms; demands antibiotics. | Confrontational when antibiotics are not immediately prescribed. | Symptoms are consistent with a self-limited viral infection. | Explaining uncertainty, expectation management, boundary setting. |
| P006 | **Mrs. Chang, 71, female.** Multiple chronic medications; confused about medication instructions. | Repeatedly asks the same questions and becomes embarrassed. | She has difficulty reading small print and sometimes mixes medication schedules. | Plain-language communication, teach-back, patience. |
| P007 | **Mr. Wu, 40, male.** Back pain; requests a medical certificate and refuses recommended activity modification. | Transaction-focused, defensive when questioned. | He is worried about losing income if he cannot work. | Exploring concerns, negotiation, professional boundaries. |
| P008 | **Ms. Tsai, 26, female.** Palpitations; highly distressed and repeatedly checks her pulse. | Panic-like behavior, difficulty concentrating on questions. | Symptoms began after several nights of poor sleep and excessive caffeine use. | Emotional support, structured questioning, reassurance without dismissal. |
| P009 | **Mr. Yeh, 58, male.** Hypertension follow-up; openly blames the clinic for poor control. | Blaming, sarcastic, reluctant to answer questions. | He frequently stops medication when he feels better and rarely checks blood pressure. | Non-judgmental communication, adherence exploration. |
| P010 | **Ms. Kao, 61, female.** Knee pain; expects an immediate MRI and specialist referral. | Insistent, compares the physician with online medical advice. | She has not completed conservative treatment and expects a specific diagnosis. | Expectation management, evidence-based explanation, shared decisions. |

---

# 7. Clinic Constraints

The simulation should include realistic operational constraints so that physicians must communicate effectively without assuming unlimited resources.

## Personnel

**Small outpatient clinic**

- 1 physician per simulated encounter
- 1 nurse shared across the clinic
- 1 receptionist / administrative staff member
- No dedicated psychologist
- No on-site social worker
- No on-site pharmacist
- Limited time for physician-patient encounters
- Specialist consultation requires external referral

### Implication

The physician cannot simply transfer every difficult conversation to another professional. The simulation should test the physician's ability to manage communication within normal clinic resources.

---

## Professional / Technical Capabilities

The clinic can provide:

- Basic history and physical examination
- Vital signs
- Basic point-of-care testing
- Basic blood and urine tests
- ECG
- Standard outpatient medication management
- Routine follow-up

The clinic cannot provide:

- CT or MRI on site
- Advanced imaging
- Emergency department-level monitoring
- Invasive procedures
- Same-day specialist consultation
- Comprehensive behavioral-health services

### Implication

The physician must explain limitations honestly, distinguish urgent from non-urgent situations, and provide an appropriate referral or follow-up plan rather than promising unavailable services.

---

## Financial Constraints

Assume a **small community clinic with a limited operating budget**.

- Limited ability to purchase new diagnostic equipment
- No dedicated budget for expensive AI infrastructure
- Cloud/API costs must be monitored
- Preference for open-source software where clinically and technically appropriate
- Simulation should primarily use synthetic data
- High-cost investigations should require clinical justification
- The system should minimize unnecessary LLM calls

### Implication for the AI System

The backend should:

1. Store reusable scenario data in PostgreSQL.
2. Avoid sending unnecessary patient data to the LLM.
3. Use deterministic rules for simple state transitions where possible.
4. Use LLM calls mainly for natural-language understanding and generation.
5. Use structured JSON outputs for reliable downstream processing.
6. Log token usage and API costs.

---

# 8. Safety Principles

This is a **communication training simulator**, not an autonomous diagnostic system.

- Patient cases should be synthetic unless appropriate governance and de-identification procedures are established.
- The LLM should not independently determine real-world medical diagnoses or treatment.
- Critical clinical safety rules should be deterministic where possible.
- Scenario-specific red flags should be explicitly encoded.
- The system should distinguish communication performance from clinical correctness.
- Evaluation feedback should identify communication behaviors rather than present itself as definitive clinical supervision.

---

# 9. MVP Development Plan

### Phase 1 — Perxona PoC

Verify:

```text
Avatar → Conversation → Backend
```

### Phase 2 — Database

Implement:

```text
User
Scenario
Patient Profile
Training Session
Message
Evaluation
```

### Phase 3 — Patient Agent

Implement:

```text
Scenario
+
Patient Profile
+
Conversation History
+
Patient State
→ LLM
→ Patient Response
```

### Phase 4 — State Machine

Add:

```text
Trust
Anger
Anxiety
Cooperation
```

and controlled transitions based on physician behavior.

### Phase 5 — Evaluation Agent

Implement:

```text
Behavior Extraction
→ Evidence
→ 3 Domains
→ Score
→ Top Strengths / Improvements
```

### Phase 6 — Integration & Research

Connect Perxona, store complete sessions, build a performance dashboard, and validate AI-generated scores against human/standardized-patient ratings.

---

# 10. Target MVP

The first complete prototype should support:

```text
1 physician
1 virtual patient
1 difficult-patient scenario
1 Perxona Avatar
Text conversation
Patient state tracking
Conversation logging
Automated evaluation
0–100 overall score
≤3 strengths
≤3 suggested improvements
```

The central product concept is:

> **Perxona presents the patient; the backend controls why the patient behaves that way; the Evaluation Agent determines how effectively the physician handled the encounter.**
