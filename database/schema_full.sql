CREATE DATABASE  IF NOT EXISTS `apple_repair_service` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `apple_repair_service`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: apple_repair_service
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `appointment_date_overrides`
--

DROP TABLE IF EXISTS `appointment_date_overrides`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_date_overrides` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `appointment_date` date NOT NULL,
  `mode` varchar(16) NOT NULL,
  `slots_json` text NOT NULL,
  `branch_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_override_branch_date` (`branch_id`,`appointment_date`),
  CONSTRAINT `FK17mo5ydjbrbqx36s9j66oif1q` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment_devices`
--

DROP TABLE IF EXISTS `appointment_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_devices` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `symptom_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `appointment_id` bigint NOT NULL,
  `device_model_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_appointment_devices_appointment` (`appointment_id`),
  KEY `fk_appointment_devices_device_model` (`device_model_id`),
  CONSTRAINT `fk_appointment_devices_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `fk_appointment_devices_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment_service_items`
--

DROP TABLE IF EXISTS `appointment_service_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `fk_appointment_service_items_warranty_source_item` (`warranty_source_item_id`),
  CONSTRAINT `fk_appointment_service_items_appointment_device` FOREIGN KEY (`appointment_device_id`) REFERENCES `appointment_devices` (`id`),
  CONSTRAINT `fk_appointment_service_items_service_catalog_item` FOREIGN KEY (`service_catalog_item_id`) REFERENCES `service_catalog_items` (`id`),
  CONSTRAINT `fk_appointment_service_items_warranty_source_item` FOREIGN KEY (`warranty_source_item_id`) REFERENCES `repair_items` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment_slots`
--

DROP TABLE IF EXISTS `appointment_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  UNIQUE KEY `uk_appointment_slots_branch_date_time` (`branch_id`,`appointment_date`,`start_time`,`end_time`),
  CONSTRAINT `fk_appointment_slots_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5396 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment_weekly_schedules`
--

DROP TABLE IF EXISTS `appointment_weekly_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_weekly_schedules` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `enabled` bit(1) NOT NULL,
  `slots_json` text NOT NULL,
  `weekday` int NOT NULL,
  `branch_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_appointment_weekly_branch_day` (`branch_id`,`weekday`),
  CONSTRAINT `FK97f0jotveont22cp3nklpg7ve` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `arrived_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_slot_status` (`appointment_slot_id`,`status`),
  KEY `fk_appointments_confirmed_by` (`confirmed_by`),
  KEY `fk_appointments_customer` (`customer_id`),
  CONSTRAINT `fk_appointments_appointment_slot` FOREIGN KEY (`appointment_slot_id`) REFERENCES `appointment_slots` (`id`),
  CONSTRAINT `fk_appointments_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appointments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `assignments`
--

DROP TABLE IF EXISTS `assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `fk_assignments_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_assignments_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_assignments_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`),
  CONSTRAINT `fk_assignments_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `branch_inventories`
--

DROP TABLE IF EXISTS `branch_inventories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch_inventories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `quantity` int NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `branch_id` bigint NOT NULL,
  `part_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_inventories_branch_part` (`branch_id`,`part_id`),
  KEY `fk_branch_inventories_part` (`part_id`),
  CONSTRAINT `fk_branch_inventories_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_branch_inventories_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=130 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1829 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer_devices`
--

DROP TABLE IF EXISTS `customer_devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `fk_customer_devices_device_model` (`device_model_id`),
  CONSTRAINT `fk_customer_devices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_customer_devices_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1517 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=1345 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `defective_part_returns`
--

DROP TABLE IF EXISTS `defective_part_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `defective_part_returns` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `note` text,
  `quantity` int NOT NULL,
  `reason` text NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `status` enum('DISPOSED','IN_STOCK','RESOLVED','SENT_TO_SUPPLIER') NOT NULL,
  `status_changed_at` datetime(6) DEFAULT NULL,
  `branch_id` bigint NOT NULL,
  `part_id` bigint NOT NULL,
  `recorded_by` bigint NOT NULL,
  `source_part_usage_id` bigint NOT NULL,
  `status_changed_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_defective_source_usage` (`source_part_usage_id`),
  KEY `idx_defective_branch_part_status` (`branch_id`,`part_id`,`status`),
  KEY `fk_defective_part` (`part_id`),
  KEY `fk_defective_recorder` (`recorded_by`),
  KEY `fk_defective_status_actor` (`status_changed_by`),
  CONSTRAINT `fk_defective_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_defective_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_defective_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_defective_status_actor` FOREIGN KEY (`status_changed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_defective_usage` FOREIGN KEY (`source_part_usage_id`) REFERENCES `part_usages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_models`
--

DROP TABLE IF EXISTS `device_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_models` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `device_type_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_models_device_type_name` (`device_type_id`,`name`),
  CONSTRAINT `fk_device_models_device_type` FOREIGN KEY (`device_type_id`) REFERENCES `device_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1446 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `device_types`
--

DROP TABLE IF EXISTS `device_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `device_types` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_types_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=1395 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_lots`
--

DROP TABLE IF EXISTS `inventory_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_lots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `lot_code` varchar(100) NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `received_quantity` int NOT NULL,
  `source_note` text,
  `branch_id` bigint NOT NULL,
  `part_id` bigint NOT NULL,
  `received_by` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inventory_lots_lot_code` (`lot_code`),
  KEY `idx_inventory_lots_branch_part_received` (`branch_id`,`part_id`,`received_at`),
  KEY `fk_inventory_lots_part` (`part_id`),
  KEY `fk_inventory_lots_received_by` (`received_by`),
  CONSTRAINT `fk_inventory_lots_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_inventory_lots_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_inventory_lots_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `inventory_lot_id` bigint DEFAULT NULL,
  `supplier_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cost_price` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_transactions_part_created_at` (`part_id`,`created_at`),
  KEY `fk_inventory_transactions_destination_branch` (`destination_branch_id`),
  KEY `fk_inventory_transactions_part_usage` (`part_usage_id`),
  KEY `fk_inventory_transactions_recorded_by` (`recorded_by`),
  KEY `fk_inventory_transactions_source_branch` (`source_branch_id`),
  KEY `fk_inventory_transactions_lot` (`inventory_lot_id`),
  CONSTRAINT `fk_inventory_transactions_destination_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_inventory_transactions_lot` FOREIGN KEY (`inventory_lot_id`) REFERENCES `inventory_lots` (`id`),
  CONSTRAINT `fk_inventory_transactions_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_inventory_transactions_part_usage` FOREIGN KEY (`part_usage_id`) REFERENCES `part_usages` (`id`),
  CONSTRAINT `fk_inventory_transactions_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_inventory_transactions_source_branch` FOREIGN KEY (`source_branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=163 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ml_predictions`
--

DROP TABLE IF EXISTS `ml_predictions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `technician_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ml_predictions_ticket_type_predicted_at` (`service_ticket_id`,`prediction_type`,`predicted_at`),
  KEY `idx_ml_predictions_technician_type_predicted_at` (`technician_id`,`prediction_type`,`predicted_at`),
  CONSTRAINT `fk_ml_predictions_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`),
  CONSTRAINT `fk_ml_predictions_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `part_device_models`
--

DROP TABLE IF EXISTS `part_device_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `part_device_models` (
  `part_id` bigint NOT NULL,
  `device_model_id` bigint NOT NULL,
  PRIMARY KEY (`part_id`,`device_model_id`),
  KEY `fk_pdm_model` (`device_model_id`),
  CONSTRAINT `fk_pdm_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pdm_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `part_usages`
--

DROP TABLE IF EXISTS `part_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `part_usages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `quantity` int NOT NULL,
  `reversal_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `reversed_at` datetime(6) DEFAULT NULL,
  `status` enum('ACTIVE','REVERSED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `used_at` datetime(6) NOT NULL,
  `part_id` bigint NOT NULL,
  `recorded_by` bigint NOT NULL,
  `repair_item_id` bigint NOT NULL,
  `reversed_by` bigint DEFAULT NULL,
  `defective_return_note` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_part_usages_part` (`part_id`),
  KEY `fk_part_usages_recorded_by` (`recorded_by`),
  KEY `fk_part_usages_repair_item` (`repair_item_id`),
  KEY `fk_part_usages_reversed_by` (`reversed_by`),
  CONSTRAINT `fk_part_usages_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_part_usages_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_part_usages_repair_item` FOREIGN KEY (`repair_item_id`) REFERENCES `repair_items` (`id`),
  CONSTRAINT `fk_part_usages_reversed_by` FOREIGN KEY (`reversed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `parts`
--

DROP TABLE IF EXISTS `parts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `brand` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `part_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_price` decimal(18,2) DEFAULT '0.00',
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `variant` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manufacturer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_issue_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_parts_part_code` (`part_code`),
  KEY `fk_parts_service_issue` (`service_issue_id`),
  CONSTRAINT `fk_parts_service_issue` FOREIGN KEY (`service_issue_id`) REFERENCES `service_issues` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repair_items`
--

DROP TABLE IF EXISTS `repair_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `repair_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approval_decision_at` datetime(6) DEFAULT NULL,
  `approval_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
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
  `confirmation_method` enum('DIRECT','PHONE','PRE_AUTHORIZED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warranty_remedy` enum('REPAIR','REPLACEMENT') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warranty_replacement_catalog_id` bigint DEFAULT NULL,
  `approval_resolved_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_repair_items_approval_recorded_by` (`approval_recorded_by`),
  KEY `fk_repair_items_service_catalog_item` (`service_catalog_item_id`),
  KEY `fk_repair_items_service_ticket` (`service_ticket_id`),
  KEY `fk_repair_items_warranty_source_item` (`warranty_source_item_id`),
  KEY `fk_repair_items_warranty_replacement_catalog` (`warranty_replacement_catalog_id`),
  CONSTRAINT `fk_repair_items_approval_recorded_by` FOREIGN KEY (`approval_recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_repair_items_service_catalog_item` FOREIGN KEY (`service_catalog_item_id`) REFERENCES `service_catalog_items` (`id`),
  CONSTRAINT `fk_repair_items_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`),
  CONSTRAINT `fk_repair_items_warranty_replacement_catalog` FOREIGN KEY (`warranty_replacement_catalog_id`) REFERENCES `service_catalog_items` (`id`),
  CONSTRAINT `fk_repair_items_warranty_source_item` FOREIGN KEY (`warranty_source_item_id`) REFERENCES `repair_items` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_catalog_items`
--

DROP TABLE IF EXISTS `service_catalog_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `warranty_remedy` enum('REPAIR','REPLACEMENT') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `warranty_replacement_catalog_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_service_catalog_items_device_model` (`device_model_id`),
  KEY `fk_service_catalog_items_part` (`part_id`),
  KEY `fk_service_catalog_items_service_issue` (`service_issue_id`),
  KEY `fk_service_catalog_items_service_type` (`service_type_id`),
  KEY `fk_service_catalog_warranty_replacement` (`warranty_replacement_catalog_id`),
  CONSTRAINT `fk_service_catalog_items_device_model` FOREIGN KEY (`device_model_id`) REFERENCES `device_models` (`id`),
  CONSTRAINT `fk_service_catalog_items_part` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`),
  CONSTRAINT `fk_service_catalog_items_service_issue` FOREIGN KEY (`service_issue_id`) REFERENCES `service_issues` (`id`),
  CONSTRAINT `fk_service_catalog_items_service_type` FOREIGN KEY (`service_type_id`) REFERENCES `service_types` (`id`),
  CONSTRAINT `fk_service_catalog_warranty_replacement` FOREIGN KEY (`warranty_replacement_catalog_id`) REFERENCES `service_catalog_items` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=384 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_feedbacks`
--

DROP TABLE IF EXISTS `service_feedbacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_feedbacks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL,
  `satisfied` bit(1) NOT NULL,
  `service_ticket_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_feedbacks_service_ticket` (`service_ticket_id`),
  CONSTRAINT `fk_service_feedbacks_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_interruptions`
--

DROP TABLE IF EXISTS `service_interruptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_interruptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `ended_at` datetime(6) DEFAULT NULL,
  `incident_group_code` varchar(100) DEFAULT NULL,
  `note` text,
  `reason` enum('EQUIPMENT_FAILURE','OTHER','POWER_OUTAGE','SUPPORTING_OTHER_JOB','SYSTEM_OUTAGE','TECHNICIAN_PERSONAL') NOT NULL,
  `responsibility_scope` enum('BRANCH','EXTERNAL','OTHER','SYSTEM','TECHNICIAN') NOT NULL,
  `source` enum('ADMIN','BRANCH_EVENT','SYSTEM','TECHNICIAN') NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `verified` bit(1) NOT NULL DEFAULT b'0',
  `assignment_id` bigint NOT NULL,
  `recorded_by` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_service_interruptions_assignment_started` (`assignment_id`,`started_at`),
  KEY `idx_service_interruptions_incident_group` (`incident_group_code`),
  KEY `idx_service_interruptions_verified_started` (`verified`,`started_at`),
  KEY `fk_service_interruptions_recorded_by` (`recorded_by`),
  CONSTRAINT `fk_service_interruptions_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`),
  CONSTRAINT `fk_service_interruptions_recorded_by` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `ck_service_interruptions_time_order` CHECK (((`ended_at` is null) or (`ended_at` >= `started_at`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_issue_device_types`
--

DROP TABLE IF EXISTS `service_issue_device_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_issue_device_types` (
  `service_issue_id` bigint NOT NULL,
  `device_type_id` bigint NOT NULL,
  UNIQUE KEY `uk_service_issue_device_type` (`service_issue_id`,`device_type_id`),
  KEY `FK8ofnlysdl7mab9y7l5c2oejaj` (`device_type_id`),
  CONSTRAINT `FK8ofnlysdl7mab9y7l5c2oejaj` FOREIGN KEY (`device_type_id`) REFERENCES `device_types` (`id`),
  CONSTRAINT `FKn4ysgewlapc95jjkiht4gsm0p` FOREIGN KEY (`service_issue_id`) REFERENCES `service_issues` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_issues`
--

DROP TABLE IF EXISTS `service_issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_issues` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `mapping_initialized` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_issues_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_status_histories`
--

DROP TABLE IF EXISTS `service_status_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_status_histories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `changed_at` datetime(6) NOT NULL,
  `from_status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `to_status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` bigint DEFAULT NULL,
  `service_ticket_id` bigint NOT NULL,
  `resolution_note` text COLLATE utf8mb4_unicode_ci,
  `resolution_recorded_at` datetime(6) DEFAULT NULL,
  `resolved_at` datetime(6) DEFAULT NULL,
  `resolved_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_service_status_histories_ticket_changed_at` (`service_ticket_id`,`changed_at`),
  KEY `fk_service_status_histories_changed_by` (`changed_by`),
  KEY `fk_status_history_resolved_by` (`resolved_by`),
  CONSTRAINT `fk_service_status_histories_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_service_status_histories_service_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`),
  CONSTRAINT `fk_status_history_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_tickets`
--

DROP TABLE IF EXISTS `service_tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_tickets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cancel_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `discount_percent` decimal(5,2) NOT NULL,
  `handed_over_at` datetime(6) DEFAULT NULL,
  `inspection_result` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `paid_at` datetime(6) DEFAULT NULL,
  `payment_method` enum('BANK_TRANSFER','CARD','CASH','OTHER') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` enum('PAID','PENDING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_at` datetime(6) NOT NULL,
  `received_condition` text COLLATE utf8mb4_unicode_ci,
  `status` enum('ASSIGNED','CANCELLED','HANDED_OVER','INSPECTING','REPAIRING','WAITING_APPROVAL','WAITING_ASSIGNMENT','WAITING_HANDOVER','WAITING_PART') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ticket_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `appointment_device_id` bigint DEFAULT NULL,
  `branch_id` bigint NOT NULL,
  `created_by` bigint NOT NULL,
  `customer_device_id` bigint NOT NULL,
  `handed_over_by` bigint DEFAULT NULL,
  `inspected_by` bigint DEFAULT NULL,
  `customer_reported_issue` text COLLATE utf8mb4_unicode_ci,
  `authorized_scope` text COLLATE utf8mb4_unicode_ci,
  `actual_repair_completed_at` datetime(6) DEFAULT NULL,
  `actual_repair_started_at` datetime(6) DEFAULT NULL,
  `assignment_due_at` datetime(6) DEFAULT NULL,
  `estimate_source` enum('MANUAL','STANDARD') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimated_completion_at` datetime(6) DEFAULT NULL,
  `estimated_duration_minutes` bigint DEFAULT NULL,
  `estimated_start_at` datetime(6) DEFAULT NULL,
  `initial_estimated_completion_at` datetime(6) DEFAULT NULL,
  `initial_estimated_start_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_tickets_ticket_code` (`ticket_code`),
  UNIQUE KEY `uk_service_tickets_appointment_device` (`appointment_device_id`),
  KEY `idx_service_tickets_status` (`status`),
  KEY `idx_service_tickets_branch` (`branch_id`),
  KEY `fk_service_tickets_created_by` (`created_by`),
  KEY `fk_service_tickets_customer_device` (`customer_device_id`),
  KEY `fk_service_tickets_handed_over_by` (`handed_over_by`),
  KEY `fk_service_tickets_inspected_by` (`inspected_by`),
  CONSTRAINT `fk_service_tickets_appointment_device` FOREIGN KEY (`appointment_device_id`) REFERENCES `appointment_devices` (`id`),
  CONSTRAINT `fk_service_tickets_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_service_tickets_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_service_tickets_customer_device` FOREIGN KEY (`customer_device_id`) REFERENCES `customer_devices` (`id`),
  CONSTRAINT `fk_service_tickets_handed_over_by` FOREIGN KEY (`handed_over_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_service_tickets_inspected_by` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_time_estimate_histories`
--

DROP TABLE IF EXISTS `service_time_estimate_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_time_estimate_histories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approved_price_snapshot` decimal(18,2) DEFAULT NULL,
  `break_minutes_snapshot` int NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `estimate_source` enum('MANUAL','STANDARD') NOT NULL,
  `estimated_completion_at` datetime(6) DEFAULT NULL,
  `estimated_duration_minutes` bigint DEFAULT NULL,
  `estimated_start_at` datetime(6) DEFAULT NULL,
  `reason` text NOT NULL,
  `created_by` bigint DEFAULT NULL,
  `service_ticket_id` bigint NOT NULL,
  `technician_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_time_estimate_ticket_created` (`service_ticket_id`,`created_at`),
  KEY `fk_time_estimate_actor` (`created_by`),
  KEY `fk_time_estimate_technician` (`technician_id`),
  CONSTRAINT `fk_time_estimate_actor` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_time_estimate_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_time_estimate_ticket` FOREIGN KEY (`service_ticket_id`) REFERENCES `service_tickets` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_types`
--

DROP TABLE IF EXISTS `service_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=321 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `setting_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_settings_setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `technician_schedules`
--

DROP TABLE IF EXISTS `technician_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  KEY `idx_technician_schedules_branch_date_status` (`branch_id`,`work_date`,`status`),
  CONSTRAINT `fk_technician_schedules_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_technician_schedules_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=256 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transfers`
--

DROP TABLE IF EXISTS `transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `current_condition` text COLLATE utf8mb4_unicode_ci,
  `response_note` text COLLATE utf8mb4_unicode_ci,
  `work_done` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `fk_transfers_from_assignment` (`from_assignment_id`),
  KEY `fk_transfers_requested_by` (`requested_by`),
  KEY `fk_transfers_responded_by` (`responded_by`),
  KEY `fk_transfers_target_technician` (`target_technician_id`),
  CONSTRAINT `fk_transfers_from_assignment` FOREIGN KEY (`from_assignment_id`) REFERENCES `assignments` (`id`),
  CONSTRAINT `fk_transfers_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_transfers_responded_by` FOREIGN KEY (`responded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_transfers_target_technician` FOREIGN KEY (`target_technician_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `full_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','RECEPTIONIST','TECHNICIAN') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','INACTIVE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `failed_login_attempts` int NOT NULL DEFAULT '0',
  `locked_until` datetime(6) DEFAULT NULL,
  `password_changed_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5353 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-25 13:51:09
