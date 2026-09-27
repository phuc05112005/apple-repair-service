package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class PhaseOneWorkflowIntegrationTest {
    @Autowired EntityManager em;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    @Autowired ServiceTicketService tickets;
    @Autowired InventoryService inventory;
    @Autowired DefectiveInventoryService defective;
    ApiFixture f;

    @BeforeEach void setup() {
        f = new ApiFixture(em, clock); f.create();
        var shift = new TechnicianSchedule(); shift.setTechnician(f.technician); shift.setBranch(f.branch);
        shift.setWorkDate(LocalDate.now(clock)); shift.setStartTime(LocalTime.MIN); shift.setEndTime(LocalTime.MAX);
        em.persist(shift); em.flush();
    }

    String login(User user) throws Exception {
        var response = mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(user.getUsername(), ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(response).get("accessToken").asString();
    }

    @Test void hibernateTimestampsAndBusinessClockUseVietnamWallTime() {
        assertEquals(com.applecare.apple_repair_service.config.TimeConfig.BUSINESS_ZONE, ZoneId.systemDefault());
        var customer = new Customer(); customer.setFullName(f.prefix); customer.setPhone(f.prefix);
        var before = LocalDateTime.now(clock).minusSeconds(1);
        em.persist(customer); em.flush(); em.refresh(customer);
        assertFalse(customer.getCreatedAt().isBefore(before));
        assertFalse(customer.getCreatedAt().isAfter(LocalDateTime.now(clock).plusSeconds(1)));
    }

    @Test void walkInWithServiceCanWaitThenTechnicianRecordsPhoneConsent() throws Exception {
        var reception = login(f.receptionist); var technician = login(f.technician);
        var request = new WalkInIntakeRequest("Khách trực tiếp", f.prefix, f.branch.getId(), f.model.getId(),
                null, null, "Vỏ máy trầy", List.of(f.catalog.getId()), "Máy tự tắt khi dùng");
        var body = mvc.perform(post("/api/v1/internal/service-tickets/walk-in").header("Authorization", reception)
                .contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.repairItems.length()").value(1))
                .andExpect(jsonPath("$.context.symptomDescription").value("Máy tự tắt khi dùng"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(body).get("ticket").get("id").asLong();
        var path = "/api/v1/internal/service-tickets/" + id;
        mvc.perform(post(path + "/assignments").header("Authorization", reception).contentType("application/json")
                .content(json.writeValueAsString(new AssignTechnicianCommand(f.technician.getId(), AssignmentSource.MANUAL_OVERRIDE))))
                .andExpect(status().isCreated());
        mvc.perform(get(path).header("Authorization", technician)).andExpect(status().isOk()).andExpect(jsonPath("$.repairItems.length()").value(1));
        mvc.perform(post(path + "/inspection/start").header("Authorization", technician))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ticket.status").value("INSPECTING"));
        var inspection = new InspectionCommand("Lỗi nguồn đã xác định, phát sinh công việc ngoài báo giá ban đầu", true,
                List.of(new InspectionRepairItemRequest(f.catalog.getId(), BigDecimal.valueOf(120), BigDecimal.valueOf(120), null)));
        var inspected = mvc.perform(post(path + "/inspection").header("Authorization", technician).contentType("application/json")
                .content(json.writeValueAsString(inspection))).andExpect(status().isOk())
                .andExpect(jsonPath("$.ticket.status").value("WAITING_APPROVAL"))
                .andExpect(jsonPath("$.context.symptomDescription").value("Máy tự tắt khi dùng"))
                .andReturn().getResponse().getContentAsString();
        var pendingItem = json.readTree(inspected).get("repairItems").valueStream()
                .filter(node -> "PENDING".equals(node.get("approvalStatus").asString())).findFirst().orElseThrow();
        long itemId = pendingItem.get("id").asLong();
        var approvalPath = "/api/v1/internal/repair-items/" + itemId + "/approval";
        String decision = "{\"decision\":\"APPROVED\",\"note\":\"Khách đồng ý báo giá\",\"confirmationMethod\":\"PHONE\"}";
        mvc.perform(post(approvalPath).header("Authorization", technician).contentType("application/json").content(decision))
                .andExpect(status().isForbidden());
        mvc.perform(post(path + "/finish-repair").header("Authorization", technician)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/internal/technician/repair-items/" + itemId + "/approval").header("Authorization", login(f.otherTechnician))
                .contentType("application/json").content(decision)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/resume-repair").header("Authorization", technician)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/internal/technician/repair-items/" + itemId + "/approval").header("Authorization", technician).contentType("application/json").content(decision))
                .andExpect(status().isOk());
        mvc.perform(post(path + "/resume-repair").header("Authorization", technician))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ticket.status").value("REPAIRING"));
        mvc.perform(post(path + "/finish-repair").header("Authorization", technician))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ticket.status").value("WAITING_HANDOVER"));
        assertEquals("Máy tự tắt khi dùng", em.find(ServiceTicket.class, id).getCustomerReportedIssue());
    }

    private RepairItem replacement() {
        var type = new ServiceType(); type.setCode(ServiceTypeCode.REPLACEMENT); type.setName(f.prefix + "replacement"); em.persist(type);
        var part = new Part(); part.setName(f.prefix); part.setPartCode(f.prefix); part.setSalePrice(BigDecimal.TEN); em.persist(part);
        f.catalog.setServiceType(type); f.catalog.setPart(part);
        var ticket = f.ticket(ServiceTicketStatus.REPAIRING);
        var item = f.item(ticket);
        inventory.stockIn(new StockAdjustmentRequest(f.branch.getId(), part.getId(), 3, f.admin.getId(), "test"));
        em.flush();
        return item;
    }

    @Test void replacementWithoutUsageCannotFinishAndStockIsUntouched() {
        var item = replacement();
        assertThrows(BusinessRuleViolationException.class, () -> tickets.finishRepair(item.getServiceTicket().getId(), f.technician.getId()));
        assertEquals(ServiceTicketStatus.REPAIRING, item.getServiceTicket().getStatus());
        assertEquals(3, inventory.getInventory(f.branch.getId(), f.catalog.getPart().getId()).quantity());
    }

    @Test void replacementUsageReturnAndReissueMaintainInventoryAndCompletion() {
        var item = replacement(); long partId = f.catalog.getPart().getId();
        var used = inventory.usePart(new UsePartRequest(item.getId(), partId, 1, f.technician.getId()));
        assertEquals(0, defective.onHand(f.branch.getId(), partId));
        assertEquals(2, inventory.getInventory(f.branch.getId(), partId).quantity());
        inventory.reversePartUsage(new ReversePartUsageRequest(used.id(), f.technician.getId(), "Đổi linh kiện"));
        assertEquals(3, inventory.getInventory(f.branch.getId(), partId).quantity());
        assertThrows(BusinessRuleViolationException.class, () -> tickets.finishRepair(item.getServiceTicket().getId(), f.technician.getId()));
        inventory.usePart(new UsePartRequest(item.getId(), partId, 1, f.technician.getId()));
        tickets.finishRepair(item.getServiceTicket().getId(), f.technician.getId());
        assertEquals(ServiceTicketStatus.WAITING_HANDOVER, item.getServiceTicket().getStatus());
        assertEquals(2, inventory.getInventory(f.branch.getId(), partId).quantity());
        var history = inventory.getTransactionHistory(partId);
        assertEquals(2, history.stream().filter(tx -> tx.transactionType() == InventoryTransactionType.USAGE_OUT).count());
        assertEquals(1, history.stream().filter(tx -> tx.transactionType() == InventoryTransactionType.USAGE_RETURN).count());
    }

    @Test void timingAndDefectiveEndpointsEnforceRolesAndTicketOwnership() throws Exception {
        var ticket = f.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT); em.flush();
        var path = "/api/v1/internal/service-tickets/" + ticket.getId();
        mvc.perform(get(path + "/time-estimates").header("Authorization", login(f.receptionist)))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get(path + "/timing-metrics").header("Authorization", login(f.receptionist)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completeStatusHistory").value(false));
        mvc.perform(get(path + "/defective-part-returns").header("Authorization", login(f.otherTechnician))).andExpect(status().isForbidden());
        mvc.perform(get(path + "/time-estimates").header("Authorization", login(f.otherTechnician))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/defective-part-returns").header("Authorization", login(f.receptionist))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/defective-part-returns").header("Authorization", login(f.admin))).andExpect(status().isOk());
        var manual = "{\"estimatedStartAt\":\"2099-01-01T09:00:00\",\"estimatedCompletionAt\":\"2099-01-01T10:00:00\",\"estimatedDurationMinutes\":60,\"reason\":\"Customer request\"}";
        mvc.perform(put(path + "/eta").header("Authorization", login(f.technician)).contentType("application/json").content(manual)).andExpect(status().isForbidden());
        mvc.perform(put(path + "/eta").header("Authorization", login(f.receptionist)).contentType("application/json").content(manual))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estimateSource").value("MANUAL"));
    }

    @Test void normalReplacementCreatesDefectiveStockOnlyWhenCollected() {
        var item = replacement(); long partId = f.catalog.getPart().getId();
        inventory.usePart(new UsePartRequest(item.getId(), partId, 1, f.technician.getId(), "Battery collected"));
        inventory.usePart(new UsePartRequest(item.getId(), partId, 1, f.technician.getId(), "Second battery collected"));
        assertEquals(2, defective.onHand(f.branch.getId(), partId));
        assertEquals(1, inventory.getInventory(f.branch.getId(), partId).quantity());
        assertEquals(0, defective.onHand(f.branch.getId(), Long.MAX_VALUE));
        assertEquals(2, defective.list(f.branch.getId(), partId, DefectivePartStatus.IN_STOCK, item.getServiceTicket().getId()).size());
    }

    @Test void replacementRejectsAnotherPartEvenWhenItIsInStock() {
        var item = replacement();
        var other = new Part(); other.setName(f.prefix + "other"); other.setPartCode(f.prefix + "other"); other.setSalePrice(BigDecimal.ONE); em.persist(other);
        inventory.stockIn(new StockAdjustmentRequest(f.branch.getId(), other.getId(), 2, f.admin.getId(), "test"));
        assertThrows(BusinessRuleViolationException.class, () -> inventory.usePart(new UsePartRequest(item.getId(), other.getId(), 1, f.technician.getId())));
        assertEquals(2, inventory.getInventory(f.branch.getId(), other.getId()).quantity());
    }

    @Test void bookingRejectsForgedBranchAndIssueFieldsInsteadOfTrustingClientRelations() throws Exception {
        // Booking accepts only slot/model/catalog IDs; branch/issue/type are resolved by the server.
        String valid = json.writeValueAsString(new CreateAppointmentRequest("Khách", f.prefix, f.slot.getId(), null,
                List.of(new AppointmentDeviceRequest(f.model.getId(), null, List.of(new AppointmentServiceItemRequest(f.catalog.getId(), null))))));
        for (String extra : List.of("branchId", "serviceIssueId", "serviceTypeId", "deviceTypeId")) {
            String tampered = "{\"" + extra + "\":999999," + valid.substring(1);
            mvc.perform(post("/api/v1/appointments").contentType("application/json").content(tampered))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_JSON"));
        }
        assertEquals(0, em.createQuery("select count(a) from Appointment a where a.appointmentSlot.id=:id", Long.class)
                .setParameter("id", f.slot.getId()).getSingleResult());
    }
}
