package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.request.CreateUserRequest;
import com.applecare.apple_repair_service.dto.response.UserResponse;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.*;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.UserRepository;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class UserCreationTest {
    final UserRepository repository=mock(UserRepository.class);
    final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder(4);
    final UserService service=new UserService(repository,mock(DomainAccess.class),
        new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()),new EntityResponses(),encoder);
    CreateUserRequest request(String password) { return new CreateUserRequest("  technician  ",password,"  An  ",null,UserRole.TECHNICIAN); }
    @Test void createsActiveUserWithVerifiedBcryptHashAndSafeResponse() {
        when(repository.saveAndFlush(any())).thenAnswer(i -> {
            User u=i.getArgument(0);u.setId(1L);
            assertNotEquals("Local-Test-123!",u.getPasswordHash());
            assertTrue(encoder.matches("Local-Test-123!",u.getPasswordHash()));
            assertEquals("technician",u.getUsername());assertEquals(UserStatus.ACTIVE,u.getStatus());return u;
        });
        var response=service.create(request("Local-Test-123!"));
        assertEquals("An",response.fullName());assertEquals(UserRole.TECHNICIAN,response.role());
        assertTrue(java.util.Arrays.stream(UserResponse.class.getRecordComponents()).noneMatch(c->c.getName().toLowerCase().contains("password")));
        assertFalse(request("Local-Test-123!").toString().contains("Local-Test-123!"));
    }
    @Test void duplicateUsernameDoesNotWrite() {
        when(repository.existsByUsername("technician")).thenReturn(true);
        assertThrows(DuplicateResourceException.class,()->service.create(request("Local-Test-123!")));
        verify(repository,never()).saveAndFlush(any());
    }
    @Test void bcryptByteLimitIsValidatedBeforeHashing() {
        assertThrows(BusinessRuleViolationException.class,()->service.create(request("é".repeat(40))));
        verify(repository,never()).saveAndFlush(any());
    }
}

