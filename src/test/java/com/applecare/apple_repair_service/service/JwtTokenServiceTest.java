package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtException;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
class JwtTokenServiceTest {
    static final String KEY="TEST-ONLY-JWT-UNIT-KEY-012345678901234567890123";
    JwtTokenService tokens(Clock clock) { return new JwtTokenService(KEY,Duration.ofMinutes(30),"test-issuer",clock); }
    @Test void signedTokenContainsOnlyIdentityClaimsAndExpires() {
        var service=tokens(TestData.CLOCK);
        var user=TestData.user(1);user.setUsername("technician");user.setPasswordHash("DO-NOT-EXPOSE");
        var token=service.issue(new UserPrincipal(user));
        var decoded=service.decode(token.getTokenValue());
        assertEquals("technician",decoded.getSubject());assertEquals(1L,((Number)decoded.getClaim("userId")).longValue());
        assertEquals("TECHNICIAN",decoded.getClaimAsString("role"));
        assertEquals(TestData.CLOCK.instant().plusSeconds(1800),decoded.getExpiresAt());
        assertFalse(decoded.getClaims().containsKey("password"));assertFalse(decoded.getClaims().containsKey("passwordHash"));
        assertThrows(JwtException.class,()->tokens(Clock.offset(TestData.CLOCK,Duration.ofHours(1))).decode(token.getTokenValue()));
    }
    @Test void rejectsMalformedTamperedAndDifferentSigningKey() {
        var user=TestData.user(1);user.setUsername("technician");
        var token=tokens(TestData.CLOCK).issue(new UserPrincipal(user)).getTokenValue();
        assertThrows(JwtException.class,()->tokens(TestData.CLOCK).decode("not-a-token"));
        var parts=token.split("\\.");
        assertThrows(JwtException.class,()->tokens(TestData.CLOCK).decode(parts[0]+"."+parts[1]+"."+ "A".repeat(parts[2].length())));
        var other=new JwtTokenService(KEY+"different",Duration.ofHours(1),"test-issuer",TestData.CLOCK);
        assertThrows(JwtException.class,()->other.decode(token));
    }
    @Test void refusesMissingOrShortSecret() {
        assertThrows(IllegalStateException.class,()->new JwtTokenService("",Duration.ofHours(1),"test",TestData.CLOCK));
    }
}

