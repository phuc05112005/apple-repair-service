package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.command.StockAdjustmentCommand;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@Transactional
class AdminApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    @Autowired PasswordEncoder encoder;
    ApiFixture f;
    String token;
    @BeforeEach void fixture() throws Exception {
        f=new ApiFixture(em,clock); f.create();
        var response=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(f.admin.getUsername(),ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        token=json.readTree(response).get("accessToken").asString();
    }
    @Test void adminCreatesHashedUsersAndDuplicateUsernameIs409() throws Exception {
        var request=new CreateUserRequest(f.prefix+"new",ApiFixture.PASSWORD,"New technician",null,UserRole.TECHNICIAN);
        String body=json.writeValueAsString(request);
        String response=mvc.perform(post("/api/v1/admin/users").header("Authorization","Bearer "+token)
                .contentType("application/json").content(body)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.passwordHash").doesNotExist()).andExpect(jsonPath("$.password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long id=json.readTree(response).get("id").asLong();
        assertTrue(encoder.matches(ApiFixture.PASSWORD,em.find(User.class,id).getPasswordHash()));
        mvc.perform(get("/api/v1/admin/users/"+id).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("TECHNICIAN"));
        mvc.perform(post("/api/v1/admin/users").header("Authorization","Bearer "+token).contentType("application/json").content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
    }
    @Test void adminUpdatesDisablesReactivatesUsersButCannotDisableSelf() throws Exception {
        var request=new CreateUserRequest(f.prefix+"reception-new",ApiFixture.PASSWORD,"New receptionist",null,UserRole.RECEPTIONIST);
        var created=mvc.perform(post("/api/v1/admin/users").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(request))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id=json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/v1/admin/users/"+id+"/profile").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new UpdateUserProfileRequest("Updated receptionist","0900000000"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("Updated receptionist"));
        mvc.perform(put("/api/v1/admin/users/"+id+"/status").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new UpdateUserStatusRequest(UserStatus.INACTIVE))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(request.username(),request.password())))).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/admin/users/"+id+"/status").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new UpdateUserStatusRequest(UserStatus.ACTIVE))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(request.username(),request.password())))).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("RECEPTIONIST"));
        mvc.perform(put("/api/v1/admin/users/"+f.admin.getId()+"/status").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new UpdateUserStatusRequest(UserStatus.INACTIVE))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"));
    }
    @Test void masterCommandsAndStatisticsRequireAdminAndReturnTypedData() throws Exception {
        mvc.perform(post("/api/v1/admin/device-types").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new CreateDeviceTypeRequest(f.deviceType.getName()))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
        mvc.perform(post("/api/v1/admin/device-types/"+f.deviceType.getId()+"/deactivate").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(post("/api/v1/admin/device-types/"+f.deviceType.getId()+"/activate").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get("/api/v1/admin/statistics/overview").header("Authorization","Bearer "+token)
                .param("from",LocalDate.now(clock).toString()).param("to",LocalDate.now(clock).toString()).param("branchId",f.branch.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalTickets").value(0)).andExpect(jsonPath("$.currentStatusCounts").isArray());
        mvc.perform(get("/api/v1/admin/branches/"+Long.MAX_VALUE).header("Authorization","Bearer "+token))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }
    @Test void stockCommandsUseAuthenticatedActorRejectSpoofingAndReportInsufficientStock() throws Exception {
        var part=new Part();part.setPartCode(f.prefix);part.setName(f.prefix);part.setSalePrice(BigDecimal.TEN);em.persist(part);em.flush();
        var command=new StockAdjustmentCommand(f.branch.getId(),part.getId(),2,"fixture");
        String body=json.writeValueAsString(command);
        String spoof=body.substring(0,body.length()-1)+",\"recordedByUserId\":"+f.technician.getId()+"}";
        mvc.perform(post("/api/v1/admin/inventory/stock-in").header("Authorization","Bearer "+token)
                .contentType("application/json").content(spoof)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/admin/inventory/stock-in").header("Authorization","Bearer "+token)
                .contentType("application/json").content(body)).andExpect(status().isOk()).andExpect(jsonPath("$.quantity").value(2));
        em.flush();
        var movement=em.createQuery("select t from InventoryTransaction t where t.part.id=:id",InventoryTransaction.class)
                .setParameter("id",part.getId()).getSingleResult();
        assertEquals(f.admin.getId(),movement.getRecordedBy().getId());
        mvc.perform(post("/api/v1/admin/inventory/stock-out").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(new StockAdjustmentCommand(f.branch.getId(),part.getId(),3,null))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INSUFFICIENT_STOCK"));
    }

    @Test void adminPhysicallyDeletesEverySupportedUnreferencedRecord() throws Exception {
        var branch = new Branch(); branch.setName(f.prefix+"-delete-branch"); branch.setAddress("Delete test"); em.persist(branch);
        var deviceType = new DeviceType(); deviceType.setName(f.prefix+"-delete-type"); em.persist(deviceType);
        var model = new DeviceModel(); model.setName(f.prefix+"-delete-model"); model.setDeviceType(f.deviceType); em.persist(model);
        var issue = new ServiceIssue(); issue.setName(f.prefix+"-delete-issue"); em.persist(issue);
        var serviceType = unreferencedServiceType();
        var catalog = new ServiceCatalogItem(); catalog.setName(f.prefix+"-delete-catalog"); catalog.setDeviceModel(f.model);
        catalog.setServiceType(f.serviceType); catalog.setServiceIssue(f.issue); catalog.setConfiguredPrice(BigDecimal.ONE);
        catalog.setStandardDurationMinutes(10); catalog.setWarrantyDays(0); em.persist(catalog);
        var part = new Part(); part.setPartCode(f.prefix+"-delete-part"); part.setName("Delete part");
        part.setSalePrice(BigDecimal.ONE); em.persist(part);
        var slot = new AppointmentSlot(); slot.setBranch(f.branch); slot.setAppointmentDate(LocalDate.now(clock).plusDays(20));
        slot.setStartTime(LocalTime.of(13,0)); slot.setEndTime(LocalTime.of(14,0)); em.persist(slot);
        var schedule = new TechnicianSchedule(); schedule.setTechnician(f.technician); schedule.setBranch(f.branch);
        schedule.setWorkDate(LocalDate.now(clock).plusDays(20)); schedule.setStartTime(LocalTime.of(14,0));
        schedule.setEndTime(LocalTime.of(15,0)); em.persist(schedule);
        em.flush();

        deleteAndAssertGone("/api/v1/admin/branches/", Branch.class, branch.getId(), true);
        deleteAndAssertGone("/api/v1/admin/device-types/", DeviceType.class, deviceType.getId(), true);
        deleteAndAssertGone("/api/v1/admin/device-models/", DeviceModel.class, model.getId(), true);
        deleteAndAssertGone("/api/v1/admin/service-issues/", ServiceIssue.class, issue.getId(), true);
        deleteAndAssertGone("/api/v1/admin/service-types/", ServiceType.class, serviceType.getId(), true);
        deleteAndAssertGone("/api/v1/admin/service-catalog-items/", ServiceCatalogItem.class, catalog.getId(), true);
        deleteAndAssertGone("/api/v1/admin/parts/", Part.class, part.getId(), true);
        deleteAndAssertGone("/api/v1/admin/appointment-slots/", AppointmentSlot.class, slot.getId(), true);
        deleteAndAssertGone("/api/v1/admin/technician-schedules/", TechnicianSchedule.class, schedule.getId(), false);
    }

    @Test void referencedAdminDataIsBlockedAndBusinessHistoryRemains() throws Exception {
        var part = new Part(); part.setPartCode(f.prefix+"-used-part"); part.setName("Used part");
        part.setSalePrice(BigDecimal.TEN); em.persist(part); f.catalog.setPart(part);
        var appointment = new Appointment();
        var customer = new Customer(); customer.setFullName("Reference customer"); customer.setPhone(f.prefix+"phone"); em.persist(customer);
        appointment.setCustomer(customer); appointment.setAppointmentSlot(f.slot); appointment.setBookedAt(java.time.LocalDateTime.now(clock));
        em.persist(appointment);
        var ticket = f.ticket(ServiceTicketStatus.REPAIRING);
        var repairItem = f.item(ticket);
        em.flush();

        var referenced = List.of(
                "/api/v1/admin/branches/"+f.branch.getId(),
                "/api/v1/admin/device-types/"+f.deviceType.getId(),
                "/api/v1/admin/device-models/"+f.model.getId(),
                "/api/v1/admin/service-issues/"+f.issue.getId(),
                "/api/v1/admin/service-types/"+f.serviceType.getId(),
                "/api/v1/admin/service-catalog-items/"+f.catalog.getId(),
                "/api/v1/admin/parts/"+part.getId(),
                "/api/v1/admin/appointment-slots/"+f.slot.getId());
        for (String url : referenced) {
            mvc.perform(delete(url).header("Authorization","Bearer "+token))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"))
                    .andExpect(jsonPath("$.message").value(containsString("đang được sử dụng")));
        }

        assertNotNull(em.find(Appointment.class, appointment.getId()));
        assertNotNull(em.find(ServiceTicket.class, ticket.getId()));
        assertNotNull(em.find(RepairItem.class, repairItem.getId()));
        assertNotNull(em.find(Part.class, part.getId()));
        assertNotNull(em.find(ServiceCatalogItem.class, f.catalog.getId()));
    }

    @Test void nonAdminCannotCallAnyPhysicalDeleteEndpoint() throws Exception {
        String receptionistToken = login(f.receptionist);
        var urls = List.of(
                "/api/v1/admin/branches/"+f.branch.getId(),
                "/api/v1/admin/device-types/"+f.deviceType.getId(),
                "/api/v1/admin/device-models/"+f.model.getId(),
                "/api/v1/admin/service-issues/"+f.issue.getId(),
                "/api/v1/admin/service-types/"+f.serviceType.getId(),
                "/api/v1/admin/service-catalog-items/"+f.catalog.getId(),
                "/api/v1/admin/parts/"+f.catalog.getId(),
                "/api/v1/admin/appointment-slots/"+f.slot.getId(),
                "/api/v1/admin/technician-schedules/"+f.slot.getId());
        for (String url : urls) {
            mvc.perform(delete(url).header("Authorization","Bearer "+receptionistToken)).andExpect(status().isForbidden());
        }
    }

    @Test void deletingMissingAdminDataReturns404() throws Exception {
        for (String resource : List.of("branches", "device-types", "device-models", "service-issues", "service-types",
                "service-catalog-items", "parts", "appointment-slots", "technician-schedules")) {
            mvc.perform(delete("/api/v1/admin/"+resource+"/"+Long.MAX_VALUE).header("Authorization","Bearer "+token))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        }
    }

    private String login(User user) throws Exception {
        String response = mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                        .content(json.writeValueAsString(new LoginRequest(user.getUsername(), ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("accessToken").asString();
    }

    private <T> void deleteAndAssertGone(String baseUrl, Class<T> type, Long id, boolean hasGetEndpoint) throws Exception {
        mvc.perform(delete(baseUrl+id).header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        em.flush();
        em.clear();
        assertNull(em.find(type, id));
        if (hasGetEndpoint) {
            mvc.perform(get(baseUrl+id).header("Authorization","Bearer "+token))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        }
    }

    private ServiceType unreferencedServiceType() {
        Set<ServiceTypeCode> existingCodes = em.createQuery("select s.code from ServiceType s", ServiceTypeCode.class)
                .getResultStream().collect(Collectors.toSet());
        var unusedCode = Arrays.stream(ServiceTypeCode.values()).filter(code -> !existingCodes.contains(code)).findFirst();
        if (unusedCode.isPresent()) {
            var type = new ServiceType(); type.setCode(unusedCode.get()); type.setName(f.prefix+"-delete-service-type");
            em.persist(type); return type;
        }
        return em.createQuery("select s from ServiceType s where s.id <> :fixtureId and not exists " +
                        "(select c.id from ServiceCatalogItem c where c.serviceType = s)", ServiceType.class)
                .setParameter("fixtureId", f.serviceType.getId()).setMaxResults(1).getResultStream().findFirst()
                .orElseThrow(() -> new AssertionError("Test database has no unreferenced service type available"));
    }
}
