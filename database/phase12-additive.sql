-- Apply ONCE to a Phase 1.1 schema before running the Phase 1.2 application.
-- Review the current schema first. This task does not execute this file on the user database.
CREATE TABLE `inventory_lots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `lot_code` varchar(100) NOT NULL,
  `branch_id` bigint NOT NULL,
  `part_id` bigint NOT NULL,
  `received_quantity` int NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `received_by` bigint NOT NULL,
  `source_note` text,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inventory_lots_lot_code` (`lot_code`),
  KEY `idx_inventory_lots_branch_part_received` (`branch_id`,`part_id`,`received_at`),
  CONSTRAINT `ck_inventory_lots_positive_quantity` CHECK (`received_quantity` > 0),
  CONSTRAINT `fk_inventory_lots_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_inventory_lots_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_inventory_lots_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `inventory_transactions`
  ADD COLUMN `inventory_lot_id` bigint DEFAULT NULL,
  ADD KEY `fk_inventory_transactions_lot` (`inventory_lot_id`),
  ADD CONSTRAINT `fk_inventory_transactions_lot` FOREIGN KEY (`inventory_lot_id`) REFERENCES `inventory_lots` (`id`);

ALTER TABLE `repair_items`
  ADD COLUMN `approval_resolved_at` datetime(6) DEFAULT NULL;

ALTER TABLE `service_status_histories`
  ADD COLUMN `resolved_at` datetime(6) DEFAULT NULL,
  ADD COLUMN `resolution_recorded_at` datetime(6) DEFAULT NULL,
  ADD COLUMN `resolution_note` text DEFAULT NULL,
  ADD COLUMN `resolved_by` bigint DEFAULT NULL,
  ADD KEY `fk_status_history_resolved_by` (`resolved_by`),
  ADD CONSTRAINT `fk_status_history_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`);

ALTER TABLE `transfers`
  ADD COLUMN `work_done` text DEFAULT NULL,
  ADD COLUMN `current_condition` text DEFAULT NULL,
  ADD COLUMN `response_note` text DEFAULT NULL;

-- Legacy rows remain nullable. Do not fabricate lot provenance or wait-resolution times.
