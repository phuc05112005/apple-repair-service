-- Phase 1.5: optional technician candidate for stored ML predictions.
-- Apply ONCE after reviewing the target schema. This script does not modify legacy rows.
ALTER TABLE `ml_predictions`
  ADD COLUMN `technician_id` bigint DEFAULT NULL AFTER `service_ticket_id`;

ALTER TABLE `ml_predictions`
  ADD CONSTRAINT `fk_ml_predictions_technician`
    FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`);

CREATE INDEX `idx_ml_predictions_technician_type_predicted_at`
  ON `ml_predictions` (`technician_id`, `prediction_type`, `predicted_at`);
