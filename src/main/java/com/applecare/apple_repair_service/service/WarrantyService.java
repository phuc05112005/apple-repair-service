package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.WarrantyDecisionRequest;
import com.applecare.apple_repair_service.dto.response.RepairItemResponse;
import com.applecare.apple_repair_service.dto.response.WarrantyEligibilityResponse;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.WarrantyDecision;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WarrantyService {
    private final DomainAccess access;
    private final BusinessRules rules;
    private final WarrantyPolicy policy;
    private final EntityResponses mapper;
    private final Clock clock;

    public WarrantyEligibilityResponse checkEligibility(Long id) {
        return checkEligibility(id, LocalDate.now(clock));
    }

    public WarrantyEligibilityResponse checkEligibility(Long id, LocalDate date) {
        BusinessRules.require(date != null, "Date is required");
        var item = access.get(RepairItem.class, id);
        boolean eligible = policy.eligible(item, date);
        return new WarrantyEligibilityResponse(id, item.getWarrantyStartDate(), item.getWarrantyEndDate(), eligible, eligible ? ChronoUnit.DAYS.between(date, item.getWarrantyEndDate()) : 0);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public RepairItemResponse recordWarrantyDecision(Long id, WarrantyDecisionRequest r) {
        rules.validate(r);
        var initial = access.get(RepairItem.class, id);
        var ticket = access.lock(ServiceTicket.class, initial.getServiceTicket().getId());
        var item = access.lock(RepairItem.class, id);
        BusinessRules.require(ticket.getPaymentStatus() != PaymentStatus.PAID && (ticket.getStatus() == ServiceTicketStatus.REPAIRING || ticket.getStatus() == ServiceTicketStatus.WAITING_APPROVAL), "Warranty decision requires an inspected, unsettled repair");
        if (item.getWarrantyDecision() != null) throw new ConflictException("Warranty decision already recorded");
        BusinessRules.require(item.getApprovalStatus() != com.applecare.apple_repair_service.enums.ApprovalStatus.REJECTED,
                "Hạng mục không còn nằm trong phương án thực hiện.");
        var source = item.getWarrantySourceItem();
        BusinessRules.require(source != null, "Warranty source is required");
        policy.checkChain(item);
        BusinessRules.require(source.getServiceTicket().getCustomerDevice().getCustomer().getId().equals(ticket.getCustomerDevice().getCustomer().getId()), "Warranty belongs to another customer");
        BusinessRules.require(source.getServiceTicket().getCustomerDevice().getDeviceModel().getId().equals(ticket.getCustomerDevice().getDeviceModel().getId()), "Warranty device model differs");
        BusinessRules.require(item.getServiceCatalogItem().getServiceType().getCode() == ServiceTypeCode.WARRANTY, "Warranty service catalog required");
        if (r.decision() == WarrantyDecision.APPROVED) {
            BusinessRules.require(policy.eligible(source, LocalDate.now(clock)), "Warranty is not eligible");
            var remedy = r.remedy() == null ? com.applecare.apple_repair_service.enums.WarrantyRemedy.REPAIR : r.remedy();
            if (remedy == com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT) {
                BusinessRules.require(r.replacementCatalogItemId() != null, "Chọn phương án linh kiện thay bảo hành.");
                var replacement = access.get(com.applecare.apple_repair_service.entity.ServiceCatalogItem.class, r.replacementCatalogItemId());
                CatalogPolicy.requireUsable(replacement, ticket.getCustomerDevice().getDeviceModel().getId());
                BusinessRules.require(replacement.getServiceType().getCode() == ServiceTypeCode.REPLACEMENT
                        && replacement.getServiceIssue().getId().equals(source.getServiceCatalogItem().getServiceIssue().getId()),
                        "Phương án thay bảo hành phải đúng hạng mục gốc và dòng máy.");
                item.setWarrantyReplacementCatalog(replacement);
            } else BusinessRules.require(r.replacementCatalogItemId() == null, "Sửa bảo hành không chọn phương án thay linh kiện.");
            item.setWarrantyRemedy(remedy);
            item.setFinalPrice(new BigDecimal("0.00"));
        } else BusinessRules.required(r.note(), "Warranty rejection reason");
        item.setWarrantyDecision(r.decision());
        item.setWarrantyDecisionNote(BusinessRules.text(r.note()));
        return mapper.map(item);
    }
}
