package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.security.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@Transactional
class SecurityIntegrationTest {
    private static final String PASSWORD="Api-Test-Password-123!";
    private static final String HASH=new BCryptPasswordEncoder(4).encode(PASSWORD);
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired EntityManager em;
    @Autowired Clock clock;
    @Value("${app.security.jwt.secret}") String secret;
    User admin,receptionist,technician,inactive;
    @BeforeEach void fixture() {
        var prefix="APITEST"+UUID.randomUUID().toString().replace("-","");
        admin=user(prefix+"admin",UserRole.ADMIN,UserStatus.ACTIVE);
        receptionist=user(prefix+"reception",UserRole.RECEPTIONIST,UserStatus.ACTIVE);
        technician=user(prefix+"tech",UserRole.TECHNICIAN,UserStatus.ACTIVE);
        inactive=user(prefix+"inactive",UserRole.ADMIN,UserStatus.INACTIVE);
        em.flush();
    }
    User user(String username,UserRole role,UserStatus status) {
        var user=new User();user.setUsername(username);user.setPasswordHash(HASH);user.setFullName("API fixture");
        user.setRole(role);user.setStatus(status);em.persist(user);return user;
    }
    String login(User user) throws Exception {
        var body=mvc.perform(post("/api/v1/auth/login").contentType(APPLICATION_JSON)
                .content(json.writeValueAsString(new LoginRequest(user.getUsername(),PASSWORD))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.user.id").value(user.getId()))
            .andExpect(jsonPath("$.user.passwordHash").doesNotExist()).andExpect(jsonPath("$.user.password").doesNotExist())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asString();
    }
    @Test void loginAndMeUseDatabaseIdentityWithoutPasswordFieldsOrSession() throws Exception {
        var token=login(admin);
        var result=mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(admin.getId()))
            .andExpect(jsonPath("$.role").value("ADMIN")).andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn();
        assertNull(result.getRequest().getSession(false));
    }
    @Test void invalidPasswordUnknownUsernameAndInactiveAccountReturnSame401() throws Exception {
        for(var request:java.util.List.of(new LoginRequest(admin.getUsername(),"Wrong-Password-123!"),
                new LoginRequest("APITEST-unknown-"+UUID.randomUUID(),PASSWORD),new LoginRequest(inactive.getUsername(),PASSWORD))) {
            mvc.perform(post("/api/v1/auth/login").contentType(APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"))
                .andExpect(jsonPath("$.status").value(401));
        }
    }
    @Test void missingMalformedAndExpiredTokensAre401() throws Exception {
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer broken")).andExpect(status().isUnauthorized());
        var past=Clock.offset(clock,Duration.ofHours(-2));
        var expired=new JwtTokenService(secret,Duration.ofMinutes(1),"apple-repair-service",past).issue(new UserPrincipal(admin));
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+expired.getTokenValue())).andExpect(status().isUnauthorized());
    }
    @Test void roleAndAccountChangesImmediatelyAffectExistingToken() throws Exception {
        var token=login(admin);
        admin.setRole(UserRole.RECEPTIONIST);em.flush();
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+token)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        admin.setStatus(UserStatus.INACTIVE);em.flush();
        mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
    }
    @Test void receptionistCannotManageUsers() throws Exception {
        mvc.perform(get("/api/v1/admin/users").header("Authorization","Bearer "+login(receptionist))).andExpect(status().isForbidden());
    }
    @Test void authenticationJsonValidationIsConsistentAndDoesNotEchoSecrets() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(APPLICATION_JSON).content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_JSON"));
        var response=mvc.perform(post("/api/v1/auth/login").contentType(APPLICATION_JSON).content("{\"username\":\"\",\"password\":\"\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.fieldErrors").isArray()).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("rejectedValue"));assertFalse(response.contains("stackTrace"));
    }
}

