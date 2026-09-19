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
    public List<PublicNamedResponse> serviceIssues(Long deviceTypeId) {
        var matches = deviceTypeId == null ? issues.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE)
                : issues.findPublicByDeviceType(ActiveStatus.ACTIVE, deviceTypeId);
        return matches.stream()
                .map(x -> new PublicNamedResponse(x.getId(), x.getName())).toList();
    }
    public List<PublicBranchResponse> branches() {
        return branches.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE).stream()
                .map(x -> new PublicBranchResponse(x.getId(), x.getName(), x.getAddress(), x.getPhone())).toList();
    }
    public List<PublicCatalogResponse> catalog(Long modelId, Long issueId, Long typeId) {
        return catalog.findPublicCatalog(modelId, issueId, typeId).stream()
                .map(x -> {
                    var part = x.getPart();
                    var displayPrice = x.getConfiguredPrice() != null ? x.getConfiguredPrice()
                            : part == null ? null : part.getSalePrice();
                    return new PublicCatalogResponse(x.getId(), x.getDeviceModel().getId(), x.getServiceIssue().getId(),
                            x.getServiceType().getId(), x.getServiceType().getCode(), x.getServiceType().getName(),
                            part == null ? null : part.getId(), part == null ? null : part.getName(),
                            part == null ? null : part.getBrand(), part == null ? null : part.getVariant(),
                            x.getName(), x.getConfiguredPrice(), displayPrice,
                            x.getStandardDurationMinutes(), x.getWarrantyDays());
                }).toList();
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
    public List<PublicTicketResponse> tickets(String phone, String ticketCode) {
        var normalizedPhone = BusinessRules.text(phone);
        var normalizedCode = BusinessRules.text(ticketCode);
        BusinessRules.require((normalizedPhone == null) != (normalizedCode == null),
                "Provide either phone or ticketCode");
        var matches = normalizedPhone != null
                ? tickets.findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(requiredPhone(normalizedPhone))
                : tickets.findByTicketCode(normalizedCode).stream().toList();
        return matches.stream().map(this::ticketResponse).toList();
    }

    private PublicTicketResponse ticketResponse(ServiceTicket ticket) {
        var items = repairItems.findAllByServiceTicket_Id(ticket.getId());
        var total = items.stream().filter(i -> i.getApprovalStatus() == ApprovalStatus.APPROVED)
                .map(RepairItem::getFinalPrice).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new PublicTicketResponse(ticket.getTicketCode(), ticket.getCustomerDevice().getDeviceModel().getName(),
                ticket.getBranch().getName(), ticket.getStatus(), ticket.getPaymentStatus(), total,
                ticket.getReceivedAt(), ticket.getHandedOverAt(), items.stream().map(i -> {
                    var catalogItem = i.getServiceCatalogItem();
                    var part = catalogItem.getPart();
                    return new PublicRepairItemResponse(i.getId(), catalogItem.getDeviceModel().getDeviceType().getId(), catalogItem.getDeviceModel().getId(),
                            catalogItem.getServiceIssue().getId(), catalogItem.getId(), catalogItem.getServiceType().getCode(),
                            catalogItem.getServiceType().getName(), part == null ? null : part.getId(),
                            part == null ? null : part.getName(), part == null ? null : part.getBrand(),
                            part == null ? null : part.getVariant(), i.getItemNameSnapshot(), i.getApprovalStatus(),
                            i.getFinalPrice(), i.getWarrantyStartDate(), i.getWarrantyEndDate(), i.getWarrantyDecision());
                }).toList());
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
