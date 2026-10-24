package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateWarrantyClaimRequest;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WarrantyClaimService {
    private final ServiceTicketRepository tickets;
    private final RepairItemRepository items;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final WarrantyPolicy policy;
    private final TicketCodeGenerator codes;
    private final ServiceStatusService statuses;
    private final EntityResponses mapper;
    private final Clock clock;

    public WarrantyHistoryResponse history(String phone, String ticketCode) {
        var normalizedPhone = BusinessRules.text(phone);
        var normalizedCode = BusinessRules.text(ticketCode);
        BusinessRules.require((normalizedPhone == null) != (normalizedCode == null),
                "Nhập số điện thoại hoặc mã phiếu dịch vụ.");
        if (normalizedCode != null) {
            var found = tickets.findByTicketCode(normalizedCode)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch sử dịch vụ."));
            normalizedPhone = found.getCustomerDevice().getCustomer().getPhone();
        }
        var customerTickets = tickets.findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(normalizedPhone);
        if (customerTickets.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy lịch sử dịch vụ.");
        var customer = customerTickets.getFirst().getCustomerDevice().getCustomer();
        var responseItems = customerTickets.stream()
                .flatMap(ticket -> items.findAllByServiceTicket_Id(ticket.getId()).stream())
                .filter(item -> item.getWarrantySourceItem() == null)
                .map(this::historyItem)
                .sorted(Comparator.comparing(WarrantyHistoryItemResponse::handedOverAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        return new WarrantyHistoryResponse(customer.getId(), customer.getFullName(), customer.getPhone(), responseItems);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse create(Long sourceItemId, CreateWarrantyClaimRequest request, Long actorId) {
        rules.validate(request);
        var source = access.lock(RepairItem.class, sourceItemId);
        BusinessRules.require(source.getWarrantySourceItem() == null,
                "Hãy tạo lần bảo hành mới từ hạng mục dịch vụ gốc.");
        BusinessRules.require(policy.eligible(source, LocalDate.now(clock)), "Hạng mục đã hết hạn hoặc không đủ điều kiện bảo hành.");
        var sourceCatalog = source.getServiceCatalogItem();
        BusinessRules.require(sourceCatalog.getWarrantyDays() != null && sourceCatalog.getWarrantyDays() > 0
                        && sourceCatalog.getWarrantyRemedy() != null,
                "Dịch vụ nguồn chưa được cấu hình phương án bảo hành.");
        var selectedCatalog = access.get(ServiceCatalogItem.class, request.serviceCatalogItemId());
        CatalogPolicy.requireUsable(selectedCatalog, source.getServiceTicket().getCustomerDevice().getDeviceModel().getId());
        var expectedType = sourceCatalog.getWarrantyRemedy() == WarrantyRemedy.REPLACEMENT
                ? ServiceTypeCode.REPLACEMENT : ServiceTypeCode.REPAIR;
        BusinessRules.require(selectedCatalog.getServiceType().getCode() == expectedType,
                sourceCatalog.getWarrantyRemedy() == WarrantyRemedy.REPLACEMENT
                        ? "Hạng mục này áp dụng bảo hành thay thế. Vui lòng chọn dịch vụ thay thế phù hợp."
                        : "Hạng mục này áp dụng bảo hành sửa chữa. Vui lòng chọn dịch vụ sửa chữa phù hợp.");

        var branch = access.get(Branch.class, request.branchId());
        BusinessRules.require(branch.getStatus() == ActiveStatus.ACTIVE, "Chi nhánh đã ngừng hoạt động.");
        var actor = access.get(User.class, actorId);
        var ticket = new ServiceTicket();
        ticket.setTicketCode(codes.next());
        ticket.setCustomerDevice(source.getServiceTicket().getCustomerDevice());
        ticket.setBranch(branch);
        ticket.setCreatedBy(actor);
        ticket.setCustomerReportedIssue(request.customerReportedIssue().trim());
        ticket.setAuthorizedScope(BusinessRules.text(request.authorizedScope()));
        ticket.setInspectionResult(BusinessRules.text(request.note()));
        ticket.setReceivedAt(LocalDateTime.now(clock));
        ticket.setDiscountPercent(BigDecimal.ZERO);
        tickets.saveAndFlush(ticket);

        var claim = new RepairItem();
        claim.setServiceTicket(ticket);
        claim.setServiceCatalogItem(selectedCatalog);
        claim.setItemNameSnapshot("Bảo hành · " + selectedCatalog.getName());
        claim.setBasePrice(BigDecimal.ZERO);
        claim.setFinalPrice(BigDecimal.ZERO);
        claim.setApprovalStatus(ApprovalStatus.APPROVED);
        claim.setWarrantySourceItem(source);
        claim.setWarrantyDecision(WarrantyDecision.APPROVED);
        claim.setWarrantyDecisionNote("Tiếp nhận trong thời hạn bảo hành");
        claim.setWarrantyRemedy(sourceCatalog.getWarrantyRemedy());
        // The selected catalog is already the concrete warranty service. Keep the legacy
        // replacement link empty instead of storing the same catalog ID twice.
        claim.setWarrantyReplacementCatalog(null);
        claim.setWarrantyStartDate(source.getWarrantyStartDate());
        claim.setWarrantyEndDate(source.getWarrantyEndDate());
        items.save(claim);
        statuses.initialize(ticket, actor);
        return detail(ticket);
    }

    private WarrantyHistoryItemResponse historyItem(RepairItem source) {
        var ticket = source.getServiceTicket();
        var device = ticket.getCustomerDevice();
        var model = device.getDeviceModel();
        var catalog = source.getServiceCatalogItem();
        var claims = items.findAllByWarrantySourceItem_IdOrderByCreatedAtDesc(source.getId()).stream()
                .map(item -> new WarrantyClaimSummaryResponse(item.getId(), item.getServiceTicket().getId(),
                        item.getServiceTicket().getTicketCode(), item.getServiceTicket().getStatus(),
                        item.getWarrantyRemedy(), item.getServiceTicket().getReceivedAt(), item.getServiceTicket().getHandedOverAt()))
                .toList();
        return new WarrantyHistoryItemResponse(source.getId(), ticket.getId(), ticket.getTicketCode(),
                device.getId(), model.getDeviceType().getId(), model.getDeviceType().getName(), model.getId(), model.getName(),
                source.getItemNameSnapshot(), catalog.getServiceType().getCode(), catalog.getWarrantyRemedy(),
                ticket.getActualRepairCompletedAt(), ticket.getHandedOverAt(), source.getWarrantyStartDate(), source.getWarrantyEndDate(),
                policy.eligible(source, LocalDate.now(clock)), claims.size(),
                claims.isEmpty() ? null : claims.getFirst().receivedAt(), claims);
    }

    private ServiceTicketDetailResponse detail(ServiceTicket ticket) {
        var itemResponses = items.findAllByServiceTicket_Id(ticket.getId()).stream().map(mapper::map).toList();
        var device = ticket.getCustomerDevice();
        var customer = device.getCustomer();
        var model = device.getDeviceModel();
        var context = new TicketContextResponse(customer.getId(), customer.getFullName(), customer.getPhone(), device.getId(),
                model.getId(), model.getName(), model.getDeviceType().getName(), device.getSerialNumber(), device.getStorage(),
                ticket.getCustomerReportedIssue(), ticket.getBranch().getId(), ticket.getBranch().getName(),
                itemResponses.stream().map(RepairItemResponse::itemNameSnapshot).toList(),
                itemResponses.stream().map(RepairItemResponse::itemNameSnapshot).toList());
        return new ServiceTicketDetailResponse(mapper.map(ticket), itemResponses, List.of(), context);
    }
}
