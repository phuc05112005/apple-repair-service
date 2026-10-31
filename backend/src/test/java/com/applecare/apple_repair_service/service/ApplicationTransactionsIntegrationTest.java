package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.AppointmentServiceItemRequest;
import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.request.ConfirmAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.CreateAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.CreateMlPredictionRequest;
import com.applecare.apple_repair_service.dto.request.CreateServiceFeedbackRequest;
import com.applecare.apple_repair_service.dto.request.CreateTransferRequest;
import com.applecare.apple_repair_service.dto.request.HandoverRequest;
import com.applecare.apple_repair_service.dto.request.InspectionRepairItemRequest;
import com.applecare.apple_repair_service.dto.request.IntakeAppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.RecordInspectionRequest;
import com.applecare.apple_repair_service.dto.request.RecordPaymentRequest;
import com.applecare.apple_repair_service.dto.request.ReversePartUsageRequest;
import com.applecare.apple_repair_service.dto.request.StockAdjustmentRequest;
import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.dto.request.TransferStockRequest;
import com.applecare.apple_repair_service.dto.request.UsePartRequest;
import com.applecare.apple_repair_service.dto.request.WalkInIntakeRequest;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceIssue;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PredictionType;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.exception.BusinessException;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.InsufficientStockException;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.jpa.hibernate.ddl-auto=validate", "spring.jpa.open-in-view=false", "spring.jpa.show-sql=false"})
@Import(ApplicationTransactionsIntegrationTest.FixedTime.class)
class ApplicationTransactionsIntegrationTest {
    @TestConfiguration
    static class FixedTime {
        @Bean
        @Primary
        Clock testClock() {
            return TestData.CLOCK;
        }
    }

    @Autowired
    EntityManager em;
    @Autowired
    PlatformTransactionManager manager;
    @Autowired
    AppointmentService appointments;
    @Autowired
    ServiceTicketService tickets;
    @Autowired
    AssignmentService assignments;
    @Autowired
    InventoryService inventory;
    @Autowired
    CustomerService customers;
    @Autowired
    PaymentService payments;
    @Autowired
    FeedbackService feedback;
    @Autowired
    RepairItemService repairItemService;
    @Autowired
    MlPredictionService predictions;
    @Autowired
    com.applecare.apple_repair_service.repository.MlPredictionRepository mlPredictionRepository;
    @Autowired
    com.applecare.apple_repair_service.repository.UserRepository userRepository;
    @Autowired
    com.applecare.apple_repair_service.repository.ServiceInterruptionRepository serviceInterruptions;
    @Autowired
    TransferService transfers;
    @MockitoSpyBean
    TicketCodeGenerator codeGenerator;
    @MockitoSpyBean
    com.applecare.apple_repair_service.repository.DefectivePartReturnRepository defectiveReturns;
    private String prefix;
    private Long branchId, otherBranchId, partId, modelId, catalogId, secondCatalogId, customerId, userId, techId, otherTechId, ticketId, itemId, slotId;

    <T> T tx(Supplier<T> action) {
        var template = new TransactionTemplate(manager);
        template.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        return template.execute(s -> action.get());
    }

    void persist(Object value) {
        em.persist(value);
    }

    @Test void failedDefectiveReceiptRollsBackUsageMovementAndUsableStock() {
        tx(() -> {
            var type = new ServiceType(); type.setCode(ServiceTypeCode.REPLACEMENT); type.setName(prefix + "replacement"); em.persist(type);
            var catalog = em.find(ServiceCatalogItem.class, catalogId); catalog.setServiceType(type); catalog.setPart(em.find(Part.class,partId));
            em.find(ServiceTicket.class,ticketId).setStatus(ServiceTicketStatus.REPAIRING);
            return null;
        });
        org.mockito.Mockito.doThrow(new IllegalStateException("Injected receipt failure"))
                .when(defectiveReturns).saveAndFlush(org.mockito.ArgumentMatchers.any());
        try {
            assertThrows(IllegalStateException.class, () -> inventory.usePart(new UsePartRequest(itemId,partId,1,techId,"Collected defective battery")));
            tx(() -> {
                assertEquals(1, inventory.getInventory(branchId,partId).quantity());
                assertEquals(0L, em.createQuery("select count(u) from PartUsage u where u.repairItem.id=:id",Long.class).setParameter("id",itemId).getSingleResult());
                assertEquals(0L, em.createQuery("select count(t) from InventoryTransaction t where t.part.id=:id",Long.class).setParameter("id",partId).getSingleResult());
                assertEquals(0L, defectiveReturns.onHand(branchId,partId));
                return null;
            });
        } finally { org.mockito.Mockito.reset(defectiveReturns); }
    }

    @Test void stockInCreatesLotStockAndLinkedMovementAtomically() {
        var receivedAt = LocalDateTime.now(TestData.CLOCK).minusMinutes(10);
        var response = inventory.stockIn(new StockInRequest(prefix + "lot", branchId, partId, 3, receivedAt, userId, "Nhà cung cấp thử nghiệm"));
        assertEquals(prefix + "lot", response.lot().lotCode());
        assertEquals(3, response.lot().receivedQuantity());
        assertEquals(4, response.inventory().quantity());
        assertEquals(response.lot().id(), response.transaction().inventoryLotId());
        assertEquals(prefix + "lot", response.transaction().lotCode());
        assertEquals(1L, tx(() -> em.createQuery("select count(l) from InventoryLot l where l.lotCode=:code", Long.class)
                .setParameter("code", prefix + "lot").getSingleResult()));
    }

    @Test void stockInRollbackRemovesLotMovementAndQuantityChange() {
        var code = prefix + "rollbacklot";
        assertThrows(BusinessRuleViolationException.class, () -> tx(() -> {
            inventory.stockIn(new StockInRequest(code, branchId, partId, 2, LocalDateTime.now(TestData.CLOCK), userId, "Rollback test"));
            throw new BusinessRuleViolationException("Force rollback");
        }));
        tx(() -> {
            assertEquals(1, inventory.getInventory(branchId, partId).quantity());
            assertEquals(0L, em.createQuery("select count(l) from InventoryLot l where l.lotCode=:code", Long.class).setParameter("code", code).getSingleResult());
            assertEquals(0L, em.createQuery("select count(t) from InventoryTransaction t where t.inventoryLot.lotCode=:code", Long.class).setParameter("code", code).getSingleResult());
            return null;
        });
    }

    @Test void warrantyReceiptFailureRollsBackAllFourWrites() {
        org.mockito.Mockito.doThrow(new IllegalStateException("Injected warranty receipt failure"))
                .when(defectiveReturns).saveAndFlush(org.mockito.ArgumentMatchers.any());
        try {
            assertThrows(IllegalStateException.class, () -> tx(() -> {
                var original = em.find(RepairItem.class,itemId);
                original.getServiceTicket().setStatus(ServiceTicketStatus.HANDED_OVER);
                var replacementType = new ServiceType(); replacementType.setCode(ServiceTypeCode.REPLACEMENT); replacementType.setName(prefix+"replacement"); em.persist(replacementType);
                var replacement = em.find(ServiceCatalogItem.class,catalogId); replacement.setServiceType(replacementType); replacement.setPart(em.find(Part.class,partId));
                var warrantyType = new ServiceType(); warrantyType.setCode(ServiceTypeCode.WARRANTY); warrantyType.setName(prefix+"warranty"); em.persist(warrantyType);
                var catalog = new ServiceCatalogItem(); catalog.setName(prefix+"warranty"); catalog.setDeviceModel(replacement.getDeviceModel()); catalog.setServiceIssue(replacement.getServiceIssue()); catalog.setServiceType(warrantyType); catalog.setStandardDurationMinutes(30); em.persist(catalog);
                var warrantyTicket = new ServiceTicket(); warrantyTicket.setTicketCode(prefix+"warranty"); warrantyTicket.setReceivedCondition("Defective display received"); warrantyTicket.setCustomerDevice(original.getServiceTicket().getCustomerDevice()); warrantyTicket.setBranch(original.getServiceTicket().getBranch()); warrantyTicket.setCreatedBy(original.getServiceTicket().getCreatedBy()); warrantyTicket.setReceivedAt(LocalDateTime.now(TestData.CLOCK)); warrantyTicket.setStatus(ServiceTicketStatus.REPAIRING); em.persist(warrantyTicket);
                var warranty = new RepairItem(); warranty.setServiceTicket(warrantyTicket); warranty.setServiceCatalogItem(catalog); warranty.setItemNameSnapshot(prefix+"warranty"); warranty.setApprovalStatus(ApprovalStatus.APPROVED); warranty.setFinalPrice(BigDecimal.ZERO); warranty.setWarrantySourceItem(original); warranty.setWarrantyDecision(com.applecare.apple_repair_service.enums.WarrantyDecision.APPROVED); warranty.setWarrantyRemedy(com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT); warranty.setWarrantyReplacementCatalog(replacement); em.persist(warranty); em.flush();
                inventory.usePart(new UsePartRequest(warranty.getId(),partId,1,techId,"Warranty part collected"));
                return null;
            }));
            tx(() -> {
                assertEquals(1,inventory.getInventory(branchId,partId).quantity());
                assertEquals(0L,em.createQuery("select count(u) from PartUsage u where u.part.id=:id",Long.class).setParameter("id",partId).getSingleResult());
                assertEquals(0L,em.createQuery("select count(t) from InventoryTransaction t where t.part.id=:id",Long.class).setParameter("id",partId).getSingleResult());
                assertEquals(0L,defectiveReturns.onHand(branchId,partId));
                return null;
            });
        } finally { org.mockito.Mockito.reset(defectiveReturns); }
    }

    @BeforeEach
    void setup() {
        prefix = "APPTEST" + UUID.randomUUID().toString().replace("-", "");
        tx(() -> {
            var branch = TestData.branch(1);
            branch.setId(null);
            branch.setName(prefix);
            persist(branch);
            branchId = branch.getId();
            var other = TestData.branch(1);
            other.setId(null);
            other.setName(prefix + "other");
            persist(other);
            otherBranchId = other.getId();
            var user = TestData.user(1);
            user.setId(null);
            user.setUsername(prefix + "actor");
            user.setPasswordHash("TEST-ONLY-NON-AUTHENTICATING-HASH");
            persist(user);
            userId = user.getId();
            var tech = TestData.user(1);
            tech.setId(null);
            tech.setUsername(prefix + "tech");
            tech.setPasswordHash("TEST-ONLY-NON-AUTHENTICATING-HASH");
            persist(tech);
            techId = tech.getId();
            var otherTech = TestData.user(1);
            otherTech.setId(null);
            otherTech.setUsername(prefix + "othertech");
            otherTech.setPasswordHash("TEST-ONLY-NON-AUTHENTICATING-HASH");
            persist(otherTech);
            otherTechId = otherTech.getId();
            var type = new DeviceType();
            type.setName(prefix);
            persist(type);
            var model = new DeviceModel();
            model.setDeviceType(type);
            model.setName(prefix);
            persist(model);
            modelId = model.getId();
            var issue = new ServiceIssue();
            issue.setName(prefix);
            issue.getDeviceTypes().add(type);
            issue.setMappingInitialized(true);
            persist(issue);
            var types = em.createQuery("select s from ServiceType s where s.code=:code", ServiceType.class).setParameter("code", ServiceTypeCode.REPAIR).getResultList();
            ServiceType serviceType;
            if (types.isEmpty()) {
                serviceType = new ServiceType();
                serviceType.setCode(ServiceTypeCode.REPAIR);
                serviceType.setName(prefix);
                persist(serviceType);
            } else serviceType = types.getFirst();
            var part = new Part();
            part.setPartCode(prefix);
            part.setName(prefix);
            part.setSalePrice(new BigDecimal("999"));
            persist(part);
            partId = part.getId();
            var catalog = new ServiceCatalogItem();
            catalog.setDeviceModel(model);
            catalog.setServiceIssue(issue);
            catalog.setServiceType(serviceType);
            catalog.setName(prefix);
            catalog.setConfiguredPrice(new BigDecimal("100"));
            catalog.setStandardDurationMinutes(30);
            catalog.setWarrantyDays(30);
            catalog.setWarrantyRemedy(com.applecare.apple_repair_service.enums.WarrantyRemedy.REPAIR);
            persist(catalog);
            catalogId = catalog.getId();
            var second = new ServiceCatalogItem();
            second.setDeviceModel(model);
            second.setServiceIssue(issue);
            second.setServiceType(serviceType);
            second.setName(prefix + "second");
            second.setConfiguredPrice(new BigDecimal("50"));
            second.setStandardDurationMinutes(20);
            persist(second);
            secondCatalogId = second.getId();
            var customer = new Customer();
            customer.setFullName(prefix);
            customer.setPhone(prefix);
            persist(customer);
            customerId = customer.getId();
            var physical = new CustomerDevice();
            physical.setCustomer(customer);
            physical.setDeviceModel(model);
            physical.setSerialNumber(prefix);
            persist(physical);
            var ticket = new ServiceTicket();
            ticket.setTicketCode(prefix);
            ticket.setCustomerDevice(physical);
            ticket.setBranch(branch);
            ticket.setCreatedBy(user);
            ticket.setReceivedAt(LocalDateTime.now(TestData.CLOCK));
            ticket.setReceivedCondition("Test condition");
            persist(ticket);
            ticketId = ticket.getId();
            var item = new RepairItem();
            item.setServiceTicket(ticket);
            item.setServiceCatalogItem(catalog);
            item.setItemNameSnapshot(prefix);
            item.setApprovalStatus(ApprovalStatus.APPROVED);
            item.setFinalPrice(new BigDecimal("100"));
            persist(item);
            itemId = item.getId();
            for (var u : List.of(tech, otherTech)) {
                var shift = new TechnicianSchedule();
                shift.setTechnician(u);
                shift.setBranch(branch);
                shift.setWorkDate(LocalDate.now(TestData.CLOCK));
                shift.setStartTime(LocalTime.of(8, 0));
                shift.setEndTime(LocalTime.of(17, 0));
                persist(shift);
            }
            var stock = new BranchInventory();
            stock.setBranch(branch);
            stock.setPart(part);
            stock.setQuantity(1);
            persist(stock);
            var slot = new AppointmentSlot();
            slot.setBranch(branch);
            slot.setAppointmentDate(LocalDate.now(TestData.CLOCK));
            slot.setStartTime(LocalTime.of(11, 0));
            slot.setEndTime(LocalTime.NOON);
            persist(slot);
            slotId = slot.getId();
            em.flush();
            return null;
        });
    }

    @AfterEach
    void cleanup() {
        if (branchId == null) return;
        tx(() -> {
            var branchIds = List.of(branchId, otherBranchId);
            for (var entry : List.of(
                    new String[]{"DefectivePartReturn", "e.branch.id"},
                    new String[]{"ServiceTimeEstimateHistory", "e.serviceTicket.branch.id"},
                    new String[]{"ServiceTimeEstimateHistory", "e.createdBy.id"},
                    new String[]{"ServiceTimeEstimateHistory", "e.technician.id"},
                    new String[]{"ServiceFeedback", "e.serviceTicket.branch.id"},
                    new String[]{"MlPrediction", "e.serviceTicket.branch.id"},
                    new String[]{"ServiceInterruption", "e.assignment.serviceTicket.branch.id"},
                     new String[]{"Transfer", "e.fromAssignment.serviceTicket.branch.id"},
                     new String[]{"InventoryTransaction", "coalesce(e.sourceBranch.id,e.destinationBranch.id)"},
                     new String[]{"InventoryLot", "e.branch.id"},
                    new String[]{"PartUsage", "e.repairItem.serviceTicket.branch.id"},
                    new String[]{"RepairItem", "e.warrantySourceItem.serviceTicket.branch.id"},
                    new String[]{"ServiceStatusHistory", "e.serviceTicket.branch.id"},
                    new String[]{"Assignment", "e.serviceTicket.branch.id"},
                    new String[]{"AppointmentServiceItem", "e.appointmentDevice.appointment.appointmentSlot.branch.id"},
                    new String[]{"RepairItem", "e.serviceTicket.branch.id"},
                    new String[]{"ServiceTicket", "e.branch.id"},
                    new String[]{"AppointmentDevice", "e.appointment.appointmentSlot.branch.id"},
                    new String[]{"Appointment", "e.appointmentSlot.branch.id"},
                    new String[]{"AppointmentSlot", "e.branch.id"},
                    new String[]{"TechnicianSchedule", "e.branch.id"},
                    new String[]{"BranchInventory", "e.branch.id"})) {
                em.createQuery("delete from " + entry[0] + " e where " + entry[1] + " in :ids").setParameter("ids", branchIds).executeUpdate();
            }
            em.createQuery("delete from CustomerDevice e where e.customer.phone like :prefix").setParameter("prefix", prefix + "%").executeUpdate();
            em.createQuery("delete from Customer e where e.phone like :prefix").setParameter("prefix", prefix + "%").executeUpdate();
            em.createQuery("delete from ServiceCatalogItem e where e.deviceModel.id=:id").setParameter("id", modelId).executeUpdate();
            em.createQuery("delete from DeviceModel e where e.id=:id").setParameter("id", modelId).executeUpdate();
            em.createQuery("select i from ServiceIssue i where i.name=:name", ServiceIssue.class)
                    .setParameter("name", prefix).getResultList().forEach(i -> i.getDeviceTypes().clear());
            em.flush();
            for (var entity : List.of("DeviceType", "ServiceIssue", "ServiceType"))
                em.createQuery("delete from " + entity + " e where e.name like :name").setParameter("name", prefix + "%").executeUpdate();
            em.createQuery("delete from Part e where e.id=:id").setParameter("id", partId).executeUpdate();
            em.createQuery("delete from User e where e.username like :prefix").setParameter("prefix", prefix + "%").executeUpdate();
            em.createQuery("delete from Branch e where e.id in :ids").setParameter("ids", branchIds).executeUpdate();
            em.clear();
            return null;
        });
    }

    CreateAppointmentRequest booking(String phone) {
        return new CreateAppointmentRequest("Test customer", phone, slotId, "Note", List.of(
                new AppointmentDeviceRequest(modelId, "A", List.of(new AppointmentServiceItemRequest(catalogId, null), new AppointmentServiceItemRequest(secondCatalogId, null))),
                new AppointmentDeviceRequest(modelId, "B", List.of(new AppointmentServiceItemRequest(catalogId, null)))));
    }

    void openArrivalWindow() {
        tx(() -> {
            var slot = em.find(AppointmentSlot.class, slotId);
            var now = LocalDateTime.now(TestData.CLOCK);
            slot.setAppointmentDate(now.toLocalDate());
            slot.setStartTime(now.toLocalTime().minusMinutes(30));
            slot.setEndTime(now.toLocalTime().plusMinutes(30));
            return null;
        });
    }

    @Test
    void completeBookingToHandoverKeepsDtosUsableOutsideTransaction() {
        var booking = appointments.createAppointment(booking(prefix + "booking"));
        assertEquals(2, booking.devices().size());
        assertEquals(2, booking.devices().getFirst().serviceItems().size());
        var aid = booking.appointment().id();
        openArrivalWindow();
        appointments.confirmAppointment(aid, new ConfirmAppointmentRequest(userId));
        appointments.markArrived(aid);
        var received = tickets.intakeAppointmentDevice(new IntakeAppointmentDeviceRequest(booking.devices().getFirst().device().id(), prefix + "bookingDevice", null, "Received", userId));
        assertEquals(2, received.repairItems().size());
        assertEquals(ServiceTicketStatus.WAITING_ASSIGNMENT, received.history().getFirst().toStatus());
        var id = received.ticket().id();
        assignments.assignTechnician(id, new AssignTechnicianRequest(techId, userId, AssignmentSource.MANUAL_OVERRIDE));
        tickets.startInspection(id, userId);
        var revised = tickets.recordInspection(id, new RecordInspectionRequest("Confirmed plan", userId, false,
                List.of(new InspectionRepairItemRequest(catalogId, new BigDecimal("100"), new BigDecimal("90"), null)),
                com.applecare.apple_repair_service.enums.ConfirmationMethod.DIRECT, "Khách đồng ý phạm vi mới tại cửa hàng"));
        assertEquals(ServiceTicketStatus.REPAIRING, revised.ticket().status());
        inventory.usePart(new UsePartRequest(tickets.getById(id).repairItems().stream().filter(i -> i.approvalStatus() == ApprovalStatus.APPROVED).findFirst().orElseThrow().id(), partId, 1, userId));
        assertEquals(new BigDecimal("90.00"), payments.calculateTicketTotal(id));
        tickets.finishRepair(id, userId);
        payments.recordPayment(id, new RecordPaymentRequest(PaymentMethod.CASH));
        var handed = tickets.handover(id, new HandoverRequest(userId));
        assertEquals(ServiceTicketStatus.HANDED_OVER, handed.ticket().status());
        assertEquals(6, handed.history().size());
        assertEquals("Test customer", customers.getById(booking.appointment().customerId()).fullName());
        feedback.createFeedback(new CreateServiceFeedbackRequest(id, true, "OK"));
        predictions.savePrediction(new CreateMlPredictionRequest(id, PredictionType.REPAIR_DURATION, 30, null, null, "test", "v1"));
        predictions.savePrediction(new CreateMlPredictionRequest(id, PredictionType.REPAIR_DURATION, 40, null, null, "test", "v2"));
        assertEquals(2, predictions.getPredictionHistory(id, PredictionType.REPAIR_DURATION).size());
        assertEquals(40, predictions.getLatestPrediction(id, PredictionType.REPAIR_DURATION).predictedDurationMinutes());
    }

    @Test
    void predictionsPersistPerTechnicianAndKeepTicketLevelSatisfactionNullable() {
        var first = predictions.savePrediction(new CreateMlPredictionRequest(ticketId, techId,
                PredictionType.REPAIR_DURATION, 48, null, new BigDecimal("0.9100"), "test", "v1"));
        var second = predictions.savePrediction(new CreateMlPredictionRequest(ticketId, otherTechId,
                PredictionType.REPAIR_DURATION, 55, null, new BigDecimal("0.9000"), "test", "v1"));
        var satisfaction = predictions.savePrediction(new CreateMlPredictionRequest(ticketId,
                PredictionType.CUSTOMER_SATISFACTION, null, true,
                new BigDecimal("0.8000"), "test", "v1"));

        assertEquals(techId, first.technicianId());
        assertEquals(otherTechId, second.technicianId());
        assertEquals(first.predictedAt(), second.predictedAt());
        assertNull(satisfaction.technicianId());
        assertEquals(3, predictions.getPredictionHistory(ticketId, PredictionType.REPAIR_DURATION).size()
                + predictions.getPredictionHistory(ticketId, PredictionType.CUSTOMER_SATISFACTION).size());
        assertEquals(48, mlPredictionRepository
                .findFirstByServiceTicket_IdAndTechnician_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(
                        ticketId, techId, PredictionType.REPAIR_DURATION)
                .orElseThrow().getPredictedDurationMinutes());
        assertEquals(55, mlPredictionRepository
                .findFirstByServiceTicket_IdAndTechnician_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(
                        ticketId, otherTechId, PredictionType.REPAIR_DURATION)
                .orElseThrow().getPredictedDurationMinutes());
    }

    @Test
    void predictionTechnicianForeignKeyPreventsUserDeletionWithoutCascade() {
        Long candidateId = tx(() -> {
            var candidate = TestData.user(1L);
            candidate.setId(null);
            candidate.setUsername(prefix + "mlcandidate");
            candidate.setPasswordHash("TEST-ONLY-NON-AUTHENTICATING-HASH");
            persist(candidate);
            em.flush();
            return candidate.getId();
        });
        var prediction = predictions.savePrediction(new CreateMlPredictionRequest(ticketId, candidateId,
                PredictionType.REPAIR_DURATION, 43, null, null, "test", "v1"));

        assertThrows(DataIntegrityViolationException.class, () -> tx(() -> {
            userRepository.deleteById(candidateId);
            userRepository.flush();
            return null;
        }));
        assertTrue(tx(() -> userRepository.existsById(candidateId)));
        assertTrue(tx(() -> mlPredictionRepository.existsById(prediction.id())));
    }

    @Test
    void serviceInterruptionPersistsAssignmentAuditAndRejectsInvalidTimeRange() {
        var assignment = assignments.assignTechnician(ticketId,
                new AssignTechnicianRequest(techId, userId, AssignmentSource.MANUAL_OVERRIDE));
        var startedAt = LocalDateTime.now(TestData.CLOCK).plusMinutes(10);
        Long interruptionId = tx(() -> {
            var interruption = new ServiceInterruption();
            interruption.setAssignment(em.getReference(com.applecare.apple_repair_service.entity.Assignment.class,
                    assignment.id()));
            interruption.setStartedAt(startedAt);
            interruption.setReason(InterruptionReason.EQUIPMENT_FAILURE);
            interruption.setResponsibilityScope(InterruptionResponsibility.BRANCH);
            interruption.setSource(InterruptionSource.TECHNICIAN);
            interruption.setIncidentGroupCode(prefix + "incident");
            interruption.setNote("Thiết bị kiểm tra tạm ngừng hoạt động");
            interruption.setRecordedBy(em.getReference(com.applecare.apple_repair_service.entity.User.class,
                    userId));
            return serviceInterruptions.saveAndFlush(interruption).getId();
        });

        tx(() -> {
            var stored = serviceInterruptions.findById(interruptionId).orElseThrow();
            assertEquals(assignment.id(), stored.getAssignment().getId());
            assertEquals(userId, stored.getRecordedBy().getId());
            assertNull(stored.getEndedAt());
            assertFalse(stored.isVerified());
            assertNotNull(stored.getCreatedAt());
            return null;
        });

        assertThrows(DataIntegrityViolationException.class, () -> tx(() -> {
            var invalid = new ServiceInterruption();
            invalid.setAssignment(em.getReference(com.applecare.apple_repair_service.entity.Assignment.class,
                    assignment.id()));
            invalid.setStartedAt(startedAt);
            invalid.setEndedAt(startedAt.minusMinutes(1));
            invalid.setReason(InterruptionReason.OTHER);
            invalid.setResponsibilityScope(InterruptionResponsibility.OTHER);
            invalid.setSource(InterruptionSource.ADMIN);
            invalid.setNote("Invalid range test");
            invalid.setRecordedBy(em.getReference(com.applecare.apple_repair_service.entity.User.class,
                    userId));
            serviceInterruptions.saveAndFlush(invalid);
            return null;
        }));
    }

    @Test
    void failedBookingRollsBackCustomerAndAllChildRows() {
        var bad = new CreateAppointmentRequest("Bad", prefix + "rollback", slotId, null, List.of(new AppointmentDeviceRequest(modelId, null, List.of(new AppointmentServiceItemRequest(catalogId, itemId)))));
        assertThrows(BusinessRuleViolationException.class, () -> appointments.createAppointment(bad));
        assertEquals(0L, tx(() -> em.createQuery("select count(c) from Customer c where c.phone=:phone", Long.class).setParameter("phone", prefix + "rollback").getSingleResult()));
        assertEquals(0, appointments.countActiveBookings(slotId));
    }

    @Test
    void outerFailureRollsBackUsageStockAndAudit() {
        tx(() -> {
            em.find(ServiceTicket.class, ticketId).setStatus(ServiceTicketStatus.REPAIRING);
            return null;
        });
        assertThrows(BusinessRuleViolationException.class, () -> tx(() -> {
            inventory.usePart(new UsePartRequest(itemId, partId, 1, userId));
            throw new BusinessRuleViolationException("Force outer rollback");
        }));
        assertEquals(1, inventory.getInventory(branchId, partId).quantity());
        assertEquals(0, inventory.getTransactionHistory(partId).size());
        assertEquals(0L, tx(() -> em.createQuery("select count(u) from PartUsage u where u.repairItem.id=:id", Long.class).setParameter("id", itemId).getSingleResult()));
    }

    @Test
    void insufficientStockTransferRollsBackDestinationCreation() {
        assertThrows(InsufficientStockException.class, () -> inventory.transferStock(new TransferStockRequest(partId, branchId, otherBranchId, 2, userId, null)));
        assertEquals(1, inventory.getInventory(branchId, partId).quantity());
        assertNull(inventory.getInventory(otherBranchId, partId).id());
        assertEquals(0, inventory.getTransactionHistory(partId).size());
    }

    List<String> race(Runnable first, Runnable second) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            var calls = new ArrayList<Future<String>>();
            for (var action : List.of(first, second))
                calls.add(pool.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new AssertionError("Barrier timeout");
                    try {
                        action.run();
                        return "OK";
                    } catch (BusinessException e) {
                        return e.getClass().getSimpleName();
                    }
                }));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            var result = new ArrayList<String>();
            for (var call : calls) result.add(call.get(20, TimeUnit.SECONDS));
            return result;
        }
    }

    @Test
    void simultaneousAssignmentsCreateExactlyOneActive() throws Exception {
        var results = race(() -> assignments.assignTechnician(ticketId, new AssignTechnicianRequest(techId, userId, AssignmentSource.MANUAL_OVERRIDE)),
                () -> assignments.assignTechnician(ticketId, new AssignTechnicianRequest(otherTechId, userId, AssignmentSource.MANUAL_OVERRIDE)));
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(1, Collections.frequency(results, "ConflictException"));
        assertEquals(1, assignments.getHistory(ticketId).stream().filter(a -> a.status() == AssignmentStatus.ACTIVE).count());
        assertEquals(ServiceTicketStatus.ASSIGNED, tickets.getById(ticketId).ticket().status());
        assertEquals(1, tickets.getById(ticketId).history().size());
    }

    @Test
    void simultaneousDecrementsCannotOversell() throws Exception {
        var r = new StockAdjustmentRequest(branchId, partId, 1, userId, null);
        var results = race(() -> inventory.stockOut(r), () -> inventory.stockOut(r));
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(1, Collections.frequency(results, "InsufficientStockException"));
        assertEquals(0, inventory.getInventory(branchId, partId).quantity());
        assertEquals(1, inventory.getTransactionHistory(partId).size());
    }

    @Test
    void concurrentCustomerPhoneResolvesWinnerInFreshTransaction() throws Exception {
        var results = race(() -> customers.findOrCreateByPhone("A", prefix + "race"), () -> customers.findOrCreateByPhone("B", prefix + "race"));
        assertEquals(List.of("OK", "OK"), results);
        assertEquals(1L, tx(() -> em.createQuery("select count(c) from Customer c where c.phone=:p", Long.class).setParameter("p", prefix + "race").getSingleResult()));
    }

    @Test
    void simultaneousReversalsRestoreStockOnlyOnce() throws Exception {
        tx(() -> {
            em.find(ServiceTicket.class, ticketId).setStatus(ServiceTicketStatus.REPAIRING);
            return null;
        });
        var usage = inventory.usePart(new UsePartRequest(itemId, partId, 1, userId));
        var r = new ReversePartUsageRequest(usage.id(), userId, "Return");
        var results = race(() -> inventory.reversePartUsage(r), () -> inventory.reversePartUsage(r));
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(1, Collections.frequency(results, "ConflictException"));
        assertEquals(1, inventory.getInventory(branchId, partId).quantity());
    }

    @Test
    void transferRollbackKeepsOldAssignmentActive() {
        var old = assignments.assignTechnician(ticketId, new AssignTechnicianRequest(techId, userId, AssignmentSource.MANUAL_OVERRIDE));
        assertThrows(BusinessRuleViolationException.class, () -> tx(() -> {
            transfers.directTransfer(new CreateTransferRequest(old.id(), otherTechId, userId, TransferMode.DIRECT,
                    "Cân bằng công việc", "Đã kiểm tra thiết bị", "Thiết bị đang chờ xử lý tiếp"));
            throw new BusinessRuleViolationException("Force rollback");
        }));
        assertEquals(1, assignments.getHistory(ticketId).size());
        assertEquals(AssignmentStatus.ACTIVE, assignments.getHistory(ticketId).getFirst().status());
        assertTrue(transfers.getHistory(ticketId).isEmpty());
    }

    @Test
    void composedUseCasesPreserveChangesWithinOneTransaction() {
        var booking = appointments.createAppointment(booking(prefix + "composed"));
        openArrivalWindow();
        tx(() -> {
            appointments.confirmAppointment(booking.appointment().id(), new ConfirmAppointmentRequest(userId));
            appointments.markArrived(booking.appointment().id());
            return null;
        });
        assertEquals(AppointmentStatus.ARRIVED, appointments.getById(booking.appointment().id()).appointment().status());
        tx(() -> {
            em.find(ServiceTicket.class, ticketId).setStatus(ServiceTicketStatus.WAITING_HANDOVER);
            return null;
        });
        tx(() -> {
            payments.recordPayment(ticketId, new RecordPaymentRequest(PaymentMethod.CASH));
            tickets.handover(ticketId, new HandoverRequest(userId));
            return null;
        });
        assertEquals(ServiceTicketStatus.HANDED_OVER, tickets.getById(ticketId).ticket().status());
        assertEquals(PaymentMethod.CASH, payments.getSummary(ticketId).paymentMethod());
    }

    @Test
    void warrantyAppointmentNeedsNoServiceSelectionAndKeepsFreeWarrantyWhenAddingPaidWork() {
        tx(() -> {
            var sourceTicket = em.find(ServiceTicket.class, ticketId);
            sourceTicket.setStatus(ServiceTicketStatus.HANDED_OVER);
            var sourceItem = em.find(RepairItem.class, itemId);
            sourceItem.setWarrantyStartDate(LocalDate.now(TestData.CLOCK).minusDays(1));
            sourceItem.setWarrantyEndDate(LocalDate.now(TestData.CLOCK).plusDays(29));
            return null;
        });
        var request = new CreateAppointmentRequest(prefix, prefix, slotId, null, List.of(
                new AppointmentDeviceRequest(modelId, "Lỗi quay lại", List.of(
                        new AppointmentServiceItemRequest(null, itemId)))));
        var booking = appointments.createAppointment(request);
        var serviceItem = appointments.getById(booking.appointment().id()).devices().getFirst().serviceItems().getFirst();
        assertEquals(itemId, serviceItem.warrantySourceItemId());
        assertTrue(serviceItem.serviceNameSnapshot().startsWith("Bảo hành · "));
        assertEquals(0, BigDecimal.ZERO.compareTo(serviceItem.finalPriceSnapshot()));

        openArrivalWindow();
        appointments.confirmAppointment(booking.appointment().id(), new ConfirmAppointmentRequest(userId));
        appointments.markArrived(booking.appointment().id());
        var appointmentDeviceId = appointments.getById(booking.appointment().id()).devices().getFirst().device().id();
        var ticket = tickets.intakeAppointmentDevice(new IntakeAppointmentDeviceRequest(appointmentDeviceId, null, null,
                null, List.of(secondCatalogId), userId));
        var warrantyClaim = ticket.repairItems().stream().filter(repairItem -> repairItem.warrantySourceItemId() != null).findFirst().orElseThrow();
        var paidExtra = ticket.repairItems().stream().filter(repairItem -> repairItem.warrantySourceItemId() == null).findFirst().orElseThrow();
        assertEquals(itemId, warrantyClaim.warrantySourceItemId());
        assertEquals(0, BigDecimal.ZERO.compareTo(warrantyClaim.finalPrice()));
        assertEquals("Bảo hành · " + prefix, warrantyClaim.itemNameSnapshot());
        assertEquals(0, new BigDecimal("50.00").compareTo(paidExtra.finalPrice()));
        assertEquals(0, BigDecimal.ZERO.compareTo(tickets.getById(ticket.ticket().id()).ticket().discountPercent()));
        assertNull(ticket.ticket().receivedCondition());
    }

    @Test
    void actualTicketCodeCollisionRetriesWholeIntake() {
        org.mockito.Mockito.doReturn(prefix, prefix + "retry").when(codeGenerator).next();
        var result = tickets.createWalkInTicket(new WalkInIntakeRequest("Retry", prefix + "collision", branchId, modelId, null, null, "Condition", List.of(catalogId)), userId);
        assertEquals(prefix + "retry", result.ticket().ticketCode());
        assertEquals(1L, tx(() -> em.createQuery("select count(c) from Customer c where c.phone=:phone", Long.class).setParameter("phone", prefix + "collision").getSingleResult()));
        assertEquals(1, result.history().size());
    }

    @Test
    void repeatedCollisionExhaustionLeavesNoPartialIntake() {
        org.mockito.Mockito.doReturn(prefix).when(codeGenerator).next();
        assertThrows(ConflictException.class, () -> tickets.createWalkInTicket(new WalkInIntakeRequest("Retry", prefix + "exhausted", branchId, modelId, null, null, "Condition", List.of(catalogId)), userId));
        org.mockito.Mockito.verify(codeGenerator, org.mockito.Mockito.times(3)).next();
        assertEquals(0L, tx(() -> em.createQuery("select count(c) from Customer c where c.phone=:phone", Long.class).setParameter("phone", prefix + "exhausted").getSingleResult()));
    }

    @Test
    void concurrentBookingsReuseOneCustomerWithoutPartialRows() throws Exception {
        var request = booking(prefix + "bookingrace");
        var results = race(() -> appointments.createAppointment(request), () -> appointments.createAppointment(request));
        assertEquals(List.of("OK", "OK"), results);
        assertEquals(2, appointments.countActiveBookings(slotId));
        assertEquals(1L, tx(() -> em.createQuery("select count(c) from Customer c where c.phone=:phone", Long.class).setParameter("phone", prefix + "bookingrace").getSingleResult()));
        assertEquals(2, appointments.findByPhone(prefix + "bookingrace").size());
    }

    @Test
    void concurrentInitialStockCreationCreatesOneInventoryRow() throws Exception {
        var request = new StockAdjustmentRequest(otherBranchId, partId, 1, userId, null);
        assertEquals(List.of("OK", "OK"), race(() -> inventory.stockIn(request), () -> inventory.stockIn(request)));
        assertEquals(2, inventory.getInventory(otherBranchId, partId).quantity());
        assertEquals(1L, tx(() -> em.createQuery("select count(i) from BranchInventory i where i.branch.id=:branch and i.part.id=:part", Long.class).setParameter("branch", otherBranchId).setParameter("part", partId).getSingleResult()));
    }

    @Test
    void concurrentIntakeCreatesOnlyOneTicket() throws Exception {
        var booked = appointments.createAppointment(booking(prefix + "intakerace"));
        openArrivalWindow();
        appointments.confirmAppointment(booked.appointment().id(), new ConfirmAppointmentRequest(userId));
        appointments.markArrived(booked.appointment().id());
        var request = new IntakeAppointmentDeviceRequest(booked.devices().getFirst().device().id(), null, null, "Condition", userId);
        var results = race(() -> tickets.intakeAppointmentDevice(request), () -> tickets.intakeAppointmentDevice(request));
        assertEquals(1, Collections.frequency(results, "OK"));
        assertEquals(1, Collections.frequency(results, "ConflictException"));
    }
}
