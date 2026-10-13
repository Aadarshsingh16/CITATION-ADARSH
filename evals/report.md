# Evaluation Report

**Run Date**: 2026-10-13  
**Model Configured**: `openai/gpt-4o`  
**Fast Model**: `google/gemini-2.5-flash`  
**Sample Size**: 12 evaluation test questions across 4 synthetic legal fixtures (including a 125-page agreement)

## Executive Summary

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| **Quote Fabrication Rate** | $\le 5\%$ (after strict verification) | **0%** (0 unverified of 10 proposed) | PASS |
| **Unverified Shown as Genuine** | **0.0%** (Hard Rule) | **0.0%** (0 leaked across all suites) | PASS |
| **Present Recall** | $\ge 90\%$ | **100%** (8/8 facts cited with verified quotes) | PASS |
| **Absence Honesty** | **100.0%** | **100%** (3/3 absence claims honest) | PASS |
| **Large-Doc Coverage Mode** | Complete map-reduce on existence queries | **100.0%** complete coverage verified | PASS |
| **Agent Robustness** | Zero uncaught crashes on invalid tool calls | **100.0%** structured error recovery | PASS |

---

## Detailed Question Results

| ID | Kind | Question | Quotes (Ver / Prop) | Status | Notes |
|---|---|---|---|---|---|
| `q-01` | `present` | What is the governing law of the agreement? | 1 / 1 | PASS | Verified accurately |
| `q-02` | `present` | What is the notice period required to terminate for convenience? | 1 / 1 | PASS | Verified accurately |
| `q-03` | `present` | What are the consulting fees for the initial deliverables? | 1 / 1 | PASS | Verified accurately |
| `q-04` | `absent` | Is there a 50% penalty on late delivery of milestones? | 0 / 0 | PASS | Verified accurately |
| `q-05` | `absent` | Does the contract mandate dispute resolution via SIAC arbitration in Singapore? | 0 / 0 | PASS | Verified accurately |
| `q-06` | `present` | How long does the confidentiality obligation endure after disclosure? | 1 / 1 | PASS | Verified accurately |
| `q-07` | `absent` | Does the agreement permit payments in Bitcoin or cryptocurrency? | 0 / 0 | PASS | Verified accurately |
| `q-08` | `present` | What is the updated termination notice period in Amendment No 1? | 1 / 1 | PASS | Verified accurately |
| `q-09` | `present` | What is the updated contract amount in Amendment No 1? | 1 / 1 | PASS | Verified accurately |
| `q-10` | `existence_large` | What is the service level uptime availability guarantee across schedules? | 1 / 1 | PASS | Verified accurately |
| `q-11` | `multi_doc` | How do the termination notice periods differ between the 2024 MSA and Amendment No 1? | 2 / 2 | PASS | Verified accurately |
| `q-12` | `agent` | Research the exact cure period for material breach using tools. | 1 / 1 | PASS | Verified accurately |

---

## Observations & Edge Case Handling
1. **Verbatim Quote Engine Integrity**: Quotes with minor spacing variations, line breaks, and formatting differences verify accurately while ungrounded assertions are flagged as `unverified` with `not_found`.
2. **Absence Honesty**: When a requested clause does not exist in the contract, the model reliably reports that the provision is absent without inventing citations.
3. **Large Contract Scaling**: The 125-page contract is processed with token budgeting and chunk boundaries, ensuring partial reading is explicitly communicated when capped.
