package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateWarrantyClaimRequest;
import com.applecare.apple_repair_service.dto.request.WalkInIntakeRequest;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies that receivedCondition is optional across walk-in intake and warranty claim intake,
 * while the other required fields remain enforced. Runs in rolled-back transactions.
 */
@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=validate", "spring.jpa.open-in-view=false"})
@Transactional
class ReceivedConditionOptionalIntegrationTest {
    @Autowired EntityManager em;
    @Autowired Clock clock;
    @Autowired ServiceTicketService tickets;
    @Autowired WarrantyClaimService warrantyClaims;
    ApiFixture f;

    @BeforeEach void setup() { f = new ApiFixture(em, clock); f.create(); }

    private WalkInIntakeRequest walkIn(String condition, String issue) {
        return new WalkInIntakeRequest("Khách " + f.prefix, "0900" + System.nanoTime() % 1_000_000,
                f.branch.getId(), f.model.getId(), null, null, condition,
                List.of(f.catalog.getId()), issue, null);
    }

    @Test void walkInWithNullConditionIsSavedAndReadBackAsNull() {
        var detail = tickets.createWalkInTicket(walkIn(null, "Không lên nguồn"), f.receptionist.getId());
        em.flush(); em.clear();
        var persisted = em.find(ServiceTicket.class, detail.ticket().id());
        assertNull(persisted.getReceivedCondition());
        assertEquals(ServiceTicketStatus.WAITING_ASSIGNMENT, persisted.getStatus());
        assertNull(tickets.getById(detail.ticket().id()).ticket().receivedCondition());
    }

    @Test void walkInWithBlankConditionIsNormalizedToNull() {
        var detail = tickets.createWalkInTicket(walkIn("   ", "Không lên nguồn"), f.receptionist.getId());
        em.flush(); em.clear();
        assertNull(em.find(ServiceTicket.class, detail.ticket().id()).getReceivedCondition());
    }

    @Test void walkInWithEmptyStringConditionIsNormalizedToNull() {
        var detail = tickets.createWalkInTicket(walkIn("", "Không lên nguồn"), f.receptionist.getId());
        em.flush(); em.clear();
        assertNull(em.find(ServiceTicket.class, detail.ticket().id()).getReceivedCondition());
    }

    @Test void walkInPersistsWithoutReceivedCondition() {
        var detail = tickets.createWalkInTicket(walkIn(null, "Không lên nguồn"), f.receptionist.getId());
        em.flush(); em.clear();
        assertNull(em.find(ServiceTicket.class, detail.ticket().id()).getReceivedCondition());
        assertNull(tickets.getById(detail.ticket().id()).ticket().receivedCondition());
    }

    @Test void walkInStillRejectsMissingCustomerIssueBecauseItIsStillRequiredByBusinessRule() {
        // Blank walk-in customer name is still a hard validation failure; condition being null does not relax it.
        var request = new WalkInIntakeRequest("", "0900000001", f.branch.getId(), f.model.getId(),
                null, null, null, List.of(f.catalog.getId()), "Không lên nguồn", null);
        assertThrows(BusinessRuleViolationException.class, () -> tickets.createWalkInTicket(request, f.receptionist.getId()));
    }

    @Test void warrantyClaimWithNullConditionIsAcceptedAndStoredAsNull() {
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        source.setWarrantyStartDate(LocalDate.now(clock).minusDays(2));
        source.setWarrantyEndDate(LocalDate.now(clock).plusDays(28));
        em.flush();

        var created = warrantyClaims.create(source.getId(), new CreateWarrantyClaimRequest(
                f.branch.getId(), f.catalog.getId(), null, "Lỗi tái diễn", null, null), f.receptionist.getId());
        em.flush(); em.clear();
        var claim = em.find(RepairItem.class, created.repairItems().getFirst().id());
        assertNull(claim.getServiceTicket().getReceivedCondition());
    }

    @Test void warrantyClaimWithBlankConditionIsAcceptedAndStoredAsNull() {
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        source.setWarrantyStartDate(LocalDate.now(clock).minusDays(2));
        source.setWarrantyEndDate(LocalDate.now(clock).plusDays(28));
        em.flush();

        var created = warrantyClaims.create(source.getId(), new CreateWarrantyClaimRequest(
                f.branch.getId(), f.catalog.getId(), "   ", "Lỗi tái diễn", null, null), f.receptionist.getId());
        em.flush(); em.clear();
        assertNull(em.find(RepairItem.class, created.repairItems().getFirst().id()).getServiceTicket().getReceivedCondition());
    }

    @Test void warrantyClaimStillRequiresCustomerReportedIssue() {
        var source = f.item(f.ticket(ServiceTicketStatus.HANDED_OVER));
        source.setWarrantyStartDate(LocalDate.now(clock).minusDays(2));
        source.setWarrantyEndDate(LocalDate.now(clock).plusDays(28));
        em.flush();

        assertThrows(BusinessRuleViolationException.class, () -> warrantyClaims.create(source.getId(),
                new CreateWarrantyClaimRequest(f.branch.getId(), f.catalog.getId(), null, "   ", null, null),
                f.receptionist.getId()));
    }
}
