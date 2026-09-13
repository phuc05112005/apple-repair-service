package com.applecare.apple_repair_service.security;
import com.applecare.apple_repair_service.dto.auth.CurrentUserResponse;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.List;
public final class UserPrincipal implements UserDetails {
    private final Long id;
    private final String username,passwordHash,fullName;
    private final UserRole role;
    private final UserStatus status;
    public UserPrincipal(User user) {
        id=user.getId();username=user.getUsername();passwordHash=user.getPasswordHash();
        fullName=user.getFullName();role=user.getRole();status=user.getStatus();
    }
    public Long id() { return id; }
    public UserRole role() { return role; }
    public CurrentUserResponse response() { return new CurrentUserResponse(id,username,fullName,role,status); }
    @Override public String getUsername() { return username; }
    @Override public String getPassword() { return passwordHash; }
    @Override public boolean isEnabled() { return status==UserStatus.ACTIVE; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return List.of(new SimpleGrantedAuthority("ROLE_"+role.name())); }
    @Override public String toString() { return "UserPrincipal[id="+id+"]"; }
}

