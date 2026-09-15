package com.applecare.apple_repair_service.config;
import com.applecare.apple_repair_service.security.*;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import java.util.*;
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean public AuthenticationManager authenticationManager(DatabaseUserDetailsService users, PasswordEncoder encoder) {
        var provider=new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
    @Bean public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        var registration=new FilterRegistrationBean<>(filter);registration.setEnabled(false);return registration;
    }
    @Bean public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwt, ApiSecurityErrors errors,
            @Value("${app.security.public-docs:false}") boolean publicDocs) throws Exception {
        http.sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(c->c.disable()).formLogin(f->f.disable()).httpBasic(b->b.disable())
            .requestCache(c->c.disable()).cors(org.springframework.security.config.Customizer.withDefaults())
            .exceptionHandling(e->e.authenticationEntryPoint(errors).accessDeniedHandler(errors))
            .authorizeHttpRequests(a->{
                a.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll();
                if(publicDocs) a.requestMatchers("/v3/api-docs/**","/swagger-ui/**","/swagger-ui.html").permitAll();
                a.requestMatchers(HttpMethod.POST,"/api/v1/auth/login","/api/v1/appointments","/api/v1/service-tickets/*/feedback").permitAll()
                    .requestMatchers(HttpMethod.GET,"/api/v1/device-types","/api/v1/device-models","/api/v1/service-issues",
                        "/api/v1/service-catalog-items","/api/v1/branches","/api/v1/appointment-slots",
                        "/api/v1/appointments/lookup","/api/v1/service-tickets/lookup","/api/v1/warranties/eligibility").permitAll()
                    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                    .anyRequest().authenticated();
            }).addFilterBefore(jwt,UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
    @Bean public CorsConfigurationSource corsConfigurationSource(@Value("${app.security.allowed-origins:}") String origins) {
        var allowed=Arrays.stream(origins.split(",")).map(String::trim).filter(s->!s.isEmpty()).toList();
        if(allowed.stream().anyMatch(s->s.contains("*"))) throw new IllegalStateException("CORS requires explicit origins");
        var config=new CorsConfiguration();config.setAllowedOrigins(allowed);
        config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));config.setAllowedHeaders(List.of("Authorization","Content-Type"));
        config.setAllowCredentials(false);config.setMaxAge(3600L);
        var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",config);return source;
    }
}
