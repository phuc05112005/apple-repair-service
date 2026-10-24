package com.applecare.apple_repair_service.security;
import com.applecare.apple_repair_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
@RequiredArgsConstructor
public class DatabaseUserDetailsService implements UserDetailsService {
    private final UserRepository users;
    @Override @Transactional(readOnly=true)
    public UserPrincipal loadUserByUsername(String username) {
        return users.findByUsername(username).map(UserPrincipal::new).orElseThrow(()->new UsernameNotFoundException("Invalid credentials"));
    }
}

