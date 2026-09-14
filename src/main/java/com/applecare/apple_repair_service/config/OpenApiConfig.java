package com.applecare.apple_repair_service.config;

import com.applecare.apple_repair_service.controller.AuthController;
import com.applecare.apple_repair_service.controller.PublicController;
import io.swagger.v3.oas.models.*;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.*;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI repairApi() {
        return new OpenAPI().info(new Info().title("Apple Repair Service API").version("1.0.0")
                .description("XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ HỖ TRỢ KỸ THUẬT TRONG DỊCH VỤ SỬA CHỮA THIẾT BỊ APPLE. "
                        + "Customer APIs use phone lookup; internal staff authenticate with a Bearer JWT. "
                        + "Technician mutations require the current ACTIVE assignment; actor identity comes from authentication."))
                .components(new Components().addSecuritySchemes("bearerAuth",new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }
    @Bean
    public OperationCustomizer operationAccess() {
        return (operation,handler)-> {
            boolean publicOperation=handler.getBeanType()==PublicController.class
                    || (handler.getBeanType()==AuthController.class && handler.getMethod().getName().equals("login"));
            operation.setSecurity(publicOperation?List.of():List.of(new SecurityRequirement().addList("bearerAuth")));
            var rule=AnnotatedElementUtils.findMergedAnnotation(handler.getMethod(),PreAuthorize.class);
            if(rule==null) rule=AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(),PreAuthorize.class);
            String description=publicOperation?"Public API. No customer account required.":
                    rule==null?"Authenticated internal user.":"Required authority: "+rule.value()+".";
            if(handler.getBeanType().getSimpleName().equals("TechnicianController"))
                description+=" Current ACTIVE technician assignment is checked while holding the ticket lock.";
            if(handler.getBeanType().getSimpleName().equals("TransferController"))
                description+=" Request requires the active assignee; accept/reject require the transfer target; cancel requires requester or receptionist.";
            operation.setDescription(description);
            return operation;
        };
    }
    @Bean
    public OpenApiCustomizer credentialSchemas() {
        return api-> {
            if(api.getComponents()==null || api.getComponents().getSchemas()==null) return;
            api.getComponents().getSchemas().values().forEach(schema-> {
                if(schema.getProperties()!=null && schema.getProperties().containsKey("password")) {
                    if(schema.getProperties().get("password") instanceof io.swagger.v3.oas.models.media.Schema<?> password) {
                        password.setWriteOnly(true);password.setFormat("password");
                    }
                }
            });
        };
    }
}
