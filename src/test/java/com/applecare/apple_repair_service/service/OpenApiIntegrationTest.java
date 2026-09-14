package com.applecare.apple_repair_service.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import tools.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class OpenApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mappings;

    @Test void swaggerDescribesBearerAndEveryBusinessEndpointHasExplicitAccess() throws Exception {
        var body=mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Apple Repair Service API"))
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andReturn().getResponse().getContentAsString();
        var docs=json.readTree(body);
        assertTrue(docs.get("paths").get("/api/v1/auth/login").get("post").get("security").isEmpty());
        assertTrue(docs.get("paths").get("/api/v1/admin/users").get("get").get("security").get(0).has("bearerAuth"));
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("swagger-ui")));
        mvc.perform(get("/swagger-ui/swagger-ui-bundle.js")).andExpect(status().isOk());
        mvc.perform(get("/v3/api-docs/swagger-config")).andExpect(status().isOk()).andExpect(jsonPath("$.url").value("/v3/api-docs"));
        var inventory=new ArrayList<Endpoint>();
        mappings.getHandlerMethods().forEach((mapping,handler)-> {
            if(!handler.getBeanType().getPackageName().equals("com.applecare.apple_repair_service.controller")) return;
            var rule=AnnotatedElementUtils.findMergedAnnotation(handler.getMethod(),PreAuthorize.class);
            if(rule==null) rule=AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(),PreAuthorize.class);
            String access=rule==null?"authenticated":rule.value();
            if(handler.getBeanType().getSimpleName().equals("PublicController")
                    || (handler.getBeanType().getSimpleName().equals("AuthController") && handler.getMethod().getName().equals("login"))) access="public";
            if(!handler.getBeanType().getSimpleName().equals("PublicController") && !handler.getBeanType().getSimpleName().equals("AuthController"))
                assertNotNull(rule,"Missing explicit role: "+handler);
            String request="none";
            for(var parameter:handler.getMethodParameters()) {
                if(parameter.hasParameterAnnotation(RequestBody.class)) {
                    request=parameter.getParameterType().getSimpleName();
                    assertFalse(parameter.getParameterType().getPackageName().contains(".entity"));
                    for(var field:parameter.getParameterType().getDeclaredFields())
                        assertFalse(field.getName().matches(".*(ByUserId|actorId|createdBy|confirmedBy|assignedBy|changedBy|inspectedBy|handedOverBy|recordedBy|requestedBy|respondedBy)$"),
                                "HTTP actor field: "+request+"."+field.getName());
                }
            }
            for(var path:mapping.getPatternValues()) for(var method:mapping.getMethodsCondition().getMethods()) {
                assertNotNull(docs.get("paths").get(path),"Endpoint missing from OpenAPI: "+path);
                assertNotNull(docs.get("paths").get(path).get(method.name().toLowerCase(Locale.ROOT)));
                inventory.add(new Endpoint(method.name(),path,handler.getBeanType().getSimpleName(),handler.getMethod().getName(),
                        access,request,handler.getMethod().getGenericReturnType().getTypeName()));
            }
        });
        inventory.sort(Comparator.comparing(Endpoint::path).thenComparing(Endpoint::method));
        assertFalse(inventory.isEmpty());
        Files.writeString(Path.of("docs/api-security/endpoint-inventory.json"),json.writerWithDefaultPrettyPrinter().writeValueAsString(inventory));
        Files.writeString(Path.of("docs/api-security/openapi.json"),body);
    }
    record Endpoint(String method,String path,String controller,String handler,String access,String request,String response) {}
}

