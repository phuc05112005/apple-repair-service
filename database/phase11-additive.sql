-- Apply ONCE after Phase 1 schema is installed. Not executed against user data by this task.
-- Do not import schema.sql into an existing database.
-- No historical ETA/defective stock is fabricated for legacy records.
ALTER TABLE `service_tickets`
 ADD COLUMN `assignment_due_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `initial_estimated_start_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `estimated_start_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `initial_estimated_completion_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `estimated_completion_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `actual_repair_started_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `actual_repair_completed_at` datetime(6) DEFAULT NULL,
 ADD COLUMN `estimated_duration_minutes` bigint DEFAULT NULL,
 ADD COLUMN `estimate_source` enum('STANDARD','MANUAL') DEFAULT NULL;

CREATE TABLE `defective_part_returns` (
 `id` bigint NOT NULL AUTO_INCREMENT,
 `branch_id` bigint NOT NULL,
 `part_id` bigint NOT NULL,
 `source_part_usage_id` bigint NOT NULL,
 `quantity` int NOT NULL,
 `status` enum('IN_STOCK','SENT_TO_SUPPLIER','RESOLVED','DISPOSED') NOT NULL,
 `reason` text NOT NULL,
 `note` text,
 `recorded_by` bigint NOT NULL,
 `received_at` datetime(6) NOT NULL,
 `status_changed_by` bigint DEFAULT NULL,
 `status_changed_at` datetime(6) DEFAULT NULL,
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_defective_source_usage` (`source_part_usage_id`),
 KEY `idx_defective_branch_part_status` (`branch_id`,`part_id`,`status`),
 CONSTRAINT `ck_defective_positive_quantity` CHECK (`quantity` > 0),
 CONSTRAINT `fk_defective_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
 CONSTRAINT `fk_defective_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
 CONSTRAINT `fk_defective_usage` FOREIGN KEY (`source_part_usage_id`) REFERENCES `part_usages` (`id`),
 CONSTRAINT `fk_defective_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
 CONSTRAINT `fk_defective_status_actor` FOREIGN KEY (`status_changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_time_estimate_histories` (
 `id` bigint NOT NULL AUTO_INCREMENT,
 `service_ticket_id` bigint NOT NULL,
 `technician_id` bigint DEFAULT NULL,
 `estimated_start_at` datetime(6) DEFAULT NULL,
 `estimated_completion_at` datetime(6) DEFAULT NULL,
 `estimated_duration_minutes` bigint DEFAULT NULL,
 `estimate_source` enum('STANDARD','MANUAL') NOT NULL,
 `reason` text NOT NULL,
 `break_minutes_snapshot` int NOT NULL,
 `approved_price_snapshot` decimal(18,2) DEFAULT NULL,
 `created_at` datetime(6) NOT NULL,
 `created_by` bigint DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `idx_time_estimate_ticket_created` (`service_ticket_id`,`created_at`),
 CONSTRAINT `fk_time_estimate_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`),
 CONSTRAINT `fk_time_estimate_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`),
 CONSTRAINT `fk_time_estimate_actor` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
