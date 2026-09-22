package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.publicapi.PublicFeedbackRequest;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.*;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class HttpWorkflowIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    @Autowired PlatformTransactionManager manager;
    @MockitoSpyBean TicketAccessPolicy policy; // Real policy with a latch only in the concurrency test.
    ApiFixture f;
    Long partId;
    Map<String,Long> before;
    <T> T tx(Supplier<T> work) {
        var transaction=new TransactionTemplate(manager);
        transaction.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        return transaction.execute(status->work.get());
    }
    Map<String,Long> counts() {
        return tx(()-> {
            Map<String,Long> result=new TreeMap<>();
            for(var value:em.createNativeQuery("SHOW TABLES",String.class).getResultList()) {
                String table=(String)value;
                if(!table.matches("[a-z_]+")) throw new IllegalStateException("Unexpected table");
                result.put(table,((Number)em.createNativeQuery("SELECT COUNT(*) FROM "+table,Long.class).getSingleResult()).longValue());
            }
            return result;
        });
    }
    @BeforeEach void fixture() {
        before=counts();
        tx(()-> {
            f=new ApiFixture(em,clock);f.create();
            for(var user:List.of(f.technician,f.otherTechnician)) {
                var shift=new TechnicianSchedule();shift.setTechnician(user);shift.setBranch(f.branch);shift.setWorkDate(LocalDate.now(clock));
                shift.setStartTime(LocalTime.MIN);shift.setEndTime(LocalTime.of(23,59,59));em.persist(shift);
            }
            var part=new Part();part.setPartCode(f.prefix);part.setName(f.prefix);part.setSalePrice(new BigDecimal("999.00"));em.persist(part);partId=part.getId();
            var stock=new BranchInventory();stock.setBranch(f.branch);stock.setPart(part);stock.setQuantity(5);em.persist(stock);
            return null;
        });
    }
    @AfterEach void cleanup() {
        if(f==null || f.branch==null || f.branch.getId()==null) return;
        tx(()-> {
            for(var entry:List.of(
                    new String[]{"DefectivePartReturn", "e.branch.id"},
                    new String[]{"ServiceTimeEstimateHistory", "e.serviceTicket.branch.id"},
                    new String[]{"ServiceFeedback","e.serviceTicket.branch.id"},
                    new String[]{"MlPrediction","e.serviceTicket.branch.id"},
                    new String[]{"Transfer","e.fromAssignment.serviceTicket.branch.id"},
                    new String[]{"InventoryTransaction","coalesce(e.sourceBranch.id,e.destinationBranch.id)"},
                    new String[]{"PartUsage","e.repairItem.serviceTicket.branch.id"},
                    new String[]{"ServiceStatusHistory","e.serviceTicket.branch.id"},
                    new String[]{"Assignment","e.serviceTicket.branch.id"},
                    new String[]{"RepairItem","e.serviceTicket.branch.id"},
                    new String[]{"ServiceTicket","e.branch.id"},
                    new String[]{"AppointmentServiceItem","e.appointmentDevice.appointment.appointmentSlot.branch.id"},
                    new String[]{"AppointmentDevice","e.appointment.appointmentSlot.branch.id"},
                    new String[]{"Appointment","e.appointmentSlot.branch.id"},
                    new String[]{"AppointmentSlot","e.branch.id"},
                    new String[]{"TechnicianSchedule","e.branch.id"},
                    new String[]{"BranchInventory","e.branch.id"})) {
                em.createQuery("delete from "+entry[0]+" e where "+entry[1]+"=:id").setParameter("id",f.branch.getId()).executeUpdate();
            }
            em.createQuery("delete from CustomerDevice d where d.customer.phone like :prefix").setParameter("prefix",f.prefix+"%").executeUpdate();
            em.createQuery("delete from Customer c where c.phone like :prefix").setParameter("prefix",f.prefix+"%").executeUpdate();
            em.createQuery("delete from ServiceCatalogItem c where c.deviceModel.id=:id").setParameter("id",f.model.getId()).executeUpdate();
            em.createQuery("delete from DeviceModel d where d.id=:id").setParameter("id",f.model.getId()).executeUpdate();
            var issue = em.find(ServiceIssue.class, f.issue.getId());
            if (issue != null) { issue.getDeviceTypes().clear(); em.flush(); }
            for(var entity:List.of("DeviceType","ServiceIssue","ServiceType"))
                em.createQuery("delete from "+entity+" e where e.name=:name").setParameter("name",f.prefix).executeUpdate();
            em.createQuery("delete from Part p where p.id=:id").setParameter("id",partId).executeUpdate();
            em.createQuery("delete from User u where u.username like :prefix").setParameter("prefix",f.prefix+"%").executeUpdate();
            em.createQuery("delete from Branch b where b.id=:id").setParameter("id",f.branch.getId()).executeUpdate();
            em.clear();return null;
        });
        assertEquals(before,counts(),"Every table returns to its original row count after exact fixture cleanup");
    }
    JsonNode postJson(String uri,String token,Object body,int status) throws Exception {
        var request=post(uri);
        if(token!=null) request.header("Authorization",token);
        if(body!=null) request.contentType("application/json").content(json.writeValueAsString(body));
        var response=mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse().getContentAsString();
        return response.isBlank()?null:json.readTree(response);
    }
    String login(User user) throws Exception {
        return "Bearer "+postJson("/api/v1/auth/login",null,new LoginRequest(user.getUsername(),ApiFixture.PASSWORD),200).get("accessToken").asString();
    }
    long bookAndIntake(String receptionist) throws Exception {
        var booking=postJson("/api/v1/appointments",null,new CreateAppointmentRequest(f.prefix,f.prefix,f.slot.getId(),null,
                List.of(new AppointmentDeviceRequest(f.model.getId(),"symptom",List.of(new AppointmentServiceItemRequest(f.catalog.getId(),null))))),201);
        long appointmentId=booking.get("appointmentId").asLong();
        var list=mvc.perform(get("/api/v1/internal/appointments").header("Authorization",receptionist)
                .param("branchId",f.branch.getId().toString()).param("date",f.slot.getAppointmentDate().toString())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals(appointmentId,json.readTree(list).get(0).get("appointment").get("id").asLong());
        var confirmed=postJson("/api/v1/internal/appointments/"+appointmentId+"/confirm",receptionist,null,200);
        assertEquals(f.receptionist.getId().longValue(),confirmed.get("appointment").get("confirmedById").asLong());
        long deviceId=confirmed.get("devices").get(0).get("device").get("id").asLong();
        postJson("/api/v1/internal/appointments/"+appointmentId+"/arrive",receptionist,null,200);
        return postJson("/api/v1/internal/appointment-devices/"+deviceId+"/intake",receptionist,
                new IntakeDeviceCommand(f.prefix,"128 GB","Received"),201).get("ticket").get("id").asLong();
    }
    void assign(long ticketId,String reception) throws Exception {
        postJson("/api/v1/internal/service-tickets/"+ticketId+"/assignments",reception,
                new AssignTechnicianCommand(f.technician.getId(),AssignmentSource.MANUAL_OVERRIDE),201);
    }
    @Test void fullHttpBookingRepairPaymentHandoverFeedbackCommitsExpectedState() throws Exception {
        mvc.perform(get("/api/v1/service-catalog-items").param("deviceModelId",f.model.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].configuredPrice").value(100));
        mvc.perform(get("/api/v1/appointment-slots").param("branchId",f.branch.getId().toString()).param("date",f.slot.getAppointmentDate().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].activeBookingCount").value(0));
        String reception=login(f.receptionist);
        long ticketId=bookAndIntake(reception);
        String path="/api/v1/internal/service-tickets/"+ticketId;
        mvc.perform(get(path+"/technician-recommendations").header("Authorization",reception)).andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        assign(ticketId,reception);
        String technician=login(f.technician);
        postJson(path+"/inspection/start",technician,null,200);
        var inspected=postJson(path+"/inspection",technician,new InspectionCommand("Same repair",false,
                List.of(new InspectionRepairItemRequest(f.catalog.getId(),new BigDecimal("100.00"),new BigDecimal("90.00"),null))),200);
        assertEquals("REPAIRING",inspected.get("ticket").get("status").asString());
        long itemId=inspected.get("repairItems").get(0).get("id").asLong();
        postJson("/api/v1/internal/repair-items/"+itemId+"/part-usages",technician,new PartUsageCommand(partId,2),201);
        mvc.perform(get(path+"/repair-duration").header("Authorization",technician)).andExpect(status().isOk()).andExpect(jsonPath("$.currentRepairMinutes").isNumber());
        postJson(path+"/finish-repair",technician,null,200);
        // Positive total cannot be handed over before payment.
        postJson(path+"/handover",reception,null,400);
        var payment=postJson(path+"/payment",reception,new RecordPaymentRequest(PaymentMethod.CASH),200);
        assertEquals("PAID",payment.get("paymentStatus").asString());
        var handed=postJson(path+"/handover",reception,null,200);
        assertEquals("HANDED_OVER",handed.get("ticket").get("status").asString());
        String code=handed.get("ticket").get("ticketCode").asString();
        mvc.perform(get("/api/v1/service-tickets/lookup").param("phone",f.prefix)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ticketCode").value(code)).andExpect(jsonPath("$[0].approvedTotal").value(90))
                .andExpect(jsonPath("$[0].inspectionResult").doesNotExist());
        postJson("/api/v1/service-tickets/"+code+"/feedback",null,new PublicFeedbackRequest(f.prefix,true,"Good"),201);
        tx(()-> {
            var t=em.find(ServiceTicket.class,ticketId);
            assertEquals(ServiceTicketStatus.HANDED_OVER,t.getStatus());assertEquals(PaymentStatus.PAID,t.getPaymentStatus());
            assertEquals(PaymentMethod.CASH,t.getPaymentMethod());assertNotNull(t.getPaidAt());assertNotNull(t.getHandedOverAt());
            assertEquals(f.receptionist.getId(),t.getCreatedBy().getId());assertEquals(f.receptionist.getId(),t.getHandedOverBy().getId());
            assertEquals(f.technician.getId(),t.getInspectedBy().getId());
            assertEquals(f.prefix,t.getCustomerDevice().getCustomer().getPhone());
            assertEquals(AppointmentStatus.ARRIVED,t.getAppointmentDevice().getAppointment().getStatus());
            var histories=em.createQuery("select h from ServiceStatusHistory h where h.serviceTicket.id=:id order by h.changedAt,h.id",ServiceStatusHistory.class)
                    .setParameter("id",ticketId).getResultList();
            assertEquals(List.of(ServiceTicketStatus.WAITING_ASSIGNMENT,ServiceTicketStatus.ASSIGNED,ServiceTicketStatus.INSPECTING,
                    ServiceTicketStatus.REPAIRING,ServiceTicketStatus.WAITING_HANDOVER,ServiceTicketStatus.HANDED_OVER),
                    histories.stream().map(ServiceStatusHistory::getToStatus).toList());
            assertEquals(List.of(f.receptionist.getId(),f.receptionist.getId(),f.technician.getId(),f.technician.getId(),f.technician.getId(),f.receptionist.getId()),
                    histories.stream().map(h->h.getChangedBy().getId()).toList());
            var repair=em.find(RepairItem.class,itemId);assertEquals(new BigDecimal("90.00"),repair.getFinalPrice());assertNotNull(repair.getWarrantyEndDate());
            var assignment=em.createQuery("select a from Assignment a where a.serviceTicket.id=:id",Assignment.class).setParameter("id",ticketId).getSingleResult();
            assertEquals(AssignmentStatus.ENDED,assignment.getStatus());assertEquals(f.receptionist.getId(),assignment.getAssignedBy().getId());
            var usage=em.createQuery("select u from PartUsage u where u.repairItem.id=:id",PartUsage.class).setParameter("id",itemId).getSingleResult();
            assertEquals(2,usage.getQuantity());assertEquals(f.technician.getId(),usage.getRecordedBy().getId());
            assertEquals(3,em.createQuery("select b.quantity from BranchInventory b where b.branch.id=:id and b.part.id=:part",Integer.class)
                    .setParameter("id",f.branch.getId()).setParameter("part",partId).getSingleResult());
            assertTrue(em.createQuery("select f.satisfied from ServiceFeedback f where f.serviceTicket.id=:id",Boolean.class).setParameter("id",ticketId).getSingleResult());
            return null;
        });
    }
    @Test void transferWaitsForAuthorizedMutationTransactionThenRevokesOldActor() throws Exception {
        String reception=login(f.receptionist),a=login(f.technician),b=login(f.otherTechnician);
        long ticketId=bookAndIntake(reception);assign(ticketId,reception);
        String path="/api/v1/internal/service-tickets/"+ticketId;
        var checked=new CountDownLatch(1);var release=new CountDownLatch(1);var transferAttempt=new CountDownLatch(1);
        TicketAccessPolicy probe=org.springframework.test.util.AopTestUtils.getUltimateTargetObject(policy);
        doAnswer(call-> {
            Object result=call.callRealMethod();
            if(Thread.currentThread().getName().equals("technician-http")) {
                checked.countDown();
                if(!release.await(15,TimeUnit.SECONDS)) throw new IllegalStateException("Test latch timeout");
            }
            return result;
        }).when(probe).requireActiveTechnician(anyLong());
        doAnswer(call-> {
            if(Thread.currentThread().getName().equals("transfer-http")) transferAttempt.countDown();
            return call.callRealMethod();
        }).when(probe).activeAssignment(anyLong());
        var technicianExecutor=Executors.newSingleThreadExecutor(r->new Thread(r,"technician-http"));
        var transferExecutor=Executors.newSingleThreadExecutor(r->new Thread(r,"transfer-http"));
        try {
            var mutation=technicianExecutor.submit(()->postJson(path+"/inspection/start",a,null,200));
            assertTrue(checked.await(10,TimeUnit.SECONDS));
            var transfer=transferExecutor.submit(()->postJson(path+"/transfers/direct",reception,new TransferCommand(f.otherTechnician.getId(),"Concurrent"),200));
            assertTrue(transferAttempt.await(10,TimeUnit.SECONDS));
            assertThrows(TimeoutException.class,()->transfer.get(300,TimeUnit.MILLISECONDS),"Transfer must wait while the authorized transaction holds the ticket lock");
            release.countDown();mutation.get(15,TimeUnit.SECONDS);transfer.get(15,TimeUnit.SECONDS);
            assertEquals("ACCESS_DENIED",postJson(path+"/inspection/start",a,null,403).get("code").asString());
            postJson(path+"/inspection",b,new InspectionCommand("Same repair",false,List.of(
                    new InspectionRepairItemRequest(f.catalog.getId(),new BigDecimal("100.00"),new BigDecimal("90.00"),null))),200);
            tx(()-> {
                assertEquals(ServiceTicketStatus.REPAIRING,em.find(ServiceTicket.class,ticketId).getStatus());
                assertEquals(f.otherTechnician.getId(),em.createQuery("select a.technician.id from Assignment a where a.serviceTicket.id=:id and a.status=:status",Long.class)
                        .setParameter("id",ticketId).setParameter("status",AssignmentStatus.ACTIVE).getSingleResult());
                return null;
            });
        } finally {
            release.countDown();technicianExecutor.shutdown();transferExecutor.shutdown();
            assertTrue(technicianExecutor.awaitTermination(20,TimeUnit.SECONDS));assertTrue(transferExecutor.awaitTermination(20,TimeUnit.SECONDS));
        }
    }
}
