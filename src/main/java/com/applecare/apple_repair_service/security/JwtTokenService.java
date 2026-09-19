package com.applecare.apple_repair_service.security;
import com.applecare.apple_repair_service.enums.UserRole;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.util.Base64;
@Service
public class JwtTokenService {
    private final JwtEncoder encoder;
    private final NimbusJwtDecoder decoder;
    private final Clock clock;
    private final Duration expiration;
    private final String issuer;
    public JwtTokenService(@Value("${app.security.jwt.secret}") String secret,
            @Value("${app.security.jwt.expiration:PT1H}") Duration expiration,
            @Value("${app.security.jwt.issuer:apple-repair-service}") String issuer, Clock clock) {
        if(secret.getBytes(StandardCharsets.UTF_8).length<32) throw new IllegalStateException("JWT_SECRET must contain at least 32 UTF-8 bytes");
        if(expiration.isZero() || expiration.isNegative()) throw new IllegalStateException("JWT expiration must be positive");
        this.clock=clock;this.expiration=expiration;this.issuer=issuer;
        var key=new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256");
        encoder=new NimbusJwtEncoder(new ImmutableSecret<>(key));
        decoder=NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        var timestamps=new JwtTimestampValidator(Duration.ZERO);timestamps.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps,new JwtIssuerValidator(issuer),jwt-> {
            try {
                if(jwt.getExpiresAt()==null || jwt.getIssuedAt()==null || jwt.getIssuedAt().isAfter(clock.instant())
                        || jwt.getSubject()==null || jwt.getSubject().isBlank() || !(jwt.getClaim("userId") instanceof Number number) || number.longValue()<=0)
                    return invalid();
                UserRole.valueOf(jwt.getClaimAsString("role"));
                return OAuth2TokenValidatorResult.success();
            } catch(RuntimeException ex) {
                return invalid(); }
        }));
    }
    private static OAuth2TokenValidatorResult invalid() {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token","Invalid token claims",null));
    }
    public Jwt issue(UserPrincipal user) {
        var now=clock.instant();
        var claims=JwtClaimsSet.builder().issuer(issuer).subject(user.getUsername()).issuedAt(now).expiresAt(now.plus(expiration))
                .claim("userId",user.id()).claim("role",user.role().name())
                .claim("credentialTag",credentialTag(user)).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims));
    }
    public String credentialTag(UserPrincipal user) {
        try {
            var digest=MessageDigest.getInstance("SHA-256").digest(user.getPassword().getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable",ex);
        }
    }
    public Jwt decode(String token) { return decoder.decode(token); }
}
