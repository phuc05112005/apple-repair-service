# Danh mục file Phase 1.1

Phân loại mới/sửa dưới đây so với chức năng Phase 1; nhiều file Phase 1.1 đã tồn tại ở checkpoint khi tiếp tục ngày 26/09. Không coi toàn bộ file là mới tạo trong lượt hôm nay. Không commit/push.

## Mới so với Phase 1 — Entity/enum

- `src/main/java/com/applecare/apple_repair_service/entity/DefectivePartReturn.java`
- `src/main/java/com/applecare/apple_repair_service/entity/ServiceTimeEstimateHistory.java`
- `src/main/java/com/applecare/apple_repair_service/enums/DefectivePartStatus.java`
- `src/main/java/com/applecare/apple_repair_service/enums/EstimateSource.java`

## Mới so với Phase 1 — Repository

- `src/main/java/com/applecare/apple_repair_service/repository/DefectivePartReturnRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/ServiceTimeEstimateHistoryRepository.java`

## Mới so với Phase 1 — Service

- `src/main/java/com/applecare/apple_repair_service/service/DefectiveInventoryService.java`
- `src/main/java/com/applecare/apple_repair_service/service/TimingSettings.java`
- `src/main/java/com/applecare/apple_repair_service/service/WorkCalendar.java`
- `src/main/java/com/applecare/apple_repair_service/service/ServiceTimingService.java`
- `src/main/java/com/applecare/apple_repair_service/service/TimingQueryService.java`
- `src/main/java/com/applecare/apple_repair_service/service/TimingMetricsService.java`

## Mới so với Phase 1 — API/DTO

- `src/main/java/com/applecare/apple_repair_service/controller/DefectiveInventoryController.java`
- `src/main/java/com/applecare/apple_repair_service/controller/ServiceTimingController.java`
- `src/main/java/com/applecare/apple_repair_service/dto/command/DefectiveStatusCommand.java`
- `src/main/java/com/applecare/apple_repair_service/dto/command/ManualEtaCommand.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/DefectivePartReturnResponse.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/TicketTimingResponse.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/TicketTimingMetricsResponse.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/ServiceTimeEstimateResponse.java`

## Backend sửa so với Phase 1

- `src/main/java/com/applecare/apple_repair_service/entity/ServiceTicket.java`
- `src/main/java/com/applecare/apple_repair_service/repository/AssignmentRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/TechnicianScheduleRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/ServiceTicketRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/RepairItemRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/ServiceStatusHistoryRepository.java`
- `src/main/java/com/applecare/apple_repair_service/repository/AdminReferenceRepository.java`
- `src/main/java/com/applecare/apple_repair_service/service/InventoryService.java`
- `src/main/java/com/applecare/apple_repair_service/service/ServiceStatusService.java`
- `src/main/java/com/applecare/apple_repair_service/service/ServiceTicketService.java`
- `src/main/java/com/applecare/apple_repair_service/service/TransferService.java`
- `src/main/java/com/applecare/apple_repair_service/service/SystemSettingService.java`
- `src/main/java/com/applecare/apple_repair_service/service/TechnicianOperationsService.java`
- `src/main/java/com/applecare/apple_repair_service/service/OperationalQueryService.java`
- `src/main/java/com/applecare/apple_repair_service/service/RepairDurationService.java`
- `src/main/java/com/applecare/apple_repair_service/service/WarrantyService.java`
- `src/main/java/com/applecare/apple_repair_service/dto/request/UsePartRequest.java`
- `src/main/java/com/applecare/apple_repair_service/dto/command/PartUsageCommand.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/ServiceTicketResponse.java`
- `src/main/java/com/applecare/apple_repair_service/dto/response/OperationalTicketResponse.java`
- `src/main/java/com/applecare/apple_repair_service/mapper/EntityResponses.java`

## Frontend mới

- `frontend/src/api/timingApi.ts`
- `frontend/src/utils/timing.ts`
- `frontend/src/hooks/useBusinessNow.ts`
- `frontend/src/components/TicketTimingSummary.tsx`
- `frontend/src/components/TicketTimingPanel.tsx`
- `frontend/src/components/DefectiveInventoryPanel.tsx`

## Frontend sửa

- `frontend/src/api/contracts.ts`
- `frontend/src/pages/internal/receptionist/TicketsPage.tsx`
- `frontend/src/pages/internal/receptionist/TicketWorkspacePage.tsx`
- `frontend/src/pages/internal/technician/TechnicianTicketPage.tsx`
- `frontend/src/pages/internal/WorkspaceHomePages.tsx`
- `frontend/src/pages/internal/admin/OperationsPages.tsx`
- `frontend/src/pages/internal/admin/SettingsPage.tsx`
- `frontend/src/layouts/InternalLayout.tsx`
- `frontend/src/types/labels.ts`
- `frontend/src/styles/global.css`

## Test mới

- `src/test/java/com/applecare/apple_repair_service/service/PhaseElevenTimingIntegrationTest.java`
- `frontend/tests/timing.test.mjs`

## Test sửa

- `src/test/java/com/applecare/apple_repair_service/service/ApplicationTransactionsIntegrationTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/PhaseOneWorkflowIntegrationTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/PhaseOneWarrantyIntegrationTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/InventoryServiceTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/ClosureServiceTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/TechnicianServiceTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/TicketCoreServiceTest.java`
- `src/test/java/com/applecare/apple_repair_service/service/HttpWorkflowIntegrationTest.java`

## Schema và tài liệu

- `database/schema.sql`
- `database/phase11-additive.sql`
- `database/README.md`
- `docs/phase1/TEMPORAL_CONVENTIONS.md`
- `docs/phase11/SERVICE_TIMING_RULES.md`
- `docs/phase11/PHASE_1_1_COMPLETION_REPORT.md`
- `docs/api-security/openapi.json`
- `docs/api-security/endpoint-inventory.json`

OpenAPI và endpoint inventory được tái sinh bởi kiểm thử hiện có. Snapshot git hiện tại ở `WORKSPACE_STATUS_20260926.txt`; đây là trạng thái toàn workspace, không thay thế phân loại phạm vi ở trên.
