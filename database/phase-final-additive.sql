-- Apply once to an existing Phase 1.3+ database before running with ddl-auto=validate.
-- Empty received-condition notes are now represented as NULL; no existing data is modified.
ALTER TABLE service_tickets MODIFY COLUMN received_condition TEXT NULL;
