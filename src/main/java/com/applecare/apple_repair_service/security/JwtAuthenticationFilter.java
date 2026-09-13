package com.applecare.apple_repair_service.security;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService tokens;
    private final DatabaseUserDetailsService users;
    private final ApiSecurityErrors errors;
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        var header=request.getHeader("Authorization");
        if(header!=null) {
            try {
                if(!header.startsWith("Bearer ") || header.length()<=7) throw new BadCredentialsException("Invalid bearer token");
                var jwt=tokens.decode(header.substring(7));
                var user=users.loadUserByUsername(jwt.getSubject());
                if(!user.isEnabled() || user.id().longValue()!=((Number)jwt.getClaim("userId")).longValue()) throw new BadCredentialsException("Invalid bearer token");
                var authentication=UsernamePasswordAuthenticationToken.authenticated(user,null,user.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                var context=SecurityContextHolder.createEmptyContext();context.setAuthentication(authentication);SecurityContextHolder.setContext(context);
            } catch(JwtException | AuthenticationException | IllegalArgumentException ex) {
                SecurityContextHolder.clearContext();errors.commence(request,response,new BadCredentialsException("Invalid bearer token"));return;
            }
        }
        chain.doFilter(request,response);
    }
}

