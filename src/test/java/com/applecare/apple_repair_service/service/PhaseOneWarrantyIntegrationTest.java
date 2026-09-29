package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PhaseOneWarrantyIntegrationTest {
    @Autowired EntityManager em;
    @Autowired Clock clock;
    @Autowired ServiceTicketService tickets;
    @Autowired AssignmentService assignments;
    @Autowired WarrantyService warranties;
    @Autowired WarrantyClaimService warrantyClaims;
    @Autowired InventoryService inventory;
    @Autowired PaymentService payments;
    @Autowired com.applecare.apple_repair_service.repository.AdminReferenceRepository references;
    @Autowired DefectiveInventoryService defective;
    ApiFixture f;
    @BeforeEach void setup() { f = new ApiFixture(em, clock); f.create(); }

    ServiceCatalogItem catalog(ServiceTypeCode code, ServiceIssue issue, String suffix) {
        var types = em.createQuery("select t from ServiceType t where t.code=:code", ServiceType.class).setParameter("code", code).getResultList();
        ServiceType type;
        if (types.isEmpty()) { type = new ServiceType(); type.setCode(code); type.setName(f.prefix + code); em.persist(type); }
        else type = types.getFirst();
        var c = new ServiceCatalogItem(); c.setName(f.prefix + suffix); c.setDeviceModel(f.model);
        c.setServiceType(type); c.setServiceIssue(issue); c.setConfiguredPrice(new BigDecimal("900000.00"));
        c.setStandardDurationMinutes(30); c.setWarrantyDays(30); c.setWarrantyRemedy(WarrantyRemedy.REPAIR);
        if (code == ServiceTypeCode.REPLACEMENT) {
            var part = new Part(); part.setName(f.prefix + suffix); part.setPartCode(f.prefix + suffix); part.setSalePrice(new BigDecimal("900000.00")); em.persist(part); c.setPart(part);
            inventory.stockIn(new StockAdjustmentRequest(f.branch.getId(), part.getId(), 3, f.admin.getId(), "Isolated test stock"));
        }
        em.persist(c); em.flush(); return c;
    }
    RepairItem warrantyItem() {
        var original = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        original.setWarrantyStartDate(LocalDate.now(clock).minusDays(2)); original.setWarrantyEndDate(LocalDate.now(clock).plusDays(28));
        var t = f.ticket(ServiceTicketStatus.REPAIRING); t.setCustomerDevice(original.getServiceTicket().getCustomerDevice());
        var i = f.item(t); i.setServiceCatalogItem(catalog(ServiceTypeCode.WARRANTY, f.issue, "warranty"));
        i.setItemNameSnapshot(i.getServiceCatalogItem().getName()); i.setWarrantySourceItem(original); i.setFinalPrice(null); em.flush(); return i;
    }
    InspectionRepairItemRequest draft(RepairItem i) { return new InspectionRepairItemRequest(i.getServiceCatalogItem().getId(), i.getBasePrice(), i.getFinalPrice(), i.getWarrantySourceItem() == null ? null : i.getWarrantySourceItem().getId()); }
    void addPaidItem(RepairItem warranty, ServiceCatalogItem paid) {
        tickets.recordInspection(warranty.getServiceTicket().getId(), new RecordInspectionRequest("Phát hiện thêm pin chai", f.technician.getId(), false,
                List.of(draft(warranty), new InspectionRepairItemRequest(paid.getId(), paid.getConfiguredPrice(), paid.getConfiguredPrice(), null)), ConfirmationMethod.PHONE, "Khách đồng ý trả phí thay pin qua điện thoại"));
    }
    @Test void validWarrantyRepairIsFreeWithoutPartUsage() {
        var i = warrantyItem(); warranties.recordWarrantyDecision(i.getId(), new WarrantyDecisionRequest(WarrantyDecision.APPROVED, "Lỗi thuộc phạm vi", WarrantyRemedy.REPAIR, null));
        tickets.finishRepair(i.getServiceTicket().getId(), f.technician.getId());
        assertEquals(new BigDecimal("0.00"), payments.calculateTicketTotal(i.getServiceTicket().getId()));
        tickets.handover(i.getServiceTicket().getId(), new HandoverRequest(f.receptionist.getId()));
        assertEquals(ServiceTicketStatus.HANDED_OVER, i.getServiceTicket().getStatus());
        assertEquals(i.getWarrantySourceItem().getWarrantyEndDate(), i.getWarrantyEndDate());
    }
    @Test void warrantyReplacementRequiresUsageAndDefectiveRecordNeverCreditsUsableStock() {
        var i = warrantyItem(); var replacement = catalog(ServiceTypeCode.REPLACEMENT, f.issue, "screen");
        warranties.recordWarrantyDecision(i.getId(), new WarrantyDecisionRequest(WarrantyDecision.APPROVED, "Lỗi màn hình", WarrantyRemedy.REPLACEMENT, replacement.getId()));
        assertThrows(BusinessRuleViolationException.class, () -> tickets.finishRepair(i.getServiceTicket().getId(), f.technician.getId()));
        assertTrue(references.serviceCatalogItemIsReferenced(replacement.getId()));
        assertEquals(3, inventory.getInventory(f.branch.getId(), replacement.getPart().getId()).quantity());
        assertThrows(BusinessRuleViolationException.class, () -> inventory.usePart(new UsePartRequest(i.getId(), replacement.getPart().getId(), 1, f.technician.getId())));
        var used = inventory.usePart(new UsePartRequest(i.getId(), replacement.getPart().getId(), 1, f.technician.getId(), "Màn hình gốc sọc, thu hồi khay BH-01"));
        assertEquals(1, defective.onHand(f.branch.getId(), replacement.getPart().getId()));
        var receipt = defective.list(f.branch.getId(), replacement.getPart().getId(), null, i.getServiceTicket().getId()).getFirst();
        assertEquals(used.id(), receipt.sourcePartUsageId());
        assertEquals(receipt.id(), defective.record(em.find(PartUsage.class, used.id()), replacement.getPart(), "Retry same receipt").getId());
        assertEquals(1, defective.onHand(f.branch.getId(), replacement.getPart().getId()));
        defective.changeStatus(receipt.id(), new com.applecare.apple_repair_service.dto.command.DefectiveStatusCommand(DefectivePartStatus.SENT_TO_SUPPLIER, "Sent for warranty"), f.admin.getId());
        assertEquals(0, defective.onHand(f.branch.getId(), replacement.getPart().getId()));
        assertNotNull(used.defectiveReturnNote()); assertEquals(f.technician.getId(), used.recordedById()); assertNotNull(used.usedAt());
        assertEquals(2, inventory.getInventory(f.branch.getId(), replacement.getPart().getId()).quantity());
        assertThrows(BusinessRuleViolationException.class, () -> inventory.reversePartUsage(new ReversePartUsageRequest(used.id(), f.technician.getId(), "Không được nhập linh kiện lỗi")));
        assertEquals(2, inventory.getInventory(f.branch.getId(), replacement.getPart().getId()).quantity());
        assertTrue(inventory.getTransactionHistory(replacement.getPart().getId()).stream().noneMatch(tx -> tx.transactionType() == InventoryTransactionType.USAGE_RETURN));
        tickets.finishRepair(i.getServiceTicket().getId(), f.technician.getId());
        assertEquals(new BigDecimal("0.00"), payments.calculateTicketTotal(i.getServiceTicket().getId()));
    }
    @Test void mixedWarrantyAndPaidReplacementPreservesFreeItemAndChargesOnlyPaidWork() {
        var free = warrantyItem(); warranties.recordWarrantyDecision(free.getId(), new WarrantyDecisionRequest(WarrantyDecision.APPROVED, "Lỗi bảo hành", WarrantyRemedy.REPAIR, null));
        var battery = new ServiceIssue(); battery.setName(f.prefix + "battery"); battery.getDeviceTypes().add(f.deviceType); battery.setMappingInitialized(true); em.persist(battery);
        var paid = catalog(ServiceTypeCode.REPLACEMENT, battery, "battery"); addPaidItem(free, paid);
        var detail = tickets.getById(free.getServiceTicket().getId());
        assertEquals(ServiceTicketStatus.REPAIRING, detail.ticket().status());
        assertEquals(free.getId(), detail.repairItems().stream().filter(i -> i.warrantyDecision() == WarrantyDecision.APPROVED).findFirst().orElseThrow().id());
        var paidItem = detail.repairItems().stream().filter(i -> i.serviceCatalogItemId().equals(paid.getId())).findFirst().orElseThrow();
        inventory.usePart(new UsePartRequest(paidItem.id(), paid.getPart().getId(), 1, f.technician.getId()));
        tickets.finishRepair(detail.ticket().id(), f.technician.getId());
        assertEquals(new BigDecimal("900000.00"), payments.calculateTicketTotal(detail.ticket().id()));
        payments.recordPayment(detail.ticket().id(), new RecordPaymentRequest(PaymentMethod.CASH));
        tickets.handover(detail.ticket().id(), new HandoverRequest(f.receptionist.getId()));
        assertEquals(2, inventory.getInventory(f.branch.getId(), paid.getPart().getId()).quantity());
        assertEquals(new BigDecimal("0.00"), free.getFinalPrice());
    }
    @Test void rejectedWarrantyCanBecomePaidReplacementAfterVerbalConsent() {
        var free = warrantyItem(); warranties.recordWarrantyDecision(free.getId(), new WarrantyDecisionRequest(WarrantyDecision.REJECTED, "Vỡ do rơi"));
        var paid = catalog(ServiceTypeCode.REPLACEMENT, f.issue, "screen-paid");
        tickets.recordInspection(free.getServiceTicket().getId(), new RecordInspectionRequest("Thay màn hình trả phí", f.technician.getId(), false,
                List.of(new InspectionRepairItemRequest(paid.getId(), paid.getConfiguredPrice(), paid.getConfiguredPrice(), null)), ConfirmationMethod.DIRECT, "Khách đồng ý báo giá tại cửa hàng"));
        assertEquals(WarrantyDecision.REJECTED, free.getWarrantyDecision()); assertEquals(ApprovalStatus.REJECTED, free.getApprovalStatus());
        var paidItem = tickets.getById(free.getServiceTicket().getId()).repairItems().stream().filter(i -> i.approvalStatus() == ApprovalStatus.APPROVED).findFirst().orElseThrow();
        inventory.usePart(new UsePartRequest(paidItem.id(), paid.getPart().getId(), 1, f.technician.getId()));
        tickets.finishRepair(free.getServiceTicket().getId(), f.technician.getId());
        assertEquals(new BigDecimal("900000.00"), payments.calculateTicketTotal(free.getServiceTicket().getId()));
    }
    @Test void walkInCanUsePreauthorizedScopeWithoutWaitingOrLosingOriginalProblem() {
        var created = tickets.createWalkInTicket(new WalkInIntakeRequest("Khách test", f.prefix, f.branch.getId(), f.model.getId(), null, null, "Trầy vỏ", List.of(f.catalog.getId()), "Máy mất nguồn", "Nếu sửa không được thì thay, tối đa 1 triệu"), f.receptionist.getId());
        var shift = new TechnicianSchedule();
        shift.setTechnician(f.technician); shift.setBranch(f.branch); shift.setWorkDate(LocalDate.now(clock));
        shift.setStartTime(LocalTime.MIN); shift.setEndTime(LocalTime.MAX); em.persist(shift); em.flush();
        assignments.assignTechnician(created.ticket().id(), new AssignTechnicianRequest(
                f.technician.getId(), f.receptionist.getId(), AssignmentSource.MANUAL_OVERRIDE));
        var t = em.find(ServiceTicket.class, created.ticket().id()); t.setStatus(ServiceTicketStatus.INSPECTING);
        var result = tickets.recordInspection(t.getId(), new RecordInspectionRequest("Sửa nguồn", f.technician.getId(), false,
                List.of(new InspectionRepairItemRequest(f.catalog.getId(), BigDecimal.valueOf(100), BigDecimal.valueOf(100), null)), ConfirmationMethod.PRE_AUTHORIZED, "Trong phạm vi khách đã cho phép"));
        assertEquals(ServiceTicketStatus.REPAIRING, result.ticket().status()); assertEquals("Máy mất nguồn", result.context().symptomDescription());
        assertEquals(ConfirmationMethod.PRE_AUTHORIZED, result.repairItems().getFirst().confirmationMethod());
        assertEquals(f.technician.getId(), result.repairItems().getFirst().approvalRecordedById()); assertNotNull(result.repairItems().getFirst().approvalDecisionAt());
        var replacement = catalog(ServiceTypeCode.REPLACEMENT, f.issue, "preauthorized-replacement");
        var changed = tickets.recordInspection(t.getId(), new RecordInspectionRequest("Không sửa được, thay trong phạm vi cho phép", f.technician.getId(), false,
                List.of(new InspectionRepairItemRequest(replacement.getId(), replacement.getConfiguredPrice(), replacement.getConfiguredPrice(), null)), ConfirmationMethod.PRE_AUTHORIZED, "Dưới mức 1 triệu đã thỏa thuận"));
        assertEquals(ServiceTicketStatus.REPAIRING, changed.ticket().status());
        assertEquals(3, inventory.getInventory(f.branch.getId(), replacement.getPart().getId()).quantity());
        assertEquals(1, changed.repairItems().stream().filter(i -> i.approvalStatus() == ApprovalStatus.REJECTED).count());

    }
    @Test void newWorkWithoutConsentCannotSilentlyProceedOrPretendPreauthorization() {
        var t = f.ticket(ServiceTicketStatus.INSPECTING);
        var draft = List.of(new InspectionRepairItemRequest(f.catalog.getId(), BigDecimal.TEN, BigDecimal.TEN, null));
        assertThrows(BusinessRuleViolationException.class, () -> tickets.recordInspection(t.getId(), new RecordInspectionRequest("Lỗi nguồn", f.technician.getId(), false, draft)));
        assertThrows(BusinessRuleViolationException.class, () -> tickets.recordInspection(t.getId(), new RecordInspectionRequest("Lỗi nguồn", f.technician.getId(), false, draft, ConfirmationMethod.PRE_AUTHORIZED, "Tự ghi")));
        assertEquals(ServiceTicketStatus.INSPECTING, t.getStatus());
    }

    @Test void receptionistCreatesLinkedWarrantyRepairAndHistoryIsDerivedWithoutResettingExpiry() {
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        var originalStart = LocalDate.now(clock).minusDays(2);
        var originalEnd = LocalDate.now(clock).plusDays(28);
        source.setWarrantyStartDate(originalStart);
        source.setWarrantyEndDate(originalEnd);
        f.catalog.setWarrantyRemedy(WarrantyRemedy.REPAIR);
        em.flush();

        var created = warrantyClaims.create(source.getId(), new CreateWarrantyClaimRequest(
                f.branch.getId(), f.catalog.getId(), "Máy và phụ kiện đã tiếp nhận", "Lỗi nguồn tái diễn", "Khách yêu cầu kiểm tra bảo hành", null), f.receptionist.getId());
        var claim = em.find(RepairItem.class, created.repairItems().getFirst().id());
        assertEquals(source.getId(), claim.getWarrantySourceItem().getId());
        assertEquals(WarrantyRemedy.REPAIR, claim.getWarrantyRemedy());
        assertEquals(BigDecimal.ZERO.setScale(2), claim.getFinalPrice().setScale(2));
        assertEquals(originalStart, claim.getWarrantyStartDate());
        assertEquals(originalEnd, claim.getWarrantyEndDate());

        claim.getServiceTicket().setStatus(ServiceTicketStatus.REPAIRING);
        tickets.finishRepair(claim.getServiceTicket().getId(), f.technician.getId());
        assertEquals(originalEnd, claim.getWarrantyEndDate());
        var history = warrantyClaims.history(source.getServiceTicket().getCustomerDevice().getCustomer().getPhone(), null);
        var sourceHistory = history.items().stream().filter(item -> item.repairItemId().equals(source.getId())).findFirst().orElseThrow();
        assertEquals(1, sourceHistory.claimCount());
        assertEquals(claim.getId(), sourceHistory.claims().getFirst().repairItemId());
        assertNotNull(sourceHistory.lastClaimAt());
    }

    @Test void receptionistCanSelectTheSameReplacementServiceForWarrantyAndItStillRequiresPartUsage() {
        var replacement = catalog(ServiceTypeCode.REPLACEMENT, f.issue, "same-warranty-replacement");
        replacement.setWarrantyDays(180);
        replacement.setWarrantyRemedy(WarrantyRemedy.REPLACEMENT);
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        source.setServiceCatalogItem(replacement);
        source.setItemNameSnapshot(replacement.getName());
        source.setWarrantyStartDate(LocalDate.now(clock).minusDays(1));
        source.setWarrantyEndDate(LocalDate.now(clock).plusDays(20));
        em.flush();

        var created = warrantyClaims.create(source.getId(), new CreateWarrantyClaimRequest(
                f.branch.getId(), replacement.getId(), "Đã nhận máy", "Linh kiện lỗi lại", null, null), f.receptionist.getId());
        var claim = em.find(RepairItem.class, created.repairItems().getFirst().id());
        assertEquals(WarrantyRemedy.REPLACEMENT, claim.getWarrantyRemedy());
        assertEquals(replacement.getId(), claim.getServiceCatalogItem().getId());
        assertNull(claim.getWarrantyReplacementCatalog());
        claim.getServiceTicket().setStatus(ServiceTicketStatus.REPAIRING);
        assertThrows(BusinessRuleViolationException.class,
                () -> tickets.finishRepair(claim.getServiceTicket().getId(), f.technician.getId()));
        var used = inventory.usePart(new UsePartRequest(claim.getId(), replacement.getPart().getId(), 1,
                f.technician.getId(), "Pin lỗi được thu hồi khi tiếp nhận bảo hành"));
        assertNotNull(used.id());
        tickets.finishRepair(claim.getServiceTicket().getId(), f.technician.getId());
    }

    @Test void expiredSourceCannotCreateWarrantyClaim() {
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        source.setWarrantyStartDate(LocalDate.now(clock).minusDays(30));
        source.setWarrantyEndDate(LocalDate.now(clock).minusDays(1));
        em.flush();
        assertThrows(BusinessRuleViolationException.class, () -> warrantyClaims.create(source.getId(),
                new CreateWarrantyClaimRequest(f.branch.getId(), f.catalog.getId(), "Đã nhận máy", "Lỗi tái diễn", null, null), f.receptionist.getId()));
    }
}
