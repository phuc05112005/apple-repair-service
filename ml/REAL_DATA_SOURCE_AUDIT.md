# Real Data Source Audit — Option A

Verified on 06/10/2026 against `localhost:3307/apple_repair_service` using a read-only transaction.

- Canonical schema: 33 tables, 305 columns.
- Actual catalog name column: `service_catalog_items.name`.
- Java mapping: `ServiceCatalogItem.name`.
- Catalog rows: 4; unique normalized names: 4; collisions: 0.
- Training catalog vocabulary: 37 values.
- Canonical labels seen during synthetic training: 0.
- Canonical labels unseen during synthetic training: 4; coverage 0%.

The four canonical values are “Sửa chữa mạch pin iPhone 16 Pro”, “Thay pin iPhone 16 Pro — Pisen Tiêu chuẩn”, “Thay pin iPhone 16 Pro — Pisen Dung lượng cao”, and “Tiếp nhận bảo hành”. They remain valid runtime labels and receive `UNSEEN_CATALOG_CATEGORY`.

Source tables used are `service_tickets`, `customer_devices`, `device_models`, `device_types`, `repair_items`, `service_catalog_items`, `service_types`, `service_issues`, `assignments`, `transfers`, `service_status_histories`, and `service_time_estimate_histories`. `service_interruptions` was audited but current production duration semantics do not subtract it. `ml_predictions` is neither read nor written.

No catalog-name collision currently creates ambiguity. If future duplicate names occur, model labels may match because that is the trained representation, while exact history remains isolated by catalog ID. A serious label ambiguity must be audited rather than silently changing the trained representation to `name + id`.
