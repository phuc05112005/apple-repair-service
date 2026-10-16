# Real Data Bridge Status

Date: 06/10/2026, Asia/Ho_Chi_Minh.

**GATE PASS — Option A contract v1.1 and real-data pipeline functionally verified.**

- Canonical preflight: 33 tables / 305 columns.
- Read-only extraction: 0 tickets scanned, 0 eligible, 0 excluded, reasons `{}`.
- Output: 0 × 24; exact frozen 20 features; no duplicates or PII.
- Date range: null → null; all missing-value counts 0 because there are no rows.
- Technical action and warranty distributions: `{}`.
- Target count 0; other target statistics null.
- Strict history boundary, warranty normalization, cold start, ID-based exact history, and offline/runtime parity are covered by tests.
- Real data is insufficient for statistical or production validation; no retraining was performed.

Integrity:

- Model SHA-256: `147B5153BCEA0E56651D5535B2B09184208C0E832CC2DE42E01657D9B55CF1AE` (unchanged).
- Synthetic CSV SHA-256: `A0D7BFD0ACE36C7FB940A62203DCD8EF75875391455F65B11E52DF66E3E43C2F` (unchanged).
- Feature contract old SHA-256: `A985960CBFF14AD6A9D59FACFE4C9BD40BCD7E74011E2A20BF52A452332588E1`.
- Feature contract v1.1 SHA-256: `18D6EB1C0BDAC678473FB87F79024AFADCFD10B5F271E97B82394AC594282959`.

The contract checksum changed only because its catalog semantics and version were corrected. The model and feature vector are unchanged. Runtime inference is now implemented as an internal experimental Python service; the next phase is Spring Boot ML integration, persistence, fallback, and ETA integration.
