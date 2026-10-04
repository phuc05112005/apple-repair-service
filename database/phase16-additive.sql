-- Phase 1.6: auditable technical interruption intervals.
-- Apply ONCE after reviewing the target schema. This script only adds one table.
CREATE TABLE `service_interruptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `started_at` datetime(6) NOT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `reason` enum('TECHNICIAN_PERSONAL','SUPPORTING_OTHER_JOB','EQUIPMENT_FAILURE','POWER_OUTAGE','SYSTEM_OUTAGE','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `responsibility_scope` enum('TECHNICIAN','BRANCH','SYSTEM','EXTERNAL','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` enum('SYSTEM','TECHNICIAN','ADMIN','BRANCH_EVENT') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified` bit(1) NOT NULL DEFAULT b'0',
  `incident_group_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `assignment_id` bigint NOT NULL,
  `recorded_by` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_service_interruptions_assignment_started` (`assignment_id`,`started_at`),
  KEY `idx_service_interruptions_incident_group` (`incident_group_code`),
  KEY `idx_service_interruptions_verified_started` (`verified`,`started_at`),
  KEY `fk_service_interruptions_recorded_by` (`recorded_by`),
  CONSTRAINT `ck_service_interruptions_time_order`
    CHECK ((`ended_at` IS NULL) OR (`ended_at` >= `started_at`)),
  CONSTRAINT `fk_service_interruptions_assignment`
    FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`),
  CONSTRAINT `fk_service_interruptions_recorded_by`
    FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
