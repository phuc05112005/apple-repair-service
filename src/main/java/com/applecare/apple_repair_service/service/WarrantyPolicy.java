package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;

import java.time.LocalDate;
import java.util.HashSet;

import org.springframework.stereotype.Component;

@Component
public class WarrantyPolicy {
    public boolean eligible(RepairItem source, LocalDate date) {
        checkChain(source);
        var catalog = source.getServiceCatalogItem();
        return catalog.getWarrantyDays() != null && catalog.getWarrantyDays() > 0
                && catalog.getWarrantyRemedy() != null
                && source.getServiceTicket().getStatus() == ServiceTicketStatus.HANDED_OVER
                && source.getApprovalStatus() == ApprovalStatus.APPROVED
                && source.getWarrantyStartDate() != null && source.getWarrantyEndDate() != null
                && !date.isBefore(source.getWarrantyStartDate()) && !date.isAfter(source.getWarrantyEndDate());
    }

    public void checkChain(RepairItem item) {
        var seen = new HashSet<Long>();
        for (var current = item; current != null; current = current.getWarrantySourceItem()) {
            BusinessRules.require(current.getId() != null && seen.add(current.getId()), "Invalid warranty reference cycle");
        }
    }

    public void validateBooking(RepairItem source, Long customerId, ServiceCatalogItem catalog, LocalDate date) {
        BusinessRules.require(eligible(source, date), "Warranty is not eligible on this date");
        BusinessRules.require(source.getServiceTicket().getCustomerDevice().getCustomer().getId().equals(customerId), "Warranty belongs to another customer");
        var sourceCatalog = source.getServiceCatalogItem();
        BusinessRules.require(sourceCatalog.getWarrantyDays() != null && sourceCatalog.getWarrantyDays() > 0
                        && sourceCatalog.getWarrantyRemedy() != null,
                "Original service does not have a configured warranty policy");
        var expectedType = sourceCatalog.getWarrantyRemedy() == com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT
                ? ServiceTypeCode.REPLACEMENT : ServiceTypeCode.REPAIR;
        BusinessRules.require(catalog.getServiceType().getCode() == expectedType,
                "Warranty booking service does not match the configured remedy");
        BusinessRules.require(catalog.getDeviceModel().getId().equals(source.getServiceTicket().getCustomerDevice().getDeviceModel().getId()), "Warranty device model differs");
    }
}
