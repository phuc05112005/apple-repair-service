package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.auth.*;
import com.applecare.apple_repair_service.security.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.stereotype.Service;
@Service
@RequiredArgsConstructor
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final JwtTokenService tokens;
    private final BusinessRules rules;
    public LoginResponse login(LoginRequest request) {
        rules.validate(request);
        if(request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72) throw new BadCredentialsException("Invalid credentials");
        var authentication=authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(request.username().trim(),request.password()));
        var user=(UserPrincipal)authentication.getPrincipal();
        var token=tokens.issue(user);
        return new LoginResponse(token.getTokenValue(),"Bearer",token.getExpiresAt(),user.response());
    }
}

