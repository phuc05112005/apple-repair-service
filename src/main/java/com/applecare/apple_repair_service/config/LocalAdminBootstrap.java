package com.applecare.apple_repair_service.config;

import com.applecare.apple_repair_service.dto.request.CreateUserRequest;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.repository.UserRepository;
import com.applecare.apple_repair_service.service.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"local", "docker"})
@ConditionalOnProperty(name="app.bootstrap-admin.enabled", havingValue="true")
public class LocalAdminBootstrap implements ApplicationRunner {
    private final UserService users;
    private final UserRepository repository;
    private final String username;
    private final String password;
    public LocalAdminBootstrap(UserService users, UserRepository repository,
            @Value("${app.bootstrap-admin.username:}") String username,
            @Value("${app.bootstrap-admin.password:}") String password) {
        this.users=users; this.repository=repository; this.username=username; this.password=password;
    }
    @Override
    public void run(ApplicationArguments args) {
        if (username.isBlank()) throw new IllegalStateException("Local bootstrap requires BOOTSTRAP_ADMIN_USERNAME");
        if (repository.existsByUsername(username.trim())) return;
        users.create(new CreateUserRequest(username,password,"Local administrator",null,UserRole.ADMIN));
    }
}
