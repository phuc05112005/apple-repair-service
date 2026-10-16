# Real Data Bridge Re-verification Report

Date: 06/10/2026. Result: **PASS — functionally verified, not production validated**.

Option A corrects the model feature from `CATALOG_<id>` to the canonical display name in `service_catalog_items.name`. The extractor still retains `service_catalog_items.id` internally for exact-catalog history. This prevents display-name changes and duplicate labels from merging or resetting history.

The canonical read-only preflight found 33 tables and 305 columns. The catalog audit found 4 IDs, 4 unique labels, and no collision. The 37-value synthetic training vocabulary covers 0 of the 4 current canonical labels, so representation parity passes and all four labels are classified as unseen. Runtime prediction remains allowed and emits the required warning.

The regenerated real extraction scanned 0 tickets and produced a valid 0 × 24 CSV. Eligible and excluded counts are both 0; `count_by_reason`, technical-action distribution, and warranty distribution are empty. Date range is null, missing counts are zero, and target count is zero with null distribution values. No real-data retraining or production-quality claim is possible.

Validation confirms exact 24-column output, exact frozen 20-feature order, no PII, strict completed-before timestamp semantics, positive targets when rows exist, normalized warranty action, cold start, no duplicates, and offline/runtime formula parity.

The model and synthetic CSV hashes remain unchanged. The feature contract hash changed from `A985960CBFF14AD6A9D59FACFE4C9BD40BCD7E74011E2A20BF52A452332588E1` to `18D6EB1C0BDAC678473FB87F79024AFADCFD10B5F271E97B82394AC594282959` because semantic metadata and the contract version were corrected. This is not retraining.
