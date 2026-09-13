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
    String login(User user) throws Exception {
        var body=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(user.getUsername(),ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asString();
    }
    @Test void receptionistIntakeWritesJwtActorAndRejectsInvalidTransition() throws Exception {
        var request=new CreateAppointmentRequest(f.prefix,f.prefix,f.slot.getId(),null,
                List.of(new AppointmentDeviceRequest(f.model.getId(),null,List.of(new AppointmentServiceItemRequest(f.catalog.getId(),null)))));
        var booked=mvc.perform(post("/api/v1/appointments").contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id=json.readTree(booked).get("appointmentId").asLong();
        String bearer="Bearer "+login(f.receptionist);
        mvc.perform(get("/api/v1/internal/appointments").header("Authorization",bearer).param("branchId",f.branch.getId().toString())
                .param("status","PENDING_CONFIRMATION")).andExpect(status().isOk()).andExpect(jsonPath("$[0].appointment.id").value(id));
        // A body on this bodyless command cannot override the authenticated actor.
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/confirm").header("Authorization",bearer)
                .contentType("application/json").content("{\"confirmedByUserId\":"+f.technician.getId()+"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.confirmedById").value(f.receptionist.getId()));
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/arrive").header("Authorization",bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appointment.status").value("ARRIVED"));
        long deviceId=em.createQuery("select d.id from AppointmentDevice d where d.appointment.id=:id",Long.class)
                .setParameter("id",id).getSingleResult();
        String result=mvc.perform(post("/api/v1/internal/appointment-devices/"+deviceId+"/intake").header("Authorization",bearer)
                .contentType("application/json").content(json.writeValueAsString(new IntakeDeviceCommand(f.prefix,"128 GB","Received"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.ticket.createdById").value(f.receptionist.getId()))
                .andExpect(jsonPath("$.ticket.status").value("WAITING_ASSIGNMENT")).andReturn().getResponse().getContentAsString();
        long ticketId=json.readTree(result).get("ticket").get("id").asLong();
        em.flush(); assertEquals(f.receptionist.getId(),em.find(ServiceTicket.class,ticketId).getCreatedBy().getId());
        mvc.perform(post("/api/v1/internal/appointments/"+id+"/confirm").header("Authorization",bearer))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATE_TRANSITION"));
    }
    @Test void technicianCannotTakeReceptionistPaymentOrAppointmentCommands() throws Exception {
        String bearer="Bearer "+login(f.technician);
        mvc.perform(post("/api/v1/internal/service-tickets/1/payment").header("Authorization",bearer)
                .contentType("application/json").content("{\"paymentMethod\":\"CASH\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/internal/appointments/1/confirm").header("Authorization",bearer)).andExpect(status().isForbidden());
    }
}

