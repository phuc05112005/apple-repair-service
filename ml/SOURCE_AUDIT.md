# Source audit for repair-duration ML

This audit is read-only evidence from the Apple Repair Service source. The ML
phase does not alter backend, frontend, schema or operational data.

## Target ownership

- `RepairDurationService` defines active repair duration from `INSPECTING` and
  `REPAIRING` status intervals.
- `TimingMetricsService` attributes active intervals by intersecting them with
  assignment intervals.
- `ServiceStatusHistory` supplies ordered transitions and timestamps.
- `Assignment` supplies technician, `assignedAt` and `endedAt`.
- Persisted `service_interruptions` exist, but the current duration calculation
  does not subtract them automatically; the data contract records this limit.

## Eligible sample relations

- `ServiceTicket` → one APPROVED `RepairItem` → one concrete
  `ServiceCatalogItem`.
- Exactly one ended `Assignment`; accepted transfer is excluded.
- Catalog exposes device model, issue, service type and standard duration.
- Device model links to device type; assignment links to technician; ticket
  links to branch.

## Warranty mapping

Legacy `ServiceTypeCode.WARRANTY` remains for application compatibility. ML
does not treat it as a technical action. `is_warranty` is derived from warranty
lineage, while the actual remedy/catalog is normalized to `REPAIR` or
`REPLACEMENT`.

## Runtime boundary

The schema already contains `ml_predictions`, but this experiment neither
writes it nor changes its schema. Real extraction, runtime feature building,
inference API, Spring integration and ETA consumption remain future work.
