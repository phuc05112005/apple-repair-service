# Catalog Representation Mismatch — Resolved

The prior bridge encoded `catalog_service` as `CATALOG_<id>`, while the unchanged CatBoost artifact was trained on service display names. Option A was approved and completed as a permanent semantic correction.

- Model label: normalized canonical `service_catalog_items.name`.
- Exact-history identity: internal `service_catalog_items.id`.
- Contract: `repair-duration-features-v1.1`.
- Model, synthetic data, winner, and 20-feature order: unchanged.
- Unseen display names: accepted with `UNSEEN_CATALOG_CATEGORY`.

The mismatch gate is resolved. Tests independently verify representation parity and ID-based history isolation.
