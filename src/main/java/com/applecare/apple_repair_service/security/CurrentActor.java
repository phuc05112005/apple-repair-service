package com.applecare.apple_repair_service.security;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
@Component
public class CurrentActor {
    public UserPrincipal principal() {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication==null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof UserPrincipal user) || !user.isEnabled())
            throw new InsufficientAuthenticationException("Authentication required");
        return user;
    }
    public Long id() { return principal().id(); }
}

