-- Apple Repair Service: canonical empty-database schema (Phase 1).
-- Run ONLY in a newly created, empty database. Contains no seed/business data.
-- Foreign keys are added after all tables exist; checks are never disabled.
-- Existing databases: use additive updates, never re-import this file over user data.
SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE `appointment_date_overrides` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_date` date NOT NULL,
  `mode` varchar(16) NOT NULL,
  `slots_json` text NOT NULL,
  `branch_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_override_branch_date` (`branch_id`,`appointment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `appointment_devices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `symptom_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `appointment_id` bigint NOT NULL,
  `device_model_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_appointment_devices_appointment` (`appointment_id`),
  KEY `fk_appointment_devices_device_model` (`device_model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointment_service_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `base_price_snapshot` decimal(18,2) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `final_price_snapshot` decimal(18,2) DEFAULT NULL,
  `service_name_snapshot` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_device_id` bigint NOT NULL,
  `service_catalog_item_id` bigint NOT NULL,
  `warranty_source_item_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_service_items_device_catalog` (`appointment_device_id`,`service_catalog_item_id`),
  KEY `fk_appointment_service_items_service_catalog_item` (`service_catalog_item_id`),
  KEY `fk_appointment_service_items_warranty_source_item` (`warranty_source_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointment_slots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_date` date NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `end_time` time NOT NULL,
  `start_time` time NOT NULL,
  `status` enum('CLOSED','OPEN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `branch_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_slots_branch_date_time` (`branch_id`,`appointment_date`,`start_time`,`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointment_weekly_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `enabled` bit(1) NOT NULL,
  `slots_json` text NOT NULL,
  `weekday` int NOT NULL,
  `branch_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_weekly_branch_day` (`branch_id`,`weekday`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `appointments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booked_at` datetime(6) NOT NULL,
  `cancel_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `confirmed_at` datetime(6) DEFAULT NULL,
  `discount_percent` decimal(5,2) NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('ARRIVED','CANCELLED','CONFIRMED','EXPIRED','PENDING_CONFIRMATION') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `appointment_slot_id` bigint NOT NULL,
  `confirmed_by` bigint DEFAULT NULL,
  `customer_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_slot_status` (`appointment_slot_id`,`status`),
  KEY `fk_appointments_confirmed_by` (`confirmed_by`),
  KEY `fk_appointments_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assigned_at` datetime(6) NOT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `source` enum('ACCEPTED_RECOMMENDATION','MANUAL_OVERRIDE','TRANSFER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','ENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `assigned_by` bigint NOT NULL,
  `service_ticket_id` bigint NOT NULL,
  `technician_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_assignments_ticket_status` (`service_ticket_id`,`status`),
  KEY `idx_assignments_technician_status` (`technician_id`,`status`),
  KEY `fk_assignments_assigned_by` (`assigned_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `branch_inventories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `quantity` int NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `branch_id` bigint NOT NULL,
  `part_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_inventories_branch_part` (`branch_id`,`part_id`),
  KEY `fk_branch_inventories_part` (`part_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `branches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customer_devices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `serial_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `customer_id` bigint NOT NULL,
  `device_model_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_devices_serial_number` (`serial_number`),
  KEY `fk_customer_devices_customer` (`customer_id`),
  KEY `fk_customer_devices_device_model` (`device_model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `device_models` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `device_type_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_models_device_type_name` (`device_type_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `device_types` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inventory_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `quantity` int NOT NULL,
  `transaction_type` enum('STOCK_IN','STOCK_OUT','TRANSFER','USAGE_OUT','USAGE_RETURN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination_branch_id` bigint DEFAULT NULL,
  `part_id` bigint NOT NULL,
  `part_usage_id` bigint DEFAULT NULL,
  `recorded_by` bigint NOT NULL,
  `source_branch_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_transactions_part_created_at` (`part_id`,`created_at`),
  KEY `fk_inventory_transactions_destination_branch` (`destination_branch_id`),
  KEY `fk_inventory_transactions_part_usage` (`part_usage_id`),
  KEY `fk_inventory_transactions_recorded_by` (`recorded_by`),
  KEY `fk_inventory_transactions_source_branch` (`source_branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ml_predictions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `confidence` decimal(5,4) DEFAULT NULL,
  `model_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_version` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `predicted_at` datetime(6) NOT NULL,
  `predicted_duration_minutes` int DEFAULT NULL,
  `predicted_satisfaction` bit(1) DEFAULT NULL,
  `prediction_type` enum('CUSTOMER_SATISFACTION','REPAIR_DURATION') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_ticket_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ml_predictions_ticket_type_predicted_at` (`service_ticket_id`,`prediction_type`,`predicted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `part_usages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `quantity` int NOT NULL,
  `reversal_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `defective_return_note` text,
  `reversed_at` datetime(6) DEFAULT NULL,
  `status` enum('ACTIVE','REVERSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `used_at` datetime(6) NOT NULL,
  `part_id` bigint NOT NULL,
  `recorded_by` bigint NOT NULL,
  `repair_item_id` bigint NOT NULL,
  `reversed_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_part_usages_part` (`part_id`),
  KEY `fk_part_usages_recorded_by` (`recorded_by`),
  KEY `fk_part_usages_repair_item` (`repair_item_id`),
  KEY `fk_part_usages_reversed_by` (`reversed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `parts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `brand` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `part_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_price` decimal(18,2) NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `variant` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_parts_part_code` (`part_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `repair_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approval_decision_at` datetime(6) DEFAULT NULL,
  `approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `confirmation_method` enum('DIRECT','PHONE','PRE_AUTHORIZED') DEFAULT NULL,
  `warranty_remedy` enum('REPAIR','REPLACEMENT') DEFAULT NULL,
  `warranty_replacement_catalog_id` bigint DEFAULT NULL,
  `approval_status` enum('APPROVED','PENDING','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_price` decimal(18,2) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `final_price` decimal(18,2) DEFAULT NULL,
  `item_name_snapshot` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `warranty_decision` enum('APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warranty_decision_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `warranty_end_date` date DEFAULT NULL,
  `warranty_start_date` date DEFAULT NULL,
  `approval_recorded_by` bigint DEFAULT NULL,
  `service_catalog_item_id` bigint NOT NULL,
  `service_ticket_id` bigint NOT NULL,
  `warranty_source_item_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_repair_items_approval_recorded_by` (`approval_recorded_by`),
  KEY `fk_repair_items_service_catalog_item` (`service_catalog_item_id`),
  KEY `fk_repair_items_service_ticket` (`service_ticket_id`),
  KEY `fk_repair_items_warranty_source_item` (`warranty_source_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_catalog_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `configured_price` decimal(18,2) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `standard_duration_minutes` int DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `warranty_days` int NOT NULL,
  `device_model_id` bigint NOT NULL,
  `part_id` bigint DEFAULT NULL,
  `service_issue_id` bigint NOT NULL,
  `service_type_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_service_catalog_items_device_model` (`device_model_id`),
  KEY `fk_service_catalog_items_part` (`part_id`),
  KEY `fk_service_catalog_items_service_issue` (`service_issue_id`),
  KEY `fk_service_catalog_items_service_type` (`service_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_feedbacks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `satisfied` bit(1) NOT NULL,
  `service_ticket_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_feedbacks_service_ticket` (`service_ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_issue_device_types` (
  `service_issue_id` bigint NOT NULL,
  `device_type_id` bigint NOT NULL,
  UNIQUE KEY `uk_service_issue_device_type` (`service_issue_id`,`device_type_id`),
  KEY `FK8ofnlysdl7mab9y7l5c2oejaj` (`device_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `service_issues` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `mapping_initialized` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_issues_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_status_histories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `changed_at` datetime(6) NOT NULL,
  `from_status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `to_status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` bigint DEFAULT NULL,
  `service_ticket_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_service_status_histories_ticket_changed_at` (`service_ticket_id`,`changed_at`),
  KEY `fk_service_status_histories_changed_by` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_tickets` (
  `assignment_due_at` datetime(6) DEFAULT NULL,
  `initial_estimated_start_at` datetime(6) DEFAULT NULL,
  `estimated_start_at` datetime(6) DEFAULT NULL,
  `initial_estimated_completion_at` datetime(6) DEFAULT NULL,
  `estimated_completion_at` datetime(6) DEFAULT NULL,
  `actual_repair_started_at` datetime(6) DEFAULT NULL,
  `actual_repair_completed_at` datetime(6) DEFAULT NULL,
  `estimated_duration_minutes` bigint DEFAULT NULL,
  `estimate_source` enum('STANDARD','MANUAL') DEFAULT NULL,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cancel_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `discount_percent` decimal(5,2) NOT NULL,
  `handed_over_at` datetime(6) DEFAULT NULL,
  `customer_reported_issue` text COLLATE utf8mb4_unicode_ci,
  `authorized_scope` text,
  `inspection_result` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `paid_at` datetime(6) DEFAULT NULL,
  `payment_method` enum('BANK_TRANSFER','CARD','CASH','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` enum('PAID','PENDING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `received_condition` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ticket_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `appointment_device_id` bigint DEFAULT NULL,
  `branch_id` bigint NOT NULL,
  `created_by` bigint NOT NULL,
  `customer_device_id` bigint NOT NULL,
  `handed_over_by` bigint DEFAULT NULL,
  `inspected_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_tickets_ticket_code` (`ticket_code`),
  UNIQUE KEY `uk_service_tickets_appointment_device` (`appointment_device_id`),
  KEY `idx_service_tickets_status` (`status`),
  KEY `idx_service_tickets_branch` (`branch_id`),
  KEY `fk_service_tickets_created_by` (`created_by`),
  KEY `fk_service_tickets_customer_device` (`customer_device_id`),
  KEY `fk_service_tickets_handed_over_by` (`handed_over_by`),
  KEY `fk_service_tickets_inspected_by` (`inspected_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_types` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` enum('REPAIR','REPLACEMENT','WARRANTY') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_types_code` (`code`),
  UNIQUE KEY `uk_service_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `setting_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_settings_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `technician_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `end_time` time NOT NULL,
  `start_time` time NOT NULL,
  `status` enum('CANCELLED','OFF','WORKING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `work_date` date NOT NULL,
  `branch_id` bigint NOT NULL,
  `technician_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_technician_schedules_shift` (`technician_id`,`branch_id`,`work_date`,`start_time`,`end_time`),
  KEY `idx_technician_schedules_branch_date_status` (`branch_id`,`work_date`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transfers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mode` enum('DIRECT','REQUEST') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `requested_at` datetime(6) NOT NULL,
  `responded_at` datetime(6) DEFAULT NULL,
  `status` enum('ACCEPTED','CANCELLED','PENDING','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_assignment_id` bigint NOT NULL,
  `requested_by` bigint NOT NULL,
  `responded_by` bigint DEFAULT NULL,
  `target_technician_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_transfers_from_assignment` (`from_assignment_id`),
  KEY `fk_transfers_requested_by` (`requested_by`),
  KEY `fk_transfers_responded_by` (`responded_by`),
  KEY `fk_transfers_target_technician` (`target_technician_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','RECEPTIONIST','TECHNICIAN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Referential integrity
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

ALTER TABLE `appointment_date_overrides` ADD CONSTRAINT `FK17mo5ydjbrbqx36s9j66oif1q` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `appointment_devices` ADD CONSTRAINT `fk_appointment_devices_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`);
ALTER TABLE `appointment_devices` ADD CONSTRAINT `fk_appointment_devices_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`);
ALTER TABLE `appointment_service_items` ADD CONSTRAINT `fk_appointment_service_items_appointment_device` FOREIGN KEY (`appointment_device_id`) REFERENCES `appointment_devices` (`id`);
ALTER TABLE `appointment_service_items` ADD CONSTRAINT `fk_appointment_service_items_service_catalog_item` FOREIGN KEY (`service_catalog_item_id`) REFERENCES `service_catalog_items` (`id`);
ALTER TABLE `appointment_service_items` ADD CONSTRAINT `fk_appointment_service_items_warranty_source_item` FOREIGN KEY (`warranty_source_item_id`) REFERENCES `repair_items` (`id`);
ALTER TABLE `appointment_slots` ADD CONSTRAINT `fk_appointment_slots_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `appointment_weekly_schedules` ADD CONSTRAINT `FK97f0jotveont22cp3nklpg7ve` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_appointment_slot` FOREIGN KEY (`appointment_slot_id`) REFERENCES `appointment_slots` (`id`);
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`);
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appointments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);
ALTER TABLE `assignments` ADD CONSTRAINT `fk_assignments_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`);
ALTER TABLE `assignments` ADD CONSTRAINT `fk_assignments_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`);
ALTER TABLE `assignments` ADD CONSTRAINT `fk_assignments_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`);
ALTER TABLE `branch_inventories` ADD CONSTRAINT `fk_branch_inventories_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `branch_inventories` ADD CONSTRAINT `fk_branch_inventories_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`);
ALTER TABLE `customer_devices` ADD CONSTRAINT `fk_customer_devices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);
ALTER TABLE `customer_devices` ADD CONSTRAINT `fk_customer_devices_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`);
ALTER TABLE `device_models` ADD CONSTRAINT `fk_device_models_device_type` FOREIGN KEY (`device_type_id`) REFERENCES `device_types` (`id`);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `fk_inventory_transactions_destination_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `fk_inventory_transactions_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `fk_inventory_transactions_part_usage` FOREIGN KEY (`part_usage_id`) REFERENCES `part_usages` (`id`);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `fk_inventory_transactions_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`);
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `fk_inventory_transactions_source_branch` FOREIGN KEY (`source_branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `ml_predictions` ADD CONSTRAINT `fk_ml_predictions_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`);
ALTER TABLE `part_usages` ADD CONSTRAINT `fk_part_usages_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`);
ALTER TABLE `part_usages` ADD CONSTRAINT `fk_part_usages_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`);
ALTER TABLE `part_usages` ADD CONSTRAINT `fk_part_usages_repair_item` FOREIGN KEY (`repair_item_id`) REFERENCES `repair_items` (`id`);
ALTER TABLE `part_usages` ADD CONSTRAINT `fk_part_usages_reversed_by` FOREIGN KEY (`reversed_by`) REFERENCES `users` (`id`);
ALTER TABLE `repair_items` ADD CONSTRAINT `fk_repair_items_approval_recorded_by` FOREIGN KEY (`approval_recorded_by`) REFERENCES `users` (`id`);
ALTER TABLE `repair_items` ADD CONSTRAINT `fk_repair_items_service_catalog_item` FOREIGN KEY (`service_catalog_item_id`) REFERENCES `service_catalog_items` (`id`);
ALTER TABLE `repair_items` ADD CONSTRAINT `fk_repair_items_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`);
ALTER TABLE `repair_items` ADD CONSTRAINT `fk_repair_items_warranty_source_item` FOREIGN KEY (`warranty_source_item_id`) REFERENCES `repair_items` (`id`);
ALTER TABLE `service_catalog_items` ADD CONSTRAINT `fk_service_catalog_items_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`);
ALTER TABLE `service_catalog_items` ADD CONSTRAINT `fk_service_catalog_items_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`);
ALTER TABLE `service_catalog_items` ADD CONSTRAINT `fk_service_catalog_items_service_issue` FOREIGN KEY (`service_issue_id`) REFERENCES `service_issues` (`id`);
ALTER TABLE `service_catalog_items` ADD CONSTRAINT `fk_service_catalog_items_service_type` FOREIGN KEY (`service_type_id`) REFERENCES `service_types` (`id`);
ALTER TABLE `service_feedbacks` ADD CONSTRAINT `fk_service_feedbacks_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`);
ALTER TABLE `service_issue_device_types` ADD CONSTRAINT `FK8ofnlysdl7mab9y7l5c2oejaj` FOREIGN KEY (`device_type_id`) REFERENCES `device_types` (`id`);
ALTER TABLE `service_issue_device_types` ADD CONSTRAINT `FKn4ysgewlapc95jjkiht4gsm0p` FOREIGN KEY (`service_issue_id`) REFERENCES `service_issues` (`id`);
ALTER TABLE `service_status_histories` ADD CONSTRAINT `fk_service_status_histories_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`);
ALTER TABLE `service_status_histories` ADD CONSTRAINT `fk_service_status_histories_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_appointment_device` FOREIGN KEY (`appointment_device_id`) REFERENCES `appointment_devices` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_customer_device` FOREIGN KEY (`customer_device_id`) REFERENCES `customer_devices` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_handed_over_by` FOREIGN KEY (`handed_over_by`) REFERENCES `users` (`id`);
ALTER TABLE `service_tickets` ADD CONSTRAINT `fk_service_tickets_inspected_by` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`id`);
ALTER TABLE `technician_schedules` ADD CONSTRAINT `fk_technician_schedules_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`);
ALTER TABLE `technician_schedules` ADD CONSTRAINT `fk_technician_schedules_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`);
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_from_assignment` FOREIGN KEY (`from_assignment_id`) REFERENCES `assignments` (`id`);
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`);
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_responded_by` FOREIGN KEY (`responded_by`) REFERENCES `users` (`id`);
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_target_technician` FOREIGN KEY (`target_technician_id`) REFERENCES `users` (`id`);

ALTER TABLE `repair_items` ADD CONSTRAINT `fk_repair_items_warranty_replacement_catalog` FOREIGN KEY (`warranty_replacement_catalog_id`) REFERENCES `service_catalog_items` (`id`);
