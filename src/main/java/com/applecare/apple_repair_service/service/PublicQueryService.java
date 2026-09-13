package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.publicapi.*;
import com.applecare.apple_repair_service.dto.response.WarrantyEligibilityResponse;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublicQueryService {
    private final BranchRepository branches;
    private final DeviceTypeRepository types;
    private final DeviceModelRepository models;
    private final ServiceIssueRepository issues;
    private final ServiceCatalogItemRepository catalog;
    private final AppointmentRepository appointments;
    private final AppointmentDeviceRepository devices;
    private final AppointmentServiceItemRepository bookedItems;
    private final ServiceTicketRepository tickets;
    private final RepairItemRepository repairItems;
    private final DomainAccess access;
    private final WarrantyService warranties;

    public List<PublicNamedResponse> deviceTypes() {
        return types.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE).stream()
                .map(x -> new PublicNamedResponse(x.getId(), x.getName())).toList();
    }
    public List<PublicDeviceModelResponse> deviceModels(Long typeId) {
        return models.findPublicModels(typeId).stream()
                .map(x -> new PublicDeviceModelResponse(x.getId(), x.getDeviceType().getId(), x.getName())).toList();
    }
    public List<PublicNamedResponse> serviceIssues() {
        return issues.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE).stream()
                .map(x -> new PublicNamedResponse(x.getId(), x.getName())).toList();
    }
    public List<PublicBranchResponse> branches() {
        return branches.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE).stream()
                .map(x -> new PublicBranchResponse(x.getId(), x.getName(), x.getAddress(), x.getPhone())).toList();
    }
    public List<PublicCatalogResponse> catalog(Long modelId, Long issueId, Long typeId) {
        return catalog.findPublicCatalog(modelId, issueId, typeId).stream()
                .map(x -> new PublicCatalogResponse(x.getId(), x.getDeviceModel().getId(), x.getServiceIssue().getId(),
                        x.getServiceType().getId(), x.getName(), x.getConfiguredPrice(),
                        x.getStandardDurationMinutes(), x.getWarrantyDays())).toList();
    }
    public PublicAppointmentResponse appointment(Long id) {
        return appointmentResponse(access.get(Appointment.class, id));
    }
    public List<PublicAppointmentResponse> appointments(String phone) {
        return appointments.findAllByCustomer_PhoneOrderByBookedAtDesc(requiredPhone(phone)).stream()
                .map(this::appointmentResponse).toList();
    }
    private PublicAppointmentResponse appointmentResponse(Appointment a) {
        var slot = a.getAppointmentSlot();
        var responseDevices = devices.findAllByAppointment_Id(a.getId()).stream()
                .map(d -> new PublicAppointmentDeviceResponse(d.getDeviceModel().getName(),
                        bookedItems.findAllByAppointmentDevice_Id(d.getId()).stream()
                                .map(i -> new PublicBookedServiceResponse(i.getServiceNameSnapshot(),
                                        i.getBasePriceSnapshot(), i.getFinalPriceSnapshot())).toList())).toList();
        return new PublicAppointmentResponse(a.getId(), slot.getBranch().getName(), slot.getAppointmentDate(),
                slot.getStartTime(), slot.getEndTime(), a.getStatus(), a.getDiscountPercent(), a.getBookedAt(), responseDevices);
    }
    public List<PublicTicketResponse> tickets(String phone) {
        return tickets.findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(requiredPhone(phone)).stream()
                .map(t -> {
                    var items = repairItems.findAllByServiceTicket_Id(t.getId());
                    var total = items.stream().filter(i -> i.getApprovalStatus() == ApprovalStatus.APPROVED)
                            .map(RepairItem::getFinalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new PublicTicketResponse(t.getTicketCode(), t.getCustomerDevice().getDeviceModel().getName(),
                            t.getBranch().getName(), t.getStatus(), t.getPaymentStatus(), total,
                            t.getReceivedAt(), t.getHandedOverAt(), items.stream()
                            .map(i -> new PublicRepairItemResponse(i.getId(), i.getItemNameSnapshot(),
                                    i.getApprovalStatus(), i.getFinalPrice(), i.getWarrantyStartDate(),
                                    i.getWarrantyEndDate(), i.getWarrantyDecision())).toList());
                }).toList();
    }
    public WarrantyEligibilityResponse eligibility(Long itemId, String phone) {
        var item = access.get(RepairItem.class, itemId);
        requireOwner(item.getServiceTicket(), phone);
        return warranties.checkEligibility(itemId);
    }
    static String requiredPhone(String phone) {
        var value = BusinessRules.text(phone);
        BusinessRules.require(value != null && value.length() <= 255, "Phone is required and must be at most 255 characters");
        return value;
    }
    static void requireOwner(ServiceTicket ticket, String phone) {
        if (!ticket.getCustomerDevice().getCustomer().getPhone().equals(requiredPhone(phone)))
            throw new ResourceNotFoundException("Service record not found");
    }
}

