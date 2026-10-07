# Runtime Inference Final Report

Date: 06/10/2026, Asia/Ho_Chi_Minh.

## 1. Mismatch resolution decision

Option A is complete. `catalog_service` is the semantic model label and catalog ID is an internal exact-history key.

## 2. Old contract

The bridge previously emitted `catalog_service = CATALOG_<service_catalog_items.id>`, which did not match the unchanged synthetic training representation.

## 3. Corrected contract

Contract `repair-duration-features-v1.1` emits the canonical service display name and retains ID outside the model vector.

## 4. Why label and identity are separate

The trained CatBoost model expects names. Historical aggregation needs stable identity across renames and duplicate names, so it exclusively uses catalog ID.

## 5. Catalog source field

SQL field `service_catalog_items.name`; Java field `ServiceCatalogItem.name`.

## 6. Normalization

Only surrounding whitespace is trimmed. Unicode, Vietnamese accents, case, punctuation, and internal whitespace are preserved.

## 7. Catalog audit

Canonical DB has 4 rows, 4 unique normalized names, and 0 collisions. No ambiguity blocker was found.

## 8. Training vocabulary

`category_vocabulary.json` contains 37 unique synthetic `catalog_service` values and is descriptive only.

## 9. Canonical coverage

Seen: 0; unseen: 4; coverage: 0%. All four are allowed but flagged.

## 10. Contract version

`repair-duration-features-v1.1`; the model experiment remains `repair-duration-final-synthetic-v1`.

## 11. Files changed

Added shared catalog normalization, internal history-key support, vocabulary/audit/smoke scripts, runtime loader/features/predictor/repository/service packages, FastAPI app/runner, runtime tests, artifacts, and reports. Updated extraction semantics, contract artifact/generator, requirements, and bridge documents.

## 12. Tests changed or added

Added 48 runtime/API cases for normalization, ID isolation, rename/duplicate behavior, artifact failures, strict history, frozen feature order, warranty, seen/unseen handling, finite prediction, cold start, multi-candidate order, parity, PII, API validation/readiness/errors, and endpoint output. Existing 54 tests remain.

## 13. Test result

`102 passed` with no pytest warnings: 54 existing plus 48 runtime/API cases. Python compile also passed; no legacy test was removed or weakened.

## 14. Real Data Bridge

Read-only canonical extraction produced 0 × 24 from 0 tickets. It functionally verifies the pipeline but cannot validate model quality on real data.

## 15. Offline/runtime parity

The same normalization and history formulas are shared. Tests verify equal model labels and equal internal catalog identity behavior.

## 16. Unseen category behavior

CatBoost returns a finite positive prediction and the result includes `UNSEEN_CATALOG_CATEGORY`. Representation parity is PASS; category familiarity is UNSEEN.

## 17. Model checksum

`147B5153BCEA0E56651D5535B2B09184208C0E832CC2DE42E01657D9B55CF1AE`, unchanged.

## 18. Synthetic dataset checksum

`A0D7BFD0ACE36C7FB940A62203DCD8EF75875391455F65B11E52DF66E3E43C2F`, unchanged.

## 19. Feature contract checksum

Old: `A985960CBFF14AD6A9D59FACFE4C9BD40BCD7E74011E2A20BF52A452332588E1`. New: `18D6EB1C0BDAC678473FB87F79024AFADCFD10B5F271E97B82394AC594282959`. It changed only for versioned semantic correction; no feature or model retraining occurred.

## 20. Runtime architecture

The repository performs read-only source access; feature service builds one shared as-of history index per batch; model loader validates and loads once; predictor returns finite positive minutes with warnings; orchestration preserves candidate order.

## 21. Runtime tests

The 48-case runtime file covers exact 20 columns, same timestamp for every candidate, strict `<` history, cold start, warranty variants, artifact corruption/mismatch, loader single-load behavior, invalid input, and no PII.

## 22. FastAPI

Twenty API cases pass. Live health does not require DB connectivity. Ready health checks model/contract and DB. Model-info exposes experimental flags and runtime versions. Candidate prediction accepts `candidateTechnicianIds`, one bounded unique list, and a timezone-aware timestamp. Responses contain nested model metadata. Errors use stable sanitized codes. Canonical 3307 returned `404/TICKET_NOT_FOUND` for a nonexistent ticket without seeding data. No CORS is enabled.

## 23. Performance smoke

Local smoke: model load 13.15 ms; median end-to-end in-process prediction was 2.06 ms for 1 candidate, 2.20 ms for 3, and 2.93 ms for 10. These are local smoke measurements, not a production SLA.

## 24. PII audit

Runtime SQL does not select customer names, phones, emails, addresses, serials, credentials, or notes. Requests and responses contain technical IDs and derived predictions only.

## 25. Gate result

**PASS.** Final verification completed: 102 tests passed, Python compile passed, live/ready/model-info smoke passed against canonical 3307, and database checksum remained unchanged. The artifact remains experimental and synthetic-trained.

## 26. Explicit confirmations

No retraining; same CatBoost model; `synthetic_data=true`; `production_validated=false`; no Spring changes; no React changes; no ETA changes; no `ml_predictions` writes; no schema changes; no auto assignment; no Docker/deploy; no commit/push.

## 27. Next phase only

Spring Boot ML Integration + persistence + fallback + ETA integration. It is not implemented in this phase.
