package com.applecare.apple_repair_service.security;
import com.applecare.apple_repair_service.dto.error.ApiErrorResponse;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Clock;
import java.util.List;
@Component
@RequiredArgsConstructor
public class ApiSecurityErrors implements AuthenticationEntryPoint, AccessDeniedHandler {
    private final ObjectMapper json;
    private final Clock clock;
    @Override public void commence(HttpServletRequest request,HttpServletResponse response,AuthenticationException ex) throws IOException {
        response.setHeader("WWW-Authenticate","Bearer");write(request,response,HttpStatus.UNAUTHORIZED,"AUTHENTICATION_FAILED","Authentication required or invalid credentials");
    }
    @Override public void handle(HttpServletRequest request,HttpServletResponse response,AccessDeniedException ex) throws IOException {
        write(request,response,HttpStatus.FORBIDDEN,"ACCESS_DENIED","Access denied");
    }
    private void write(HttpServletRequest request,HttpServletResponse response,HttpStatus status,String code,String message) throws IOException {
        response.setStatus(status.value());response.setContentType("application/json");response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getOutputStream(),new ApiErrorResponse(clock.instant(),status.value(),status.getReasonPhrase(),code,message,request.getRequestURI(),List.of()));
    }
}

