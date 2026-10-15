export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'TECHNICIAN'
export interface AdminMlOverviewResponse { enabled: boolean; status: string; health: string; readiness: string; modelName: string; modelVersion: string; featureContractVersion: string; predictionCount: number; recordsWithActualDuration: number; recordsWithCompleteFeatures: number; trainingEligibleRecords: number; dataFrom?: string; dataTo?: string }
export interface FeedbackBranchStatisticsResponse { branchId: number; branchName: string; total: number; satisfied: number; dissatisfied: number; satisfactionRate: number }
export interface FeedbackStatisticsResponse { from: string; to: string; total: number; satisfied: number; dissatisfied: number; satisfactionRate: number; branches: FeedbackBranchStatisticsResponse[] }
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type ActiveStatus = 'ACTIVE' | 'INACTIVE'
export type AppointmentStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'ARRIVED' | 'CANCELLED' | 'EXPIRED'
export type AppointmentSlotStatus = 'OPEN' | 'CLOSED'
export type ServiceTicketStatus =
  | 'WAITING_ASSIGNMENT' | 'ASSIGNED' | 'INSPECTING' | 'WAITING_APPROVAL'
  | 'REPAIRING' | 'WAITING_PART' | 'WAITING_HANDOVER' | 'HANDED_OVER' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'PAID'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type WarrantyDecision = 'APPROVED' | 'REJECTED' | null
export type AssignmentSource = 'ACCEPTED_RECOMMENDATION' | 'MANUAL_OVERRIDE' | 'TRANSFER'
export type AssignmentStatus = 'ACTIVE' | 'ENDED'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER'
export type ServiceTypeCode = 'REPAIR' | 'REPLACEMENT' | 'WARRANTY'
export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
export type PartUsageStatus = 'ACTIVE' | 'REVERSED'
export type ConfirmationMethod = 'DIRECT' | 'PHONE' | 'PRE_AUTHORIZED'
export type WarrantyRemedy = 'REPAIR' | 'REPLACEMENT'

export interface FieldErrorResponse { field: string; message: string }
export interface ApiErrorResponse {
  timestamp: string; status: number; error: string; code: string; message: string
  path: string; fieldErrors: FieldErrorResponse[]
}
export interface CurrentUserResponse {
  id: number; username: string; fullName: string; role: UserRole; status: UserStatus
}
export interface LoginResponse {
  accessToken: string; tokenType: string; expiresAt: string; user: CurrentUserResponse
}
export interface PublicNamedResponse { id: number; name: string }
export interface PublicDeviceModelResponse { id: number; deviceTypeId: number; name: string }
export interface PublicCatalogResponse {
  id: number; deviceModelId: number; serviceIssueId: number; serviceTypeId: number
  serviceTypeCode: ServiceTypeCode; serviceTypeName: string
  partId: number | null; partName: string | null; partBrand: string | null; partVariant: string | null
  name: string; configuredPrice: number | null; displayPrice: number | null
  onlineDiscountPercent: number; onlinePrice: number | null
  standardDurationMinutes: number | null; warrantyDays: number | null
}
export interface PublicBranchResponse { id: number; name: string; address: string; phone: string }
export interface SlotAvailabilityResponse {
  slotId: number; branchId: number; slotDate: string; startTime: string; endTime: string
  status: AppointmentSlotStatus; activeBookingCount: number
}
export interface SlotRule { startTime: string; endTime: string; enabled: boolean }
export interface WeeklyScheduleResponse { branchId: number; weekday: number; enabled: boolean; slots: SlotRule[] }
export interface DateOverrideResponse { branchId: number; date: string; mode: 'INHERIT' | 'DISABLED' | 'REPLACE'; slots: SlotRule[] }
export interface AppointmentServiceItemRequest { serviceCatalogItemId?: number; warrantySourceItemId?: number | null }
export interface AppointmentDeviceRequest {
  deviceModelId: number; symptomDescription?: string; serviceItems: AppointmentServiceItemRequest[]
}
export interface CreateAppointmentRequest {
  customerFullName: string; phone: string; appointmentSlotId: number; note?: string
  devices: AppointmentDeviceRequest[]
}
export interface PublicBookedServiceResponse { name: string; basePrice: number | null; finalPrice: number | null }
export interface PublicAppointmentDeviceResponse { deviceModelName: string; services: PublicBookedServiceResponse[] }
export interface PublicAppointmentResponse {
  appointmentId: number; branchName: string; date: string; startTime: string; endTime: string
  status: AppointmentStatus; discountPercent: number; bookedAt: string; devices: PublicAppointmentDeviceResponse[]
}
export interface PublicRepairItemResponse {
  repairItemId: number; deviceTypeId: number; deviceModelId: number; serviceIssueId: number; serviceCatalogItemId: number
  serviceTypeCode: ServiceTypeCode; serviceTypeName: string
  partId: number | null; partName: string | null; partBrand: string | null; partVariant: string | null
  name: string; approvalStatus: ApprovalStatus; finalPrice: number | null
  warrantyStartDate: string | null; warrantyEndDate: string | null; warrantyDecision: WarrantyDecision; warrantyRemedy: WarrantyRemedy | null; warrantySourceItemId: number | null
}
export interface PublicTicketResponse {
  ticketCode: string; deviceModelName: string; branchName: string; status: ServiceTicketStatus
  paymentStatus: PaymentStatus; approvedTotal: number; receivedAt: string; actualRepairStartedAt: string | null
  estimatedCompletionAt: string | null; estimatedDurationMinutes: number | null; handedOverAt: string | null
  repairItems: PublicRepairItemResponse[]
}
export interface WarrantyEligibilityResponse {
  repairItemId: number; warrantyStartDate: string | null; warrantyEndDate: string | null
  eligible: boolean; remainingDays: number
}
export interface PublicFeedbackRequest { phone: string; satisfied: boolean; comment?: string }
export interface PublicFeedbackResponse { ticketCode: string; satisfied: boolean; comment: string | null }
export interface AppointmentResponse {
  id: number; customerId: number; customerFullName: string; customerPhone: string; appointmentSlotId: number; status: AppointmentStatus
  discountPercent: number; confirmedById: number | null; confirmedAt: string | null
  appointmentDate: string; slotStartTime: string; slotEndTime: string; arrivedAt: string | null
  note: string | null; cancelReason: string | null; bookedAt: string; updatedAt: string
}
export interface AppointmentServiceItemResponse {
  id: number; appointmentDeviceId: number; serviceCatalogItemId: number; warrantySourceItemId: number | null
  serviceNameSnapshot: string; basePriceSnapshot: number | null; finalPriceSnapshot: number | null; createdAt: string
}
export interface AppointmentDeviceResponse {
  id: number; appointmentId: number; deviceModelId: number; symptomDescription: string | null; createdAt: string
}
export interface AppointmentDeviceDetailResponse {
  device: AppointmentDeviceResponse; serviceItems: AppointmentServiceItemResponse[]
}
export interface AppointmentDetailResponse {
  appointment: AppointmentResponse; devices: AppointmentDeviceDetailResponse[]
}
export interface ServiceTicketResponse {
  id: number; ticketCode: string; appointmentDeviceId: number | null; customerDeviceId: number; branchId: number
  createdById: number; status: ServiceTicketStatus; receivedCondition: string | null; inspectionResult: string | null
  inspectedById: number | null; discountPercent: number; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod | null
  paidAt: string | null; handedOverById: number | null; handedOverAt: string | null; cancelReason: string | null
  receivedAt: string; updatedAt: string; authorizedScope: string | null; timing: TicketTiming
}
export interface RepairItemResponse {
  id: number; serviceTicketId: number; serviceCatalogItemId: number; itemNameSnapshot: string
  approvalStatus: ApprovalStatus; basePrice: number | null; finalPrice: number | null
  approvalRecordedById: number | null; approvalDecisionAt: string | null; approvalResolvedAt: string | null; approvalNote: string | null
  warrantyStartDate: string | null; warrantyEndDate: string | null; warrantySourceItemId: number | null
  warrantyDecision: WarrantyDecision; warrantyDecisionNote: string | null; createdAt: string; updatedAt: string
  confirmationMethod: ConfirmationMethod | null; warrantyRemedy: WarrantyRemedy | null; warrantyReplacementCatalogId: number | null; expectedPartId: number | null
}
export interface ServiceStatusHistoryResponse {
  id: number; serviceTicketId: number; fromStatus: ServiceTicketStatus | null; toStatus: ServiceTicketStatus
  changedById: number; note: string | null; changedAt: string; resolvedAt: string | null
  resolutionRecordedAt: string | null; resolvedById: number | null; resolutionNote: string | null
}
export interface ServiceTicketDetailResponse {
  ticket: ServiceTicketResponse; repairItems: RepairItemResponse[]; history: ServiceStatusHistoryResponse[]
  context: TicketContextResponse
}
export interface TicketContextResponse {
  customerId: number; customerFullName: string; customerPhone: string; customerDeviceId: number
  deviceModelId: number; deviceModelName: string; deviceTypeName: string | null; serialNumber: string | null; storage: string | null
  symptomDescription: string | null; branchId: number; branchName: string; serviceIssues: string[]; requestedServices: string[]
}
export interface OperationalTicketResponse {
  ticketId: number; ticketCode: string; customerFullName: string; customerPhone: string; customerDeviceId: number
  deviceModelId: number; deviceModelName: string; serviceIssues: string[]; requestedServices: string[]
  branchId: number; branchName: string; status: ServiceTicketStatus; receivedAt: string; estimatedDurationMinutes: number | null
  activeAssignmentId: number | null; activeTechnicianId: number | null; activeTechnicianName: string | null; assignedAt: string | null; timing: TicketTiming
}
export interface TechnicianRecommendationResponse {
  technicianId: number; technicianName: string; branchId: number; estimatedWorkloadMinutes: number
  predictedNewJobMinutes: number; remainingShiftMinutes: number; estimatedAvailableAt: string | null
  eligible: boolean; reason: string; queuedJobs: number; predictedTechnicalMinutes: number
  predictionSource: 'ML' | 'STANDARD_DURATION_FALLBACK'; predictionWarnings: string[]
  estimatedStartAt: string | null; estimatedCompletionAt: string | null; modelStatus: string | null
  syntheticData: boolean; productionValidated: boolean
}
export interface AssignmentResponse {
  id: number; serviceTicketId: number; technicianId: number; technicianName: string; assignedById: number
  source: AssignmentSource; status: AssignmentStatus; assignedAt: string; endedAt: string | null; note: string | null
}
export interface TransferResponse {
  id: number; fromAssignmentId: number; ticketId: number; fromTechnicianId: number; fromTechnicianName: string
  targetTechnicianId: number; targetTechnicianName: string; mode: 'REQUEST' | 'DIRECT'; status: TransferStatus
  requestedById: number; respondedById: number | null; note: string | null; workDone: string; currentCondition: string
  responseNote: string | null; requestedAt: string; respondedAt: string | null
}
export interface IncomingTransferResponse { transfer: TransferResponse; ticket: OperationalTicketResponse }
export interface AvailablePartResponse {
  partId: number; partCode: string; name: string; brand: string | null; variant: string | null
  salePrice: number; branchId: number; availableQuantity: number
}
export interface PartUsageResponse {
  id: number; repairItemId: number; partId: number; quantity: number; status: PartUsageStatus
  recordedById: number; usedAt: string; reversedById: number | null; reversedAt: string | null; reversalNote: string | null; defectiveReturnNote: string | null
}
export interface TicketPaymentSummaryResponse {
  serviceTicketId: number; totalAmount: number; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod | null; paidAt: string | null
}
export interface InspectionRepairItemRequest {
  serviceCatalogItemId: number; basePrice: number | null; finalPrice: number | null; warrantySourceItemId: number | null
}
export interface RepairDurationResponse { serviceTicketId: number; completedRepairMinutes: number; currentRepairMinutes: number }
export interface StatisticsOverviewResponse {
  from: string; to: string; branchId: number | null; deviceTypeId: number | null; totalTickets: number
  currentStatusCounts: { status: ServiceTicketStatus; count: number }[]; paidRevenue: number; warrantyReturnTickets: number
}
export interface SystemSettingResponse { id: number; settingKey: string; settingValue: string; createdAt: string; updatedAt: string }
export interface UserResponse { id: number; username: string; fullName: string; phone: string | null; role: UserRole; status: UserStatus; createdAt: string; updatedAt: string }
export interface BranchResponse { id: number; name: string; address: string; phone: string | null; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface DeviceTypeResponse { id: number; name: string; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface DeviceModelResponse { id: number; deviceTypeId: number; name: string; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface ServiceIssueResponse { id: number; name: string; status: ActiveStatus; deviceTypeIds: number[]; createdAt: string; updatedAt: string }
export interface ServiceTypeResponse { id: number; code: ServiceTypeCode; name: string; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface ServiceCatalogItemResponse { id: number; deviceModelId: number; serviceTypeId: number; serviceIssueId: number; partId: number | null; name: string; configuredPrice: number | null; standardDurationMinutes: number; warrantyDays: number; warrantyRemedy: WarrantyRemedy | null; warrantyReplacementCatalogId: number | null; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface WarrantyClaimSummaryResponse {
  repairItemId: number; ticketId: number; ticketCode: string; status: ServiceTicketStatus
  technicalMethod: WarrantyRemedy; receivedAt: string; handedOverAt: string | null
}
export interface WarrantyHistoryItemResponse {
  repairItemId: number; ticketId: number; ticketCode: string; customerDeviceId: number
  deviceTypeId: number; deviceTypeName: string; deviceModelId: number; deviceModelName: string
  serviceName: string; originalServiceType: ServiceTypeCode; warrantyTechnicalMethod: WarrantyRemedy | null
  completedAt: string | null; handedOverAt: string | null; warrantyStartDate: string | null; warrantyEndDate: string | null
  eligible: boolean; claimCount: number; lastClaimAt: string | null; claims: WarrantyClaimSummaryResponse[]
}
export interface WarrantyHistoryResponse { customerId: number; customerFullName: string; customerPhone: string; items: WarrantyHistoryItemResponse[] }
export interface PartResponse { id: number; partCode: string; name: string; brand: string | null; variant: string | null; origin: string | null; manufacturer: string | null; supplier: string | null; salePrice: number; status: ActiveStatus; createdAt: string; updatedAt: string }
export interface BranchInventoryResponse { id: number; branchId: number; partId: number; quantity: number; createdAt: string; updatedAt: string }
export interface InventoryTransactionResponse {
  id: number; transactionCode?: string; partId: number; transactionType: 'STOCK_IN' | 'STOCK_OUT' | 'USAGE_OUT' | 'USAGE_RETURN' | 'TRANSFER'
  sourceBranchId: number | null; destinationBranchId: number | null; quantity: number; partUsageId: number | null
  inventoryLotId: number | null; lotCode: string | null
  recordedById: number; recordedByName: string; note: string | null; createdAt: string
}
export interface InventoryLotResponse {
  id: number; lotCode: string; branchId: number; partId: number; receivedQuantity: number
  receivedAt: string; receivedById: number; receivedByName: string; sourceNote: string | null; createdAt: string
}
export interface StockInResponse { lot: InventoryLotResponse; inventory: BranchInventoryResponse; transaction: InventoryTransactionResponse }
export interface InventoryImportResultResponse { importedRows: number; transactionCodes: string[] }
export type TechnicianScheduleStatus = 'WORKING' | 'OFF' | 'CANCELLED'
export interface TechnicianScheduleResponse { id: number; technicianId: number; branchId: number; workDate: string; startTime: string; endTime: string; status: TechnicianScheduleStatus; createdAt: string; updatedAt: string }

export interface TicketTiming {
 assignmentDueAt: string | null; initialEstimatedStartAt: string | null; estimatedStartAt: string | null
 initialEstimatedCompletionAt: string | null; estimatedCompletionAt: string | null; estimatedDurationMinutes: number | null
 actualRepairStartedAt: string | null; actualRepairCompletedAt: string | null; estimateSource: 'STANDARD' | 'MANUAL' | null
}
export interface TimeEstimateHistory {
 id: number; technicianId: number | null; estimatedStartAt: string | null; estimatedCompletionAt: string | null
 estimatedDurationMinutes: number | null; estimateSource: 'STANDARD' | 'MANUAL'; reason: string; breakMinutesSnapshot: number
 approvedPriceSnapshot: number | null; createdAt: string; createdById: number | null
}
export type DefectivePartStatus = 'IN_STOCK' | 'SENT_TO_SUPPLIER' | 'RESOLVED' | 'DISPOSED'
export interface DefectivePartReturn {
 id: number; branchId: number; branchName: string; partId: number; partName: string; sourcePartUsageId: number
 repairItemId: number; ticketId: number; ticketCode: string; quantity: number; status: DefectivePartStatus
 reason: string; note: string | null; recordedById: number; receivedAt: string; statusChangedAt: string | null
}
