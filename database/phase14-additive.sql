-- Phase 1.4: persist the server-side appointment check-in time.
-- Apply once after reviewing the target schema. Do not import schema.sql into an existing database.
ALTER TABLE appointments
    ADD COLUMN arrived_at DATETIME(6) NULL AFTER confirmed_at;
