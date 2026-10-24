package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.command.IntakeDeviceCommand;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@Transactional
class ReceptionistApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    ApiFixture f;
    @BeforeEach void fixture() { f=new ApiFixture(em,clock);f.create(); }
    void openArrivalWindow() {
        var now = LocalDateTime.now(clock);
        f.slot.setAppointmentDate(now.toLocalDate());
        f.slot.setStartTime(java.time.LocalTime.MIN);
        f.slot.setEndTime(java.time.LocalTime.of(23, 59, 59));
        em.flush();
    }
    String login(User user) throws Exception {
        var body=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(user.getUsername(),ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asString();
    }
    @Test void receptionistIntakeWritesJwtActorAndRejectsInvalidTransition() throws Exception {
        String contactName = f.prefix + " Customer";
        String contactPhone = f.prefix + "-phone";
        var request=new CreateAppointmentRequest(contactName,contactPhone,f.slot.getId(),null,
                List.of(new AppointmentDeviceRequest(f.model.getId(),null,List.of(new AppointmentServiceItemRequest(f.catalog.getId(),null)))));
        var booked=mvc.perform(post("/api/v1/appointments").contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(booked).get("appointmentId").asLong();
        openArrivalWindow();
        em.flush();
        em.clear();
        var persistedCustomer = em.find(Appointment.class, id).getCustomer();
        assertEquals(contactName, persistedCustomer.getFullName());
        assertEquals(contactPhone, persistedCustomer.getPhone());
        String bearer="Bearer "+login(f.receptionist);
        mvc.perform(get("/api/v1/internal/appointments").header("Authorization",bearer).param("branchId",f.branch.getId().toString())
                .param("status","PENDING_CONFIRMATION")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].appointment.id").value(id))
                .andExpect(jsonPath("$[0].appointment.customerFullName").value(contactName))
                .andExpect(jsonPath("$[0].appointment.customerPhone").value(contactPhone));
        mvc.perform(get("/api/v1/internal/appointments/"+id).header("Authorization",bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointment.customerFullName").value(contactName))
                .andExpect(jsonPath("$.appointment.customerPhone").value(contactPhone));
        // A body on this bodyless command cannot override the authenticated actor.
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/confirm").header("Authorization",bearer)
                .contentType("application/json").content("{\"confirmedByUserId\":"+f.technician.getId()+"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.confirmedById").value(f.receptionist.getId()));
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/arrive").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("ARRIVED"));
        long deviceId=em.createQuery("select d.id from AppointmentDevice d where d.appointment.id=:id",Long.class)
                .setParameter("id",id).getSingleResult();
        String result=mvc.perform(post("/api/v1/internal/appointment-devices/"+deviceId+"/intake").header("Authorization",bearer)
                .contentType("application/json").content(json.writeValueAsString(new IntakeDeviceCommand(f.prefix,"128 GB",null))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.ticket.createdById").value(f.receptionist.getId()))
                .andExpect(jsonPath("$.ticket.status").value("WAITING_ASSIGNMENT")).andReturn().getResponse().getContentAsString();
        long ticketId=json.readTree(result).get("ticket").get("id").asLong();
        em.flush(); assertEquals(f.receptionist.getId(),em.find(ServiceTicket.class,ticketId).getCreatedBy().getId());
        assertNull(em.find(ServiceTicket.class,ticketId).getReceivedCondition());
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/confirm").header("Authorization",bearer))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }
    @Test void technicianCannotTakeReceptionistPaymentOrAppointmentCommands() throws Exception {
        String bearer="Bearer "+login(f.technician);
        mvc.perform(get("/api/v1/internal/appointments/ready-for-intake").header("Authorization",bearer))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/internal/service-tickets/1/payment").header("Authorization",bearer)
                .contentType("application/json").content("{\"paymentMethod\":\"CASH\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/internal/appointments/1/confirm").header("Authorization",bearer)).andExpect(status().isForbidden());
    }

    @Test void walkInCanBeCreatedWithoutReceivedConditionInRequestBody() throws Exception {
        String bearer = "Bearer " + login(f.receptionist);
        var request = new WalkInIntakeRequest(f.prefix + " no-condition", f.prefix + "empty-condition",
                f.branch.getId(), f.model.getId(), null, null, List.of(f.catalog.getId()), "Không lên nguồn", null);
        var body = mvc.perform(post("/api/v1/internal/service-tickets/walk-in").header("Authorization", bearer)
                        .contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.ticket.id").exists())
                .andReturn().getResponse().getContentAsString();
        long ticketId = json.readTree(body).get("ticket").get("id").asLong();
        assertNull(em.find(ServiceTicket.class, ticketId).getReceivedCondition());
    }

    @Test void checkInReturnsClearEarlyAndExpiredErrorsAtServerTime() throws Exception {
        var request = new CreateAppointmentRequest(f.prefix + " customer", f.prefix + " arrival-phone", f.slot.getId(), null,
                List.of(new AppointmentDeviceRequest(f.model.getId(), null,
                        List.of(new AppointmentServiceItemRequest(f.catalog.getId(), null)))));
        var booking = mvc.perform(post("/api/v1/appointments").contentType("application/json")
                        .content(json.writeValueAsString(request))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long appointmentId = json.readTree(booking).get("appointmentId").asLong();
        String bearer = "Bearer " + login(f.receptionist);
        String base = "/api/v1/internal/appointments/" + appointmentId;
        mvc.perform(post(base + "/confirm").header("Authorization", bearer)).andExpect(status().isOk());
        mvc.perform(post(base + "/arrive").header("Authorization", bearer))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPOINTMENT_TOO_EARLY"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Chưa đến khung giờ")));

        var now = LocalDateTime.now(clock);
        f.slot.setAppointmentDate(now.toLocalDate());
        f.slot.setStartTime(now.toLocalTime().minusHours(2));
        f.slot.setEndTime(now.toLocalTime().minusHours(1));
        em.flush();
        mvc.perform(post(base + "/arrive").header("Authorization", bearer))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPOINTMENT_EXPIRED"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("không còn đủ điều kiện hưởng ưu đãi")));
        mvc.perform(get(base).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.appointment.status").value("EXPIRED"))
                .andExpect(jsonPath("$.appointment.arrivedAt").doesNotExist());
    }

    @Test void arrivedBookingCanChangeRepairToReplacementAndKeepOnlineDiscount() throws Exception {
        var replacementType = new ServiceType();
        replacementType.setCode(ServiceTypeCode.REPLACEMENT); replacementType.setName(f.prefix + "replacement type");
        em.persist(replacementType);
        var part = new Part(); part.setName(f.prefix + "part"); part.setPartCode(f.prefix + "part");
        part.setSalePrice(new BigDecimal("200.00")); em.persist(part);
        var replacement = new ServiceCatalogItem();
        replacement.setName(f.prefix + " replacement");
        replacement.setDeviceModel(f.model);
        replacement.setServiceIssue(f.issue);
        replacement.setServiceType(replacementType);
        replacement.setPart(part);
        replacement.setConfiguredPrice(new BigDecimal("200.00"));
        replacement.setStandardDurationMinutes(45);
        replacement.setWarrantyDays(30);
        replacement.setWarrantyRemedy(WarrantyRemedy.REPAIR);
        em.persist(replacement);
        em.flush();

        var request = new CreateAppointmentRequest(f.prefix + " customer", f.prefix + " phone", f.slot.getId(), null,
                List.of(new AppointmentDeviceRequest(f.model.getId(), null,
                        List.of(new AppointmentServiceItemRequest(f.catalog.getId(), null)))));
        var booking = mvc.perform(post("/api/v1/appointments").contentType("application/json")
                .content(json.writeValueAsString(request))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long appointmentId = json.readTree(booking).get("appointmentId").asLong();
        openArrivalWindow();
        String bearer = "Bearer " + login(f.receptionist);
        String base = "/api/v1/internal/appointments/" + appointmentId;
        mvc.perform(post(base + "/confirm").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("CONFIRMED"));
        mvc.perform(post(base + "/confirm").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("CONFIRMED"));
        mvc.perform(post(base + "/arrive").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("ARRIVED"));
        mvc.perform(post(base + "/arrive").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("ARRIVED"));
        long deviceId = em.createQuery("select d.id from AppointmentDevice d where d.appointment.id=:id", Long.class)
                .setParameter("id", appointmentId).getSingleResult();
        mvc.perform(get("/api/v1/internal/appointments/ready-for-intake").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.appointment.id == " + appointmentId + ")].devices[0].device.id")
                        .value(org.hamcrest.Matchers.hasItem((int) deviceId)));

        var command = new IntakeDeviceCommand(f.prefix, "128 GB", "Received", List.of(replacement.getId()));
        var response = mvc.perform(post("/api/v1/internal/appointment-devices/" + deviceId + "/intake")
                .header("Authorization", bearer).contentType("application/json")
                .content(json.writeValueAsString(command)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticket.discountPercent").value(10))
                .andExpect(jsonPath("$.repairItems[0].serviceCatalogItemId").value(replacement.getId()))
                .andExpect(jsonPath("$.repairItems[0].basePrice").value(200))
                .andExpect(jsonPath("$.repairItems[0].finalPrice").value(180))
                .andReturn().getResponse().getContentAsString();
        long ticketId = json.readTree(response).get("ticket").get("id").asLong();
        em.flush();
        em.clear();
        assertEquals(new BigDecimal("10.00"), em.find(ServiceTicket.class, ticketId).getDiscountPercent());
        assertEquals(1, em.createQuery("select r from RepairItem r where r.serviceTicket.id=:id", RepairItem.class)
                .setParameter("id", ticketId).getResultList().size());
        mvc.perform(get("/api/v1/internal/appointments/ready-for-intake").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.appointment.id == " + appointmentId + ")]").isEmpty());
    }

    @Test void walkInReplacementUsesPartPriceWhenServicePriceIsNotConfigured() throws Exception {
        var existingTypes = em.createQuery("select s from ServiceType s where s.code=:code", ServiceType.class)
                .setParameter("code", ServiceTypeCode.REPLACEMENT).getResultList();
        ServiceType replacementType;
        if (existingTypes.isEmpty()) {
            replacementType = new ServiceType();
            replacementType.setCode(ServiceTypeCode.REPLACEMENT);
            replacementType.setName(f.prefix + " replacement");
            em.persist(replacementType);
        } else replacementType = existingTypes.getFirst();
        var part = new Part();
        part.setPartCode(f.prefix + "-battery");
        part.setName("Battery");
        part.setBrand("Example brand");
        part.setVariant("High capacity");
        part.setSalePrice(new BigDecimal("750000.00"));
        em.persist(part);
        var replacement = new ServiceCatalogItem();
        replacement.setName(f.prefix + " battery replacement");
        replacement.setDeviceModel(f.model);
        replacement.setServiceIssue(f.issue);
        replacement.setServiceType(replacementType);
        replacement.setPart(part);
        replacement.setPart(part);
        replacement.setStandardDurationMinutes(45);
        replacement.setWarrantyDays(0);
        em.persist(replacement);
        em.flush();

        var request = new WalkInIntakeRequest(f.prefix + " customer", f.prefix + " phone", f.branch.getId(),
                f.model.getId(), null, null, "Device received", List.of(replacement.getId()));
        String bearer = "Bearer " + login(f.receptionist);
        var response = mvc.perform(post("/api/v1/internal/service-tickets/walk-in").header("Authorization", bearer)
                .contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.repairItems[0].serviceCatalogItemId").value(replacement.getId()))
                .andExpect(jsonPath("$.repairItems[0].basePrice").value(750000))
                .andExpect(jsonPath("$.repairItems[0].finalPrice").value(750000))
                .andReturn().getResponse().getContentAsString();
        long itemId = json.readTree(response).get("repairItems").get(0).get("id").asLong();
        assertTrue(json.readTree(response).get("ticket").get("ticketCode").asString()
                .matches("ST-\\d{8}-[0-9A-F]{12}"));
        assertNotNull(json.readTree(response).get("ticket").get("receivedAt"));
        assertNotNull(json.readTree(response).get("history").get(0).get("changedAt"));
        em.flush();
        em.clear();
        assertEquals(new BigDecimal("750000.00"), em.find(RepairItem.class, itemId).getFinalPrice());
    }
}
