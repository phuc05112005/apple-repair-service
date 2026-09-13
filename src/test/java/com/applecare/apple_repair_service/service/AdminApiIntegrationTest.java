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
import static org.junit.jupiter.api.Assertions.*;
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
}

