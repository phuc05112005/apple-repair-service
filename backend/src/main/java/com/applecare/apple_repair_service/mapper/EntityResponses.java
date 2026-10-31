package com.applecare.apple_repair_service.mapper;

import com.applecare.apple_repair_service.dto.response.AppointmentDeviceResponse;
import com.applecare.apple_repair_service.dto.response.AppointmentResponse;
import com.applecare.apple_repair_service.dto.response.AppointmentServiceItemResponse;
import com.applecare.apple_repair_service.dto.response.AppointmentSlotResponse;
import com.applecare.apple_repair_service.dto.response.AssignmentResponse;
import com.applecare.apple_repair_service.dto.response.BranchInventoryResponse;
import com.applecare.apple_repair_service.dto.response.BranchResponse;
import com.applecare.apple_repair_service.dto.response.CustomerDeviceResponse;
import com.applecare.apple_repair_service.dto.response.CustomerResponse;
import com.applecare.apple_repair_service.dto.response.DeviceModelResponse;
import com.applecare.apple_repair_service.dto.response.DeviceTypeResponse;
import com.applecare.apple_repair_service.dto.response.InventoryLotResponse;
import com.applecare.apple_repair_service.dto.response.InventoryTransactionResponse;
import com.applecare.apple_repair_service.dto.response.MlPredictionResponse;
import com.applecare.apple_repair_service.dto.response.PartResponse;
import com.applecare.apple_repair_service.dto.response.PartUsageResponse;
import com.applecare.apple_repair_service.dto.response.RepairItemResponse;
import com.applecare.apple_repair_service.dto.response.ServiceCatalogItemResponse;
import com.applecare.apple_repair_service.dto.response.ServiceFeedbackResponse;
import com.applecare.apple_repair_service.dto.response.ServiceIssueResponse;
import com.applecare.apple_repair_service.dto.response.ServiceStatusHistoryResponse;
import com.applecare.apple_repair_service.dto.response.ServiceTicketResponse;
import com.applecare.apple_repair_service.dto.response.ServiceTypeResponse;
import com.applecare.apple_repair_service.dto.response.SystemSettingResponse;
import com.applecare.apple_repair_service.dto.response.TechnicianScheduleResponse;
import com.applecare.apple_repair_service.dto.response.TransferResponse;
import com.applecare.apple_repair_service.dto.response.UserResponse;
import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.entity.AppointmentDevice;
import com.applecare.apple_repair_service.entity.AppointmentServiceItem;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.entity.InventoryLot;
import com.applecare.apple_repair_service.entity.InventoryTransaction;
import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.PartUsage;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceFeedback;
import com.applecare.apple_repair_service.entity.ServiceIssue;
import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.SystemSetting;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.entity.Transfer;
import com.applecare.apple_repair_service.entity.User;
import org.springframework.stereotype.Component;

import java.util.ArrayList;

@Component
public class EntityResponses {

    public AppointmentResponse map(Appointment e) {
        return new AppointmentResponse(e.getId(), e.getCustomer() == null ? null : e.getCustomer().getId(),
                e.getCustomer() == null ? null : e.getCustomer().getFullName(),
                e.getCustomer() == null ? null : e.getCustomer().getPhone(),
                e.getAppointmentSlot() == null ? null : e.getAppointmentSlot().getId(), e.getStatus(), e.getDiscountPercent(), e.getConfirmedBy() == null ? null : e.getConfirmedBy().getId(), e.getConfirmedAt(),
                e.getAppointmentSlot() == null ? null : e.getAppointmentSlot().getAppointmentDate(),
                e.getAppointmentSlot() == null ? null : e.getAppointmentSlot().getStartTime(),
                e.getAppointmentSlot() == null ? null : e.getAppointmentSlot().getEndTime(), e.getArrivedAt(),
                e.getNote(), e.getCancelReason(), e.getBookedAt(), e.getUpdatedAt());
    }

    public AppointmentDeviceResponse map(AppointmentDevice e) {
        return new AppointmentDeviceResponse(e.getId(), e.getAppointment() == null ? null : e.getAppointment().getId(), e.getDeviceModel() == null ? null : e.getDeviceModel().getId(), e.getSymptomDescription(), e.getCreatedAt());
    }

    public AppointmentServiceItemResponse map(AppointmentServiceItem e) {
        return new AppointmentServiceItemResponse(e.getId(), e.getAppointmentDevice() == null ? null : e.getAppointmentDevice().getId(), e.getServiceCatalogItem() == null ? null : e.getServiceCatalogItem().getId(), e.getWarrantySourceItem() == null ? null : e.getWarrantySourceItem().getId(), e.getServiceNameSnapshot(), e.getBasePriceSnapshot(), e.getFinalPriceSnapshot(), e.getCreatedAt());
    }

    public AppointmentSlotResponse map(AppointmentSlot e) {
        return new AppointmentSlotResponse(e.getId(), e.getBranch() == null ? null : e.getBranch().getId(), e.getAppointmentDate(), e.getStartTime(), e.getEndTime(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public AssignmentResponse map(Assignment e) {
        return new AssignmentResponse(e.getId(), e.getServiceTicket() == null ? null : e.getServiceTicket().getId(), e.getTechnician() == null ? null : e.getTechnician().getId(), e.getTechnician() == null ? null : e.getTechnician().getFullName(), e.getAssignedBy() == null ? null : e.getAssignedBy().getId(), e.getSource(), e.getStatus(), e.getAssignedAt(), e.getEndedAt(), e.getNote());
    }

    public BranchResponse map(Branch e) {
        return new BranchResponse(e.getId(), e.getName(), e.getAddress(), e.getPhone(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public BranchInventoryResponse map(BranchInventory e) {
        return new BranchInventoryResponse(e.getId(), e.getBranch() == null ? null : e.getBranch().getId(), e.getPart() == null ? null : e.getPart().getId(), e.getQuantity(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public CustomerResponse map(Customer e) {
        return new CustomerResponse(e.getId(), e.getFullName(), e.getPhone(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public CustomerDeviceResponse map(CustomerDevice e) {
        return new CustomerDeviceResponse(e.getId(), e.getCustomer() == null ? null : e.getCustomer().getId(), e.getDeviceModel() == null ? null : e.getDeviceModel().getId(), e.getSerialNumber(), e.getStorage(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public DeviceModelResponse map(DeviceModel e) {
        return new DeviceModelResponse(e.getId(), e.getDeviceType() == null ? null : e.getDeviceType().getId(), e.getName(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public DeviceTypeResponse map(DeviceType e) {
        return new DeviceTypeResponse(e.getId(), e.getName(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public InventoryTransactionResponse map(InventoryTransaction entity) {
        if (entity == null) return null;
        return new InventoryTransactionResponse(
                entity.getId(),
                InventoryTransactionResponse.code(entity.getId(), entity.getTransactionType()),
                entity.getPart() != null ? entity.getPart().getId() : null,
                entity.getTransactionType(),
                entity.getSourceBranch() != null ? entity.getSourceBranch().getId() : null,
                entity.getDestinationBranch() != null ? entity.getDestinationBranch().getId() : null,
                entity.getQuantity(),
                entity.getCostPrice(),
                entity.getSupplierName(),
                entity.getPartUsage() != null ? entity.getPartUsage().getId() : null,
                entity.getInventoryLot() != null ? entity.getInventoryLot().getId() : null,
                entity.getInventoryLot() != null ? entity.getInventoryLot().getLotCode() : null,
                entity.getRecordedBy() != null ? entity.getRecordedBy().getId() : null,
                entity.getRecordedBy() != null ? (entity.getRecordedBy().getFullName() != null ? entity.getRecordedBy().getFullName() : entity.getRecordedBy().getUsername()) : null,
                entity.getNote(),
                entity.getCreatedAt()
        );
    }

    public InventoryLotResponse map(InventoryLot e) {
        return new InventoryLotResponse(e.getId(), e.getLotCode(), e.getBranch().getId(), e.getPart().getId(),
                e.getReceivedQuantity(), e.getReceivedAt(), e.getReceivedBy().getId(), e.getReceivedBy().getFullName(), e.getSourceNote(), e.getCreatedAt());
    }

    public MlPredictionResponse map(MlPrediction e) {
        return new MlPredictionResponse(e.getId(), e.getServiceTicket() == null ? null : e.getServiceTicket().getId(),
                e.getTechnician() == null ? null : e.getTechnician().getId(),
                e.getTechnician() == null ? null : e.getTechnician().getFullName(), e.getPredictionType(),
                e.getPredictedDurationMinutes(), e.getPredictedSatisfaction(), e.getConfidence(),
                e.getModelName(), e.getModelVersion(), e.getPredictedAt());
    }

    public PartResponse map(Part part) {
        if (part == null) {
            return null;
        }
        return new PartResponse(
                part.getId(),
                new ArrayList<>(part.getDeviceModelIds()),
                part.getServiceIssueId(),
                part.getPartCode(),
                part.getName(),
                part.getBrand(),
                part.getVariant(),
                part.getOrigin(),
                part.getManufacturer(),
                part.getSupplier(),
                part.getSalePrice(),
                part.getStatus(),
                part.getCreatedAt(),
                part.getUpdatedAt()
        );
    }

    public PartUsageResponse map(PartUsage e) {
        return new PartUsageResponse(e.getId(), e.getRepairItem() == null ? null : e.getRepairItem().getId(), e.getPart() == null ? null : e.getPart().getId(), e.getQuantity(), e.getStatus(), e.getRecordedBy() == null ? null : e.getRecordedBy().getId(), e.getUsedAt(), e.getReversedBy() == null ? null : e.getReversedBy().getId(), e.getReversedAt(), e.getReversalNote(), e.getDefectiveReturnNote());
    }

    public RepairItemResponse map(RepairItem e) {
        return new RepairItemResponse(e.getId(), e.getServiceTicket() == null ? null : e.getServiceTicket().getId(), e.getServiceCatalogItem() == null ? null : e.getServiceCatalogItem().getId(), e.getItemNameSnapshot(), e.getApprovalStatus(), e.getBasePrice(), e.getFinalPrice(), e.getApprovalRecordedBy() == null ? null : e.getApprovalRecordedBy().getId(), e.getApprovalDecisionAt(), e.getApprovalResolvedAt(), e.getApprovalNote(), e.getWarrantyStartDate(), e.getWarrantyEndDate(), e.getWarrantySourceItem() == null ? null : e.getWarrantySourceItem().getId(), e.getWarrantyDecision(), e.getWarrantyDecisionNote(), e.getCreatedAt(), e.getUpdatedAt(), e.getConfirmationMethod(), e.getWarrantyRemedy(),
                e.getWarrantyReplacementCatalog() == null ? null : e.getWarrantyReplacementCatalog().getId(),
                (e.getWarrantyReplacementCatalog() != null ? e.getWarrantyReplacementCatalog() : e.getServiceCatalogItem()).getPart() == null ? null
                        : (e.getWarrantyReplacementCatalog() != null ? e.getWarrantyReplacementCatalog() : e.getServiceCatalogItem()).getPart().getId());
    }

    public ServiceCatalogItemResponse map(ServiceCatalogItem e) {
        return new ServiceCatalogItemResponse(e.getId(), e.getDeviceModel() == null ? null : e.getDeviceModel().getId(), e.getServiceType() == null ? null : e.getServiceType().getId(), e.getServiceIssue() == null ? null : e.getServiceIssue().getId(), e.getPart() == null ? null : e.getPart().getId(), e.getName(), e.getConfiguredPrice(), e.getStandardDurationMinutes(), e.getWarrantyDays(), e.getWarrantyRemedy(), e.getWarrantyReplacementCatalog() == null ? null : e.getWarrantyReplacementCatalog().getId(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public ServiceFeedbackResponse map(ServiceFeedback e) {
        return new ServiceFeedbackResponse(e.getId(), e.getServiceTicket() == null ? null : e.getServiceTicket().getId(), e.isSatisfied(), e.getComment(), e.getCreatedAt());
    }

    public ServiceIssueResponse map(ServiceIssue e) {
        return new ServiceIssueResponse(e.getId(), e.getName(), e.getStatus(),
                e.getDeviceTypes().stream().map(DeviceType::getId).collect(java.util.stream.Collectors.toSet()),
                e.getCreatedAt(), e.getUpdatedAt());
    }

    public ServiceStatusHistoryResponse map(ServiceStatusHistory e) {
        return new ServiceStatusHistoryResponse(e.getId(), e.getServiceTicket() == null ? null : e.getServiceTicket().getId(), e.getFromStatus(), e.getToStatus(), e.getChangedBy() == null ? null : e.getChangedBy().getId(), e.getNote(), e.getChangedAt(), e.getResolvedAt(), e.getResolutionRecordedAt(), e.getResolvedBy() == null ? null : e.getResolvedBy().getId(), e.getResolutionNote());
    }

    public ServiceTicketResponse map(ServiceTicket e) {
        return new ServiceTicketResponse(
                e.getId(),
                e.getTicketCode(),
                e.getAppointmentDevice() == null ? null : e.getAppointmentDevice().getId(),
                e.getCustomerDevice() == null ? null : e.getCustomerDevice().getId(),
                e.getBranch() == null ? null : e.getBranch().getId(),
                e.getCreatedBy() == null ? null : e.getCreatedBy().getId(),
                e.getStatus(),
                e.getReceivedCondition(),
                e.getInspectionResult(),
                e.getDiscountPercent(),
                e.getPaymentStatus(),
                e.getPaymentMethod(),
                e.getPaidAt(),
                e.getHandedOverBy() == null ? null : e.getHandedOverBy().getId(),
                e.getHandedOverAt(),
                e.getCancelReason(),
                e.getReceivedAt(),
                e.getUpdatedAt(),
                e.getAuthorizedScope(),
                com.applecare.apple_repair_service.dto.response.TicketTimingResponse.from(e)
        );
    }

    public ServiceTypeResponse map(ServiceType e) {
        return new ServiceTypeResponse(e.getId(), e.getCode(), e.getName(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public SystemSettingResponse map(SystemSetting e) {
        return new SystemSettingResponse(e.getId(), e.getSettingKey(), e.getSettingValue(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public TechnicianScheduleResponse map(TechnicianSchedule e) {
        return new TechnicianScheduleResponse(e.getId(), e.getTechnician() == null ? null : e.getTechnician().getId(), e.getBranch() == null ? null : e.getBranch().getId(), e.getWorkDate(), e.getStartTime(), e.getEndTime(), e.getStatus(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public TransferResponse map(Transfer e) {
        return new TransferResponse(e.getId(), e.getFromAssignment().getId(), e.getFromAssignment().getServiceTicket().getId(), e.getFromAssignment().getTechnician().getId(), e.getFromAssignment().getTechnician().getFullName(), e.getTargetTechnician().getId(), e.getTargetTechnician().getFullName(), e.getMode(), e.getStatus(), e.getRequestedBy() == null ? null : e.getRequestedBy().getId(), e.getRespondedBy() == null ? null : e.getRespondedBy().getId(), e.getNote(), e.getWorkDone(), e.getCurrentCondition(), e.getResponseNote(), e.getRequestedAt(), e.getRespondedAt());
    }

    public UserResponse map(User e) {
        return new UserResponse(
                e.getId(),
                e.getUsername(),
                e.getFullName(),
                e.getPhone(),
                e.getEmail(),
                e.getRole(),
                e.getStatus(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}