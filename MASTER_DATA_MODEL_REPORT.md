# Báo cáo hoàn tất MASTER DATA MODEL PHASE

**Đề tài: XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ HỖ TRỢ KỸ THUẬT TRONG DỊCH VỤ SỬA CHỮA THIẾT BỊ APPLE**

Ngày kiểm chứng: **10/09/2026**, Asia/Saigon. Project: `D:\Class\DOAN\CNPM\apple-repair-service\apple-repair-service`.

**Kết quả:** đủ 26 Entity, 26 Repository, 19 Enum. MySQL có đúng 26 bảng, 219 cột, 26 PK, 50 FK và 17 UNIQUE ngoài PK. Test, package, startup JAR và Hibernate schema validation đều thành công. Không cần sửa Java/mapping trong phiên resume.

## A. Resume status

Khi resume, toàn bộ group A–G đã có source hoàn chỉnh. Đã đọc 73 file Java: 72 main source (26 Entity + 26 Repository + 19 Enum + application bootstrap) và 1 test contextLoads; đã đọc POM, application.yaml và đối chiếu đặc tả Master cùng yêu cầu resume. Không tìm thấy AGENTS.md áp dụng.

| Group | Entity đã có, mỗi Entity có Repository tương ứng | Checkpoint compile trước |
| --- | --- | --- |
| Baseline | Branch, User, DeviceType, DeviceModel, ServiceType, ServiceIssue | Có từ trước Master |
| A | Part, ServiceCatalogItem, SystemSetting | 09/09/2026 14:42:10 |
| B | Customer, CustomerDevice | 09/09/2026 14:43:02 |
| C+D | AppointmentSlot, Appointment, AppointmentDevice, AppointmentServiceItem, ServiceTicket, RepairItem, ServiceStatusHistory | 09/09/2026 14:44:07 |
| E | TechnicianSchedule, Assignment, Transfer | 09/09/2026 14:44:17 |
| F | BranchInventory, PartUsage, InventoryTransaction | 09/09/2026 14:44:27 |
| G | ServiceFeedback, MlPrediction | 09/09/2026 14:44:36 |


Log phiên trước xác nhận `mvn -DskipTests compile` thành công ở từng checkpoint trên và `mvn clean test` cuối phiên thành công lúc 14:45:53 ngày 09/09/2026 (1 test, 0 failure/error). C+D compile chung theo quyết định đã duyệt, giữ FK bảo hành tới RepairItem.

**Phần còn dở lúc resume:** package cuối phase, khởi động JAR/Tomcat thật, audit schema đầy đủ và báo cáo. Không có group Entity/Repository cần viết tiếp. Kiểm chứng hiện tại không phát hiện lỗi compile/mapping.

Cấu hình khi resume dùng `jdbc:mysql://localhost:3307/apple_repair_service`, khác endpoint phiên trước. Đã giữ cấu hình hiện có. Server trả về MySQL **8.4.11**, `@@port = 3306` qua endpoint client 3307; ghi nhận riêng hai giá trị này, không suy đoán cơ chế chuyển tiếp cổng. Không đổi server hoặc migrate database.

## B. Files

**Phiên resume:** không tạo/sửa Entity, Repository, Enum, bootstrap, test, POM hoặc application.yaml. SHA-256 của cả 73 file Java trước/sau audit giống nhau. Workspace hiện không có Git repository, nên không dùng Git diff để suy diễn lịch sử phiên trước.

**Master phase trước:** đã bổ sung 20 Entity + 20 Repository dưới đây; 6 cặp baseline và 19 Enum có sẵn.

| Entity bổ sung từ phiên trước | Repository tương ứng |
| --- | --- |
| [Part.java](src/main/java/com/applecare/apple_repair_service/entity/Part.java) | [PartRepository.java](src/main/java/com/applecare/apple_repair_service/repository/PartRepository.java) |
| [ServiceCatalogItem.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceCatalogItem.java) | [ServiceCatalogItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceCatalogItemRepository.java) |
| [SystemSetting.java](src/main/java/com/applecare/apple_repair_service/entity/SystemSetting.java) | [SystemSettingRepository.java](src/main/java/com/applecare/apple_repair_service/repository/SystemSettingRepository.java) |
| [Customer.java](src/main/java/com/applecare/apple_repair_service/entity/Customer.java) | [CustomerRepository.java](src/main/java/com/applecare/apple_repair_service/repository/CustomerRepository.java) |
| [CustomerDevice.java](src/main/java/com/applecare/apple_repair_service/entity/CustomerDevice.java) | [CustomerDeviceRepository.java](src/main/java/com/applecare/apple_repair_service/repository/CustomerDeviceRepository.java) |
| [AppointmentSlot.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentSlot.java) | [AppointmentSlotRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentSlotRepository.java) |
| [Appointment.java](src/main/java/com/applecare/apple_repair_service/entity/Appointment.java) | [AppointmentRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentRepository.java) |
| [AppointmentDevice.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentDevice.java) | [AppointmentDeviceRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentDeviceRepository.java) |
| [AppointmentServiceItem.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentServiceItem.java) | [AppointmentServiceItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentServiceItemRepository.java) |
| [ServiceTicket.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceTicket.java) | [ServiceTicketRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceTicketRepository.java) |
| [RepairItem.java](src/main/java/com/applecare/apple_repair_service/entity/RepairItem.java) | [RepairItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/RepairItemRepository.java) |
| [ServiceStatusHistory.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceStatusHistory.java) | [ServiceStatusHistoryRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceStatusHistoryRepository.java) |
| [TechnicianSchedule.java](src/main/java/com/applecare/apple_repair_service/entity/TechnicianSchedule.java) | [TechnicianScheduleRepository.java](src/main/java/com/applecare/apple_repair_service/repository/TechnicianScheduleRepository.java) |
| [Assignment.java](src/main/java/com/applecare/apple_repair_service/entity/Assignment.java) | [AssignmentRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AssignmentRepository.java) |
| [Transfer.java](src/main/java/com/applecare/apple_repair_service/entity/Transfer.java) | [TransferRepository.java](src/main/java/com/applecare/apple_repair_service/repository/TransferRepository.java) |
| [BranchInventory.java](src/main/java/com/applecare/apple_repair_service/entity/BranchInventory.java) | [BranchInventoryRepository.java](src/main/java/com/applecare/apple_repair_service/repository/BranchInventoryRepository.java) |
| [PartUsage.java](src/main/java/com/applecare/apple_repair_service/entity/PartUsage.java) | [PartUsageRepository.java](src/main/java/com/applecare/apple_repair_service/repository/PartUsageRepository.java) |
| [InventoryTransaction.java](src/main/java/com/applecare/apple_repair_service/entity/InventoryTransaction.java) | [InventoryTransactionRepository.java](src/main/java/com/applecare/apple_repair_service/repository/InventoryTransactionRepository.java) |
| [ServiceFeedback.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceFeedback.java) | [ServiceFeedbackRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceFeedbackRepository.java) |
| [MlPrediction.java](src/main/java/com/applecare/apple_repair_service/entity/MlPrediction.java) | [MlPredictionRepository.java](src/main/java/com/applecare/apple_repair_service/repository/MlPredictionRepository.java) |


Phiên này bổ sung báo cáo này và 4 file bằng chứng trong [docs/master-data-model](docs/master-data-model): schema-audit.json, test.log, package.log, startup.log. Các patch tạm `.master-work/group-*.patch` của phiên trước được giữ nguyên, không áp dụng lại.

## C. Domain model

Quy ước: dấu `?` sau kiểu Java nghĩa là cột cho phép NULL; không có dấu này là NOT NULL. Mọi Entity có `Long id`, `@Id`, `GenerationType.IDENTITY`. Bảng dưới ghi **toàn bộ 219 field**. Đã đối chiếu độc lập đúng toàn bộ field/type của 20 Entity bổ sung với đặc tả Master, không thêm hoặc bỏ field.

| # | Entity → table | Toàn bộ field Java |
| --- | --- | --- |
| 1 | [Branch.java](src/main/java/com/applecare/apple_repair_service/entity/Branch.java) → `branches` | `id: Long`<br>`name: String`<br>`address: String`<br>`phone: String?`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 2 | [User.java](src/main/java/com/applecare/apple_repair_service/entity/User.java) → `users` | `id: Long`<br>`username: String`<br>`passwordHash: String`<br>`fullName: String`<br>`phone: String?`<br>`role: UserRole`<br>`status: UserStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 3 | [DeviceType.java](src/main/java/com/applecare/apple_repair_service/entity/DeviceType.java) → `device_types` | `id: Long`<br>`name: String`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 4 | [DeviceModel.java](src/main/java/com/applecare/apple_repair_service/entity/DeviceModel.java) → `device_models` | `id: Long`<br>`deviceType: DeviceType`<br>`name: String`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 5 | [ServiceType.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceType.java) → `service_types` | `id: Long`<br>`code: ServiceTypeCode`<br>`name: String`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 6 | [ServiceIssue.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceIssue.java) → `service_issues` | `id: Long`<br>`name: String`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 7 | [Part.java](src/main/java/com/applecare/apple_repair_service/entity/Part.java) → `parts` | `id: Long`<br>`partCode: String`<br>`name: String`<br>`brand: String?`<br>`variant: String?`<br>`salePrice: BigDecimal`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 8 | [ServiceCatalogItem.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceCatalogItem.java) → `service_catalog_items` | `id: Long`<br>`deviceModel: DeviceModel`<br>`serviceType: ServiceType`<br>`serviceIssue: ServiceIssue`<br>`part: Part?`<br>`name: String`<br>`configuredPrice: BigDecimal?`<br>`standardDurationMinutes: Integer?`<br>`warrantyDays: Integer`<br>`status: ActiveStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 9 | [SystemSetting.java](src/main/java/com/applecare/apple_repair_service/entity/SystemSetting.java) → `system_settings` | `id: Long`<br>`settingKey: String`<br>`settingValue: String`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 10 | [Customer.java](src/main/java/com/applecare/apple_repair_service/entity/Customer.java) → `customers` | `id: Long`<br>`fullName: String`<br>`phone: String`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 11 | [CustomerDevice.java](src/main/java/com/applecare/apple_repair_service/entity/CustomerDevice.java) → `customer_devices` | `id: Long`<br>`customer: Customer`<br>`deviceModel: DeviceModel`<br>`serialNumber: String?`<br>`storage: String?`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 12 | [AppointmentSlot.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentSlot.java) → `appointment_slots` | `id: Long`<br>`branch: Branch`<br>`appointmentDate: LocalDate`<br>`startTime: LocalTime`<br>`endTime: LocalTime`<br>`status: AppointmentSlotStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 13 | [Appointment.java](src/main/java/com/applecare/apple_repair_service/entity/Appointment.java) → `appointments` | `id: Long`<br>`customer: Customer`<br>`appointmentSlot: AppointmentSlot`<br>`status: AppointmentStatus`<br>`discountPercent: BigDecimal`<br>`confirmedBy: User?`<br>`confirmedAt: LocalDateTime?`<br>`note: String?`<br>`cancelReason: String?`<br>`bookedAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 14 | [AppointmentDevice.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentDevice.java) → `appointment_devices` | `id: Long`<br>`appointment: Appointment`<br>`deviceModel: DeviceModel`<br>`symptomDescription: String?`<br>`createdAt: LocalDateTime` |
| 15 | [AppointmentServiceItem.java](src/main/java/com/applecare/apple_repair_service/entity/AppointmentServiceItem.java) → `appointment_service_items` | `id: Long`<br>`appointmentDevice: AppointmentDevice`<br>`serviceCatalogItem: ServiceCatalogItem`<br>`warrantySourceItem: RepairItem?`<br>`serviceNameSnapshot: String`<br>`basePriceSnapshot: BigDecimal?`<br>`finalPriceSnapshot: BigDecimal?`<br>`createdAt: LocalDateTime` |
| 16 | [ServiceTicket.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceTicket.java) → `service_tickets` | `id: Long`<br>`ticketCode: String`<br>`appointmentDevice: AppointmentDevice?`<br>`customerDevice: CustomerDevice`<br>`branch: Branch`<br>`createdBy: User`<br>`status: ServiceTicketStatus`<br>`receivedCondition: String`<br>`inspectionResult: String?`<br>`inspectedBy: User?`<br>`discountPercent: BigDecimal`<br>`paymentStatus: PaymentStatus`<br>`paymentMethod: PaymentMethod?`<br>`paidAt: LocalDateTime?`<br>`handedOverBy: User?`<br>`handedOverAt: LocalDateTime?`<br>`cancelReason: String?`<br>`receivedAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 17 | [RepairItem.java](src/main/java/com/applecare/apple_repair_service/entity/RepairItem.java) → `repair_items` | `id: Long`<br>`serviceTicket: ServiceTicket`<br>`serviceCatalogItem: ServiceCatalogItem`<br>`itemNameSnapshot: String`<br>`approvalStatus: ApprovalStatus`<br>`basePrice: BigDecimal?`<br>`finalPrice: BigDecimal?`<br>`approvalRecordedBy: User?`<br>`approvalDecisionAt: LocalDateTime?`<br>`approvalNote: String?`<br>`warrantyStartDate: LocalDate?`<br>`warrantyEndDate: LocalDate?`<br>`warrantySourceItem: RepairItem?`<br>`warrantyDecision: WarrantyDecision?`<br>`warrantyDecisionNote: String?`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 18 | [ServiceStatusHistory.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceStatusHistory.java) → `service_status_histories` | `id: Long`<br>`serviceTicket: ServiceTicket`<br>`fromStatus: ServiceTicketStatus?`<br>`toStatus: ServiceTicketStatus`<br>`changedBy: User?`<br>`note: String?`<br>`changedAt: LocalDateTime` |
| 19 | [TechnicianSchedule.java](src/main/java/com/applecare/apple_repair_service/entity/TechnicianSchedule.java) → `technician_schedules` | `id: Long`<br>`technician: User`<br>`branch: Branch`<br>`workDate: LocalDate`<br>`startTime: LocalTime`<br>`endTime: LocalTime`<br>`status: TechnicianScheduleStatus`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 20 | [Assignment.java](src/main/java/com/applecare/apple_repair_service/entity/Assignment.java) → `assignments` | `id: Long`<br>`serviceTicket: ServiceTicket`<br>`technician: User`<br>`assignedBy: User`<br>`source: AssignmentSource`<br>`status: AssignmentStatus`<br>`assignedAt: LocalDateTime`<br>`endedAt: LocalDateTime?`<br>`note: String?` |
| 21 | [Transfer.java](src/main/java/com/applecare/apple_repair_service/entity/Transfer.java) → `transfers` | `id: Long`<br>`fromAssignment: Assignment`<br>`targetTechnician: User`<br>`mode: TransferMode`<br>`status: TransferStatus`<br>`requestedBy: User`<br>`respondedBy: User?`<br>`note: String?`<br>`requestedAt: LocalDateTime`<br>`respondedAt: LocalDateTime?` |
| 22 | [BranchInventory.java](src/main/java/com/applecare/apple_repair_service/entity/BranchInventory.java) → `branch_inventories` | `id: Long`<br>`branch: Branch`<br>`part: Part`<br>`quantity: Integer`<br>`createdAt: LocalDateTime`<br>`updatedAt: LocalDateTime` |
| 23 | [PartUsage.java](src/main/java/com/applecare/apple_repair_service/entity/PartUsage.java) → `part_usages` | `id: Long`<br>`repairItem: RepairItem`<br>`part: Part`<br>`quantity: Integer`<br>`status: PartUsageStatus`<br>`recordedBy: User`<br>`usedAt: LocalDateTime`<br>`reversedBy: User?`<br>`reversedAt: LocalDateTime?`<br>`reversalNote: String?` |
| 24 | [InventoryTransaction.java](src/main/java/com/applecare/apple_repair_service/entity/InventoryTransaction.java) → `inventory_transactions` | `id: Long`<br>`part: Part`<br>`transactionType: InventoryTransactionType`<br>`sourceBranch: Branch?`<br>`destinationBranch: Branch?`<br>`quantity: Integer`<br>`partUsage: PartUsage?`<br>`recordedBy: User`<br>`note: String?`<br>`createdAt: LocalDateTime` |
| 25 | [ServiceFeedback.java](src/main/java/com/applecare/apple_repair_service/entity/ServiceFeedback.java) → `service_feedbacks` | `id: Long`<br>`serviceTicket: ServiceTicket`<br>`satisfied: boolean`<br>`comment: String?`<br>`createdAt: LocalDateTime` |
| 26 | [MlPrediction.java](src/main/java/com/applecare/apple_repair_service/entity/MlPrediction.java) → `ml_predictions` | `id: Long`<br>`serviceTicket: ServiceTicket`<br>`predictionType: PredictionType`<br>`predictedDurationMinutes: Integer?`<br>`predictedSatisfaction: Boolean?`<br>`confidence: BigDecimal?`<br>`modelName: String`<br>`modelVersion: String`<br>`predictedAt: LocalDateTime` |


### Relationships

Có **48 ManyToOne + 2 OneToOne**, đều khai báo LAZY, một chiều: 36 FK bắt buộc, 14 FK nullable. Không có FK Long song song object relationship, collection hai chiều, cascade hoặc bảng nối ngoài dự kiến.

Hai OneToOne: `ServiceTicket.appointmentDevice` (nullable, UNIQUE) và `ServiceFeedback.serviceTicket` (NOT NULL, UNIQUE). Booking giữ `AppointmentDevice.deviceModel`, không buộc CustomerDevice tồn tại. Branch của Appointment suy ra qua AppointmentSlot; ticket của Transfer qua Assignment; branch của PartUsage qua RepairItem/ServiceTicket.

| FK nguồn | Đích | Nullable | Constraint thực tế |
| --- | --- | --- | --- |
| `appointment_devices.appointment_id` | `appointments.id` | NO | `fk_appointment_devices_appointment` |
| `appointment_devices.device_model_id` | `device_models.id` | NO | `fk_appointment_devices_device_model` |
| `appointment_service_items.appointment_device_id` | `appointment_devices.id` | NO | `fk_appointment_service_items_appointment_device` |
| `appointment_service_items.service_catalog_item_id` | `service_catalog_items.id` | NO | `fk_appointment_service_items_service_catalog_item` |
| `appointment_service_items.warranty_source_item_id` | `repair_items.id` | YES | `fk_appointment_service_items_warranty_source_item` |
| `appointment_slots.branch_id` | `branches.id` | NO | `fk_appointment_slots_branch` |
| `appointments.appointment_slot_id` | `appointment_slots.id` | NO | `fk_appointments_appointment_slot` |
| `appointments.confirmed_by` | `users.id` | YES | `fk_appointments_confirmed_by` |
| `appointments.customer_id` | `customers.id` | NO | `fk_appointments_customer` |
| `assignments.assigned_by` | `users.id` | NO | `fk_assignments_assigned_by` |
| `assignments.service_ticket_id` | `service_tickets.id` | NO | `fk_assignments_service_ticket` |
| `assignments.technician_id` | `users.id` | NO | `fk_assignments_technician` |
| `branch_inventories.branch_id` | `branches.id` | NO | `fk_branch_inventories_branch` |
| `branch_inventories.part_id` | `parts.id` | NO | `fk_branch_inventories_part` |
| `customer_devices.customer_id` | `customers.id` | NO | `fk_customer_devices_customer` |
| `customer_devices.device_model_id` | `device_models.id` | NO | `fk_customer_devices_device_model` |
| `device_models.device_type_id` | `device_types.id` | NO | `fk_device_models_device_type` |
| `inventory_transactions.destination_branch_id` | `branches.id` | YES | `fk_inventory_transactions_destination_branch` |
| `inventory_transactions.part_id` | `parts.id` | NO | `fk_inventory_transactions_part` |
| `inventory_transactions.part_usage_id` | `part_usages.id` | YES | `fk_inventory_transactions_part_usage` |
| `inventory_transactions.recorded_by` | `users.id` | NO | `fk_inventory_transactions_recorded_by` |
| `inventory_transactions.source_branch_id` | `branches.id` | YES | `fk_inventory_transactions_source_branch` |
| `ml_predictions.service_ticket_id` | `service_tickets.id` | NO | `fk_ml_predictions_service_ticket` |
| `part_usages.part_id` | `parts.id` | NO | `fk_part_usages_part` |
| `part_usages.recorded_by` | `users.id` | NO | `fk_part_usages_recorded_by` |
| `part_usages.repair_item_id` | `repair_items.id` | NO | `fk_part_usages_repair_item` |
| `part_usages.reversed_by` | `users.id` | YES | `fk_part_usages_reversed_by` |
| `repair_items.approval_recorded_by` | `users.id` | YES | `fk_repair_items_approval_recorded_by` |
| `repair_items.service_catalog_item_id` | `service_catalog_items.id` | NO | `fk_repair_items_service_catalog_item` |
| `repair_items.service_ticket_id` | `service_tickets.id` | NO | `fk_repair_items_service_ticket` |
| `repair_items.warranty_source_item_id` | `repair_items.id` | YES | `fk_repair_items_warranty_source_item` |
| `service_catalog_items.device_model_id` | `device_models.id` | NO | `fk_service_catalog_items_device_model` |
| `service_catalog_items.part_id` | `parts.id` | YES | `fk_service_catalog_items_part` |
| `service_catalog_items.service_issue_id` | `service_issues.id` | NO | `fk_service_catalog_items_service_issue` |
| `service_catalog_items.service_type_id` | `service_types.id` | NO | `fk_service_catalog_items_service_type` |
| `service_feedbacks.service_ticket_id` | `service_tickets.id` | NO | `fk_service_feedbacks_service_ticket` |
| `service_status_histories.changed_by` | `users.id` | YES | `fk_service_status_histories_changed_by` |
| `service_status_histories.service_ticket_id` | `service_tickets.id` | NO | `fk_service_status_histories_service_ticket` |
| `service_tickets.appointment_device_id` | `appointment_devices.id` | YES | `fk_service_tickets_appointment_device` |
| `service_tickets.branch_id` | `branches.id` | NO | `fk_service_tickets_branch` |
| `service_tickets.created_by` | `users.id` | NO | `fk_service_tickets_created_by` |
| `service_tickets.customer_device_id` | `customer_devices.id` | NO | `fk_service_tickets_customer_device` |
| `service_tickets.handed_over_by` | `users.id` | YES | `fk_service_tickets_handed_over_by` |
| `service_tickets.inspected_by` | `users.id` | YES | `fk_service_tickets_inspected_by` |
| `technician_schedules.branch_id` | `branches.id` | NO | `fk_technician_schedules_branch` |
| `technician_schedules.technician_id` | `users.id` | NO | `fk_technician_schedules_technician` |
| `transfers.from_assignment_id` | `assignments.id` | NO | `fk_transfers_from_assignment` |
| `transfers.requested_by` | `users.id` | NO | `fk_transfers_requested_by` |
| `transfers.responded_by` | `users.id` | YES | `fk_transfers_responded_by` |
| `transfers.target_technician_id` | `users.id` | NO | `fk_transfers_target_technician` |


Đối chiếu độc lập với 50 FK của yêu cầu resume: **50/50 khớp** tên cột, bảng đích và nullable. Toàn bộ FK có ON DELETE/ON UPDATE **NO ACTION**.

### UNIQUE và INDEX

| Bảng | UNIQUE ngoài PK | Cột theo thứ tự |
| --- | --- | --- |
| `appointment_service_items` | `uk_appointment_service_items_device_catalog` | `appointment_device_id,service_catalog_item_id` |
| `appointment_slots` | `uk_appointment_slots_branch_date_time` | `branch_id,appointment_date,start_time,end_time` |
| `branch_inventories` | `uk_branch_inventories_branch_part` | `branch_id,part_id` |
| `customer_devices` | `uk_customer_devices_serial_number` | `serial_number` |
| `customers` | `uk_customers_phone` | `phone` |
| `device_models` | `uk_device_models_device_type_name` | `device_type_id,name` |
| `device_types` | `uk_device_types_name` | `name` |
| `parts` | `uk_parts_part_code` | `part_code` |
| `service_feedbacks` | `uk_service_feedbacks_service_ticket` | `service_ticket_id` |
| `service_issues` | `uk_service_issues_name` | `name` |
| `service_tickets` | `uk_service_tickets_appointment_device` | `appointment_device_id` |
| `service_tickets` | `uk_service_tickets_ticket_code` | `ticket_code` |
| `service_types` | `uk_service_types_code` | `code` |
| `service_types` | `uk_service_types_name` | `name` |
| `system_settings` | `uk_system_settings_setting_key` | `setting_key` |
| `technician_schedules` | `uk_technician_schedules_shift` | `technician_id,branch_id,work_date,start_time,end_time` |
| `users` | `uk_users_username` | `username` |


Đủ **17 UNIQUE**: 6 baseline + 11 bổ sung. Serial thiết bị và appointment_device_id của ticket vẫn nullable; không UNIQUE Part.name hoặc composite cấu hình ServiceCatalogItem. Hai OneToOne không sinh UNIQUE thừa.

Đủ 9 index truy vấn khai báo rõ:

| Bảng | Index | Cột theo thứ tự |
| --- | --- | --- |
| `appointments` | `idx_appointments_slot_status` | `appointment_slot_id,status` |
| `assignments` | `idx_assignments_technician_status` | `technician_id,status` |
| `assignments` | `idx_assignments_ticket_status` | `service_ticket_id,status` |
| `inventory_transactions` | `idx_inventory_transactions_part_created_at` | `part_id,created_at` |
| `ml_predictions` | `idx_ml_predictions_ticket_type_predicted_at` | `service_ticket_id,prediction_type,predicted_at` |
| `service_status_histories` | `idx_service_status_histories_ticket_changed_at` | `service_ticket_id,changed_at` |
| `service_tickets` | `idx_service_tickets_branch` | `branch_id` |
| `service_tickets` | `idx_service_tickets_status` | `status` |
| `technician_schedules` | `idx_technician_schedules_branch_date_status` | `branch_id,work_date,status` |


Tổng **87 index** = 26 PRIMARY + 17 UNIQUE + 44 non-unique (9 index truy vấn và 35 index hỗ trợ FK). Không có hai index trong cùng bảng trùng toàn bộ danh sách cột. Index ghép có thể hỗ trợ FK bằng cột đầu, nên không cần index đơn riêng cho mỗi FK.

### Business rule dành cho Service Layer sau

- Chuẩn hóa phone, xử lý cạnh tranh khi xác định Customer; khách không login. Tra serial nullable chỉ khi có serial.
- Đếm booking hiệu lực bằng tập loại trừ **CANCELLED, EXPIRED**. Repository nhận tham số, chưa tự áp dụng tập này. Không capacity/bookedCount hoặc chặn đầy.
- Kiểm tra slot/ca có startTime < endTime, ngày hợp lệ, ca chồng lấn và role TECHNICIAN.
- Điều khiển trạng thái ticket/approval; ghi ServiceStatusHistory cùng sự kiện; tính tổng thời gian REPAIRING, loại WAITING_PART và WAITING_APPROVAL.
- Bảo đảm một Assignment ACTIVE/ticket khi có yêu cầu đồng thời. Receptionist quyết định phân công. Transfer thành công kết thúc assignment cũ, tạo assignment mới source TRANSFER.
- Chốt snapshot/giá; tổng giao dịch từ RepairItem.finalPrice, không cộng giá PartUsage lần nữa. Payment/bàn giao nằm trong ServiceTicket.
- Kiểm tra nguồn bảo hành, tránh tự tham chiếu/vòng lặp, warrantyEndDate >= warrantyStartDate; tạo ticket/hạng mục mới cho bảo hành thực tế.
- Cập nhật tồn và ghi InventoryTransaction nhất quán; kiểm tra đủ tồn, quantity dương và source/destination/partUsage theo từng transactionType; hai nhánh khác nhau khi transfer.
- ML kiểm tra kết quả tương ứng predictionType và insert lịch sử mới, không overwrite. UNIQUE đã bảo vệ tối đa một feedback/ticket.
- Cung cấp event timestamp và người thao tác ở lớp nghiệp vụ; chưa auto ticket code, tính tiền hoặc workflow trong Entity.

## D. Database thực tế

Kết quả `SHOW TABLES;`:

```text
appointment_devices
appointment_service_items
appointment_slots
appointments
assignments
branch_inventories
branches
customer_devices
customers
device_models
device_types
inventory_transactions
ml_predictions
part_usages
parts
repair_items
service_catalog_items
service_feedbacks
service_issues
service_status_histories
service_tickets
service_types
system_settings
technician_schedules
transfers
users
```

**Đúng 26 bảng**, không thiếu/thừa hoặc join table ngoài dự kiến. Truy vấn metadata/COUNT chạy trong transaction READ ONLY. Cả 26 bảng hiện có 0 bản ghi; phiên này không seed hoặc chạy DML/xóa dữ liệu.

| Hạng mục | Kết quả |
| --- | --- |
| PK | 26 id BIGINT NOT NULL AUTO_INCREMENT; PRIMARY KEY(id) |
| FK | 50/50 đúng; 14 nullable, 36 bắt buộc; tất cả NO ACTION |
| UNIQUE | 17 ngoài PK, đúng tên và thứ tự cột |
| Nullability | 219/219 cột khớp source: 165 NOT NULL, 54 nullable |
| Enum | 27 cột MySQL ENUM sử dụng 19 enum Java; 19/19 bộ giá trị khớp đặc tả; tất cả @Enumerated(EnumType.STRING) |
| Tiền | 6 cột DECIMAL(18,2): sale_price, configured_price, base_price_snapshot, final_price_snapshot, base_price, final_price |
| Tỷ lệ | 2 discount_percent DECIMAL(5,2); confidence DECIMAL(5,4) |
| Ngày/giờ | LocalDate → DATE; LocalTime → TIME (precision 0 thực tế); LocalDateTime → DATETIME(6) |
| Kiểu khác | String → VARCHAR(255); mô tả/note/comment → TEXT; Integer → INT; boolean/Boolean → BIT(1) |
| CHECK | Metadata không có CHECK constraint; Jakarta Validation phía ứng dụng không đồng nghĩa SQL CHECK |
| Index | 87 tổng; đủ 9 index truy vấn khai báo rõ, không trùng toàn bộ cột |


Giữ quyết định **MySQL ENUM + EnumType.STRING**. STRING là ánh xạ theo tên hằng, không bắt buộc kiểu vật lý VARCHAR. Không đổi enum/baseline để ép VARCHAR. TIME thực tế đúng đặc tả nên không tự đổi precision.

Bằng chứng đầy đủ: [schema-audit.json](docs/master-data-model/schema-audit.json), gồm 219 cột, 50 FK, 87 index, 26 row count và hash source.

## E. Repository

Spring Data scan **26 JPA repository interfaces** trong test, package và startup. Tất cả extends `JpaRepository<Entity, Long>`, không BaseRepository/native query/JPQL. Có **42 derived query methods**; BranchRepository chỉ dùng phương thức kế thừa.

| Repository | Derived query signatures |
| --- | --- |
| [BranchRepository.java](src/main/java/com/applecare/apple_repair_service/repository/BranchRepository.java) | Không thêm; dùng JpaRepository |
| [UserRepository.java](src/main/java/com/applecare/apple_repair_service/repository/UserRepository.java) | `Optional<User> findByUsername(String username)`<br>`boolean existsByUsername(String username)` |
| [DeviceTypeRepository.java](src/main/java/com/applecare/apple_repair_service/repository/DeviceTypeRepository.java) | `Optional<DeviceType> findByNameIgnoreCase(String name)`<br>`boolean existsByNameIgnoreCase(String name)` |
| [DeviceModelRepository.java](src/main/java/com/applecare/apple_repair_service/repository/DeviceModelRepository.java) | `List<DeviceModel> findAllByDeviceType_Id(Long deviceTypeId)`<br>`boolean existsByDeviceType_IdAndNameIgnoreCase(Long deviceTypeId, String name)` |
| [ServiceTypeRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceTypeRepository.java) | `Optional<ServiceType> findByCode(ServiceTypeCode code)`<br>`boolean existsByCode(ServiceTypeCode code)`<br>`Optional<ServiceType> findByNameIgnoreCase(String name)`<br>`boolean existsByNameIgnoreCase(String name)` |
| [ServiceIssueRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceIssueRepository.java) | `Optional<ServiceIssue> findByNameIgnoreCase(String name)`<br>`boolean existsByNameIgnoreCase(String name)` |
| [PartRepository.java](src/main/java/com/applecare/apple_repair_service/repository/PartRepository.java) | `Optional<Part> findByPartCode(String partCode)`<br>`boolean existsByPartCode(String partCode)`<br>`List<Part> findAllByNameIgnoreCase(String name)` |
| [ServiceCatalogItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceCatalogItemRepository.java) | `List<ServiceCatalogItem> findAllByDeviceModel_IdAndServiceIssue_Id(Long deviceModelId, Long serviceIssueId)` |
| [SystemSettingRepository.java](src/main/java/com/applecare/apple_repair_service/repository/SystemSettingRepository.java) | `Optional<SystemSetting> findBySettingKey(String settingKey)`<br>`boolean existsBySettingKey(String settingKey)` |
| [CustomerRepository.java](src/main/java/com/applecare/apple_repair_service/repository/CustomerRepository.java) | `Optional<Customer> findByPhone(String phone)`<br>`boolean existsByPhone(String phone)` |
| [CustomerDeviceRepository.java](src/main/java/com/applecare/apple_repair_service/repository/CustomerDeviceRepository.java) | `Optional<CustomerDevice> findBySerialNumber(String serialNumber)`<br>`List<CustomerDevice> findAllByCustomer_Id(Long customerId)` |
| [AppointmentSlotRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentSlotRepository.java) | `List<AppointmentSlot> findAllByBranch_IdAndAppointmentDateAndStatusOrderByStartTime( Long branchId, LocalDate appointmentDate, AppointmentSlotStatus status)` |
| [AppointmentRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentRepository.java) | `List<Appointment> findAllByCustomer_PhoneOrderByBookedAtDesc(String phone)`<br>`long countByAppointmentSlot_IdAndStatusNotIn( Long appointmentSlotId, Collection<AppointmentStatus> statuses)` |
| [AppointmentDeviceRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentDeviceRepository.java) | `List<AppointmentDevice> findAllByAppointment_Id(Long appointmentId)` |
| [AppointmentServiceItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AppointmentServiceItemRepository.java) | `List<AppointmentServiceItem> findAllByAppointmentDevice_Id(Long appointmentDeviceId)` |
| [ServiceTicketRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceTicketRepository.java) | `Optional<ServiceTicket> findByTicketCode(String ticketCode)`<br>`Optional<ServiceTicket> findByAppointmentDevice_Id(Long appointmentDeviceId)`<br>`List<ServiceTicket> findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(String phone)` |
| [RepairItemRepository.java](src/main/java/com/applecare/apple_repair_service/repository/RepairItemRepository.java) | `List<RepairItem> findAllByServiceTicket_Id(Long serviceTicketId)` |
| [ServiceStatusHistoryRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceStatusHistoryRepository.java) | `List<ServiceStatusHistory> findAllByServiceTicket_IdOrderByChangedAtAsc(Long serviceTicketId)` |
| [TechnicianScheduleRepository.java](src/main/java/com/applecare/apple_repair_service/repository/TechnicianScheduleRepository.java) | `List<TechnicianSchedule> findAllByWorkDateAndStatus( LocalDate workDate, TechnicianScheduleStatus status)` |
| [AssignmentRepository.java](src/main/java/com/applecare/apple_repair_service/repository/AssignmentRepository.java) | `Optional<Assignment> findFirstByServiceTicket_IdAndStatus( Long serviceTicketId, AssignmentStatus status)`<br>`List<Assignment> findAllByServiceTicket_IdOrderByAssignedAtAsc(Long serviceTicketId)`<br>`List<Assignment> findAllByTechnician_IdAndStatus(Long technicianId, AssignmentStatus status)` |
| [TransferRepository.java](src/main/java/com/applecare/apple_repair_service/repository/TransferRepository.java) | `List<Transfer> findAllByFromAssignment_ServiceTicket_IdOrderByRequestedAtDesc( Long serviceTicketId)` |
| [BranchInventoryRepository.java](src/main/java/com/applecare/apple_repair_service/repository/BranchInventoryRepository.java) | `Optional<BranchInventory> findByBranch_IdAndPart_Id(Long branchId, Long partId)` |
| [PartUsageRepository.java](src/main/java/com/applecare/apple_repair_service/repository/PartUsageRepository.java) | `List<PartUsage> findAllByRepairItem_Id(Long repairItemId)` |
| [InventoryTransactionRepository.java](src/main/java/com/applecare/apple_repair_service/repository/InventoryTransactionRepository.java) | `List<InventoryTransaction> findAllByPart_IdOrderByCreatedAtDesc(Long partId)` |
| [ServiceFeedbackRepository.java](src/main/java/com/applecare/apple_repair_service/repository/ServiceFeedbackRepository.java) | `Optional<ServiceFeedback> findByServiceTicket_Id(Long serviceTicketId)` |
| [MlPredictionRepository.java](src/main/java/com/applecare/apple_repair_service/repository/MlPredictionRepository.java) | `List<MlPrediction> findAllByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDesc( Long serviceTicketId, PredictionType predictionType)` |


Query phục vụ tra catalog, khách/thiết bị, lịch hẹn theo phone/slot, ticket và hạng mục, ca làm/phân công/transfer, tồn/lịch sử kho, feedback và lịch sử prediction. Load context thành công xác nhận Spring Data phân giải được đường dẫn property; chưa kiểm chứng nghiệp vụ bằng dữ liệu mẫu.

## F. Verify

| Lệnh/kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| mvn clean test | BUILD SUCCESS; 1 test, 0 failure/error/skipped; tổng 35.457 s; kết thúc 10:43:47 ngày 10/09/2026 | [test.log](docs/master-data-model/test.log) |
| mvn clean package | BUILD SUCCESS; chạy lại 1 test, 0 failure/error/skipped; tổng 36.050 s; kết thúc 10:45:01 | [package.log](docs/master-data-model/package.log) |
| JAR | target/apple-repair-service-0.0.1-SNAPSHOT.jar; repackage thành công | Executable Spring Boot JAR |
| Startup thật | ApplicationContext + JPA EntityManagerFactory + Tomcat 11.0.24; Started trong 17.308 s lúc 10:46:40 | [startup.log](docs/master-data-model/startup.log) |
| Hibernate validation | --spring.jpa.hibernate.ddl-auto=validate; không lỗi mapping/schema | Override riêng lần kiểm chứng; YAML vẫn update |
| MySQL | HikariPool-1 Added connection / Start completed; server 8.4.11 | Endpoint localhost:3307/apple_repair_service |
| HTTP | Cổng ngẫu nhiên 55016; GET /, Accept application/json → 401 | Spring Security mặc định hoạt động; chưa có API nghiệp vụ |


Lệnh startup:

```powershell
java -jar target/apple-repair-service-0.0.1-SNAPSHOT.jar --server.port=0 --spring.jpa.hibernate.ddl-auto=validate
```

Cổng ngẫu nhiên tránh xung đột server của bạn; validate kiểm chứng schema mà không sửa DDL lúc chạy JAR. Maven dùng cấu hình hiện có, không thấy CREATE/ALTER/DROP/DML trong log kiểm tra. Java 21.0.7, Maven 3.9.11, Spring Boot 4.1.1, Hibernate 7.4.5.Final; không đổi dependencies.

Đã dừng launcher PID 34120 và xác minh/dừng Java con PID 25780 do lần kiểm chứng tạo ra. Không dừng MySQL hoặc server khác. Sandbox ban đầu chặn đọc thông tin PID qua CIM; bước xác minh được cấp quyền hệ thống, sau đó dừng đúng Java con thành công.

Các log đính kèm là trích đoạn kiểm chứng đã che mật khẩu datasource/security. Test hiện tại là `@SpringBootTest contextLoads`: xác nhận bootstrap/repository/schema, **không tuyên bố đã test CRUD hoặc workflow**. Không thêm test mô phỏng mapping, không seed để test.

## G. Scope check

Không tạo DTO, Service/business logic, Controller, REST API, exception handling, transaction management nghiệp vụ, Security/JWT config, frontend, Python ML service, Redis, Kafka hoặc microservices.

Không tạo Payment, PaymentHistory, Warranty, WarrantyClaim, Supplier, PurchaseOrder, TechnicianSkill/TechnicianSpecialty hoặc module ngoài danh sách 26. Không thêm minimumStock, currentTechnicianId, actualRepairMinutes, totalAmount, paymentAmount, giá nhập, customer account, rating 1–5 hoặc QR payment.

Không drop database, create-drop, xóa bảng/dữ liệu, seed hoặc áp dụng lại patch cũ. Giữ nguyên baseline và cấu hình MySQL.

## H. Review, quyết định nhỏ và technical debt

- Không có quyết định nghiệp vụ mới khi resume. Giữ hai quyết định đã duyệt: compile C+D chung và MySQL ENUM theo tên hằng.
- Giữ tiền BigDecimal(18,2), phần trăm (5,2), confidence (5,4), TEXT cho mô tả dài. Validation: tiền không âm, phần trăm 0..100, confidence 0..1; không thay cho SQL CHECK hoặc kiểm tra nhiều field.
- createdAt/updatedAt dùng CreationTimestamp/UpdateTimestamp; event timestamp required dùng NotNull. Giá trị Java mặc định ACTIVE/PENDING/0 không phải SQL DEFAULT cho INSERT trực tiếp.
- SystemSetting.settingValue dùng NotNull, vẫn cho chuỗi rỗng theo đặc tả; ý nghĩa từng setting xử lý sau.
- UNIQUE chuỗi theo collation MySQL hiện có (chi tiết JSON), IgnoreCase là hành vi query. Chuẩn hóa phone/serial/code cần thống nhất ở Service Layer; không tự thay collation.
- findFirstByServiceTicket_IdAndStatus không bảo đảm duy nhất ACTIVE; nếu dữ liệu sai có nhiều ACTIVE thì có thể chỉ trả một bản ghi. Bảo vệ đồng thời là việc Service Layer sau, chưa thêm transaction/locking.
- Lookup serial nullable cần input có giá trị để tránh nhiều thiết bị chưa có serial. ML cần insert lịch sử ở lớp nghiệp vụ; JpaRepository hiện vẫn cung cấp CRUD thông thường.
- Warning có thật: open-in-view mặc định; Spring Security sinh user/password development; Mockito self-attach, Byte Buddy dynamic agent và JVM CDS trong test. Không làm build thất bại; không đổi security/JVM config để giấu warning.
- Log môi trường có DEBUG/condition evaluation report dài. Dòng auto-configuration chứa ErrorController/ExceptionHandler không phải runtime error. Không phát hiện ERROR cấp log hoặc lỗi DDL.
- ddl-auto: update giữ theo baseline. Migration có version và test CRUD/validation/transaction có dữ liệu thuộc phase sau, chưa thực hiện.

**Dừng sau MASTER DATA MODEL PHASE; chưa chuyển sang DTO/Service/Controller.**

