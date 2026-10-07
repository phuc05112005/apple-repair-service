# Real Repair Duration Contract v1.1

## Sample and output

One row represents one technically completed ticket with exactly one approved item, one ended assignment, no accepted transfer, a provably known plan at assignment time, complete status history, and a positive target. Output remains exactly 24 columns: four audit/non-feature columns plus the frozen 20 model features.

Training time is `assignments.assigned_at`. At runtime, `candidate_evaluation_timestamp` is the hypothetical assignment time supplied for the batch. Every candidate in a batch uses the same instant. Historical eligibility is always strict: `previous_job.completed_at < prediction_timestamp`.

## Catalog semantics

`catalog_service` is the model categorical label. Its source is `service_catalog_items.name`, mapped by Java entity field `ServiceCatalogItem.name`. `normalize_catalog_service_label` trims surrounding whitespace only; it preserves Unicode, Vietnamese accents, case, punctuation, and internal whitespace. A `CATALOG_<id>` token is forbidden as this model feature.

`internal_catalog_id` is `service_catalog_items.id`. It is retained only in the internal extraction/runtime context and is never one of the 20 model features. The three exact-catalog history features group by this ID:

- `technician_catalog_jobs_before`
- `technician_catalog_average_duration_before`
- `technician_catalog_efficiency_before`

A display-name rename therefore keeps history. Two IDs never merge even when their names match.

## Frozen features

The model receives, in exact order: device type, device model, service issue, technical action, warranty flag, catalog service name, standard minutes, technician ID, branch ID, month, weekday, then overall/issue/exact-catalog technician counts, duration means, and efficiency means. Contract version is `repair-duration-features-v1.1`; feature count/order and the trained model are unchanged.

History formulas for each scope are: `count = completed jobs`; `average duration = sum(actual minutes)/count`; `efficiency = sum(actual minutes/standard minutes)/count`. Cold start uses count 0 and missing (`NaN`) averages/efficiencies.

## Warranty and target

`is_warranty = 1` when `repair_items.warranty_source_item_id` is present. The technical action resolves to only `REPAIR` or `REPLACEMENT` from item remedy, catalog remedy, or the concrete service type. Warranty replacement uses its concrete replacement catalog where recorded. Ambiguous legacy warranty records are excluded.

`actual_technical_minutes = floor(sum(seconds(INSPECTING or REPAIRING intersected with the assignment interval))/60)`. It must be positive. Queue, approval wait, part wait, transfer gap, handover wait, and appointment wait are excluded.

## Vocabulary and unseen categories

`models/experimental/category_vocabulary.json` is descriptive and was derived from the unchanged synthetic training CSV. A catalog label outside it is accepted by CatBoost and emits `UNSEEN_CATALOG_CATEGORY`. This means representation compatibility passed while category familiarity is unseen; it does not mean the model learned that category.

## Privacy and safety

Neither SQL nor output includes customer name, phone, email, address, serial/IMEI, credentials, or free text. Database operations use read-only transactions, SELECT statements, rollback, and close. The bridge never reads or writes `ml_predictions`, never migrates schema, and never mutates business data.
