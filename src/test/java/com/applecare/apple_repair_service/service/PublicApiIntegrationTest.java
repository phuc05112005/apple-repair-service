package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.publicapi.PublicFeedbackRequest;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class PublicApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    ApiFixture f;
    @BeforeEach void fixture() { f = new ApiFixture(em,clock); f.create(); }

    @Test void catalogIsAnonymousFilteredAndOmitsInternalData() throws Exception {
        var part = new com.applecare.apple_repair_service.entity.Part();
        part.setPartCode(f.prefix + "PART"); part.setName("Replacement battery");
        part.setBrand("Apple"); part.setVariant("Original");
        part.setSalePrice(new java.math.BigDecimal("125.00")); em.persist(part);
        f.catalog.setPart(part); f.catalog.setConfiguredPrice(null); em.flush();
        mvc.perform(get("/api/v1/service-catalog-items").param("deviceModelId",f.model.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(f.catalog.getId()))
                .andExpect(jsonPath("$[0].serviceTypeCode").value("REPAIR"))
                .andExpect(jsonPath("$[0].serviceTypeName").value(f.serviceType.getName()))
                .andExpect(jsonPath("$[0].partId").value(part.getId()))
                .andExpect(jsonPath("$[0].partBrand").value("Apple"))
                .andExpect(jsonPath("$[0].partVariant").value("Original"))
                .andExpect(jsonPath("$[0].displayPrice").value(125))
                .andExpect(jsonPath("$[0].createdAt").doesNotExist());
        mvc.perform(get("/api/v1/service-catalog-items").param("deviceModelId",f.model.getId().toString())
                .param("serviceIssueId",Long.toString(Long.MAX_VALUE))).andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(0)));
        f.deviceType.setStatus(ActiveStatus.INACTIVE); em.flush();
        mvc.perform(get("/api/v1/device-models").param("deviceTypeId",f.deviceType.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(0)));
        mvc.perform(get("/api/v1/service-catalog-items").param("deviceModelId",f.model.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(0)));
    }

    @Test void catalogExposesConfiguredRepairReplacementAndInspectionOptions() throws Exception {
        var replacementType = serviceType(ServiceTypeCode.REPLACEMENT, "Thay thế linh kiện");
        var inspectionType = serviceType(ServiceTypeCode.INSPECTION, "Kiểm tra / Tư vấn");
        var part = new com.applecare.apple_repair_service.entity.Part();
        part.setPartCode(f.prefix + "-BATTERY"); part.setName("Pin kiểm thử");
        part.setBrand("Pisen"); part.setVariant("Dung lượng cao");
        part.setSalePrice(new java.math.BigDecimal("1790000.00")); em.persist(part);
        var replacement = catalog(replacementType, part, "Thay pin", null, 60, 180);
        var inspection = catalog(inspectionType, null, "Kiểm tra pin", java.math.BigDecimal.ZERO, 30, 0);
        em.flush();

        mvc.perform(get("/api/v1/service-catalog-items")
                        .param("deviceModelId",f.model.getId().toString())
                        .param("serviceIssueId",f.issue.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(3)))
                .andExpect(jsonPath("$[*].serviceTypeCode", containsInAnyOrder("REPAIR","REPLACEMENT","INSPECTION")))
                .andExpect(jsonPath("$[?(@.id == "+replacement.getId()+")].partBrand").value("Pisen"))
                .andExpect(jsonPath("$[?(@.id == "+replacement.getId()+")].partVariant").value("Dung lượng cao"))
                .andExpect(jsonPath("$[?(@.id == "+replacement.getId()+")].displayPrice").value(1790000.0))
                .andExpect(jsonPath("$[?(@.id == "+inspection.getId()+")].standardDurationMinutes").value(30));
    }

    private com.applecare.apple_repair_service.entity.ServiceType serviceType(ServiceTypeCode code, String name) {
        return em.createQuery("select s from ServiceType s where s.code=:code", com.applecare.apple_repair_service.entity.ServiceType.class)
                .setParameter("code",code).getResultStream().findFirst().orElseGet(() -> {
                    var value = new com.applecare.apple_repair_service.entity.ServiceType();
                    value.setCode(code); value.setName(f.prefix + name); em.persist(value); return value;
                });
    }

    private com.applecare.apple_repair_service.entity.ServiceCatalogItem catalog(
            com.applecare.apple_repair_service.entity.ServiceType type,
            com.applecare.apple_repair_service.entity.Part part, String name,
            java.math.BigDecimal price, int minutes, int warrantyDays) {
        var value = new com.applecare.apple_repair_service.entity.ServiceCatalogItem();
        value.setDeviceModel(f.model); value.setServiceIssue(f.issue); value.setServiceType(type); value.setPart(part);
        value.setName(f.prefix + name); value.setConfiguredPrice(price);
        value.setStandardDurationMinutes(minutes); value.setWarrantyDays(warrantyDays); em.persist(value); return value;
    }

    @Test void anonymousBookingAndLookupUsePublicDtoAndClosedSlotsDisappear() throws Exception {
        mvc.perform(get("/api/v1/appointment-slots").param("branchId",f.branch.getId().toString())
                .param("date",f.slot.getAppointmentDate().toString())).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].activeBookingCount").value(0));
        var request = new CreateAppointmentRequest(f.prefix,f.prefix,f.slot.getId(),"PRIVATE BOOKING NOTE",
                List.of(new AppointmentDeviceRequest(f.model.getId(),"symptom",
                        List.of(new AppointmentServiceItemRequest(f.catalog.getId(),null)))));
        mvc.perform(post("/api/v1/appointments").contentType("application/json").content(json.writeValueAsString(request)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING_CONFIRMATION"))
                .andExpect(jsonPath("$.devices[0].deviceModelName").value(f.model.getName()))
                .andExpect(jsonPath("$.confirmedById").doesNotExist()).andExpect(jsonPath("$.note").doesNotExist());
        mvc.perform(get("/api/v1/appointments/lookup").param("phone",f.prefix))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(1)))
                .andExpect(jsonPath("$[0].customerId").doesNotExist());
        mvc.perform(get("/api/v1/appointment-slots").param("branchId",f.branch.getId().toString())
                .param("date",f.slot.getAppointmentDate().toString())).andExpect(jsonPath("$[0].activeBookingCount").value(1));
        f.slot.setStatus(AppointmentSlotStatus.CLOSED); em.flush();
        mvc.perform(get("/api/v1/appointment-slots").param("branchId",f.branch.getId().toString())
                .param("date",f.slot.getAppointmentDate().toString())).andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(0)));
    }

    @Test void historyWarrantyAndFeedbackEnforcePhoneOwnershipAndHideNotes() throws Exception {
        var ticket = f.ticket(ServiceTicketStatus.HANDED_OVER);
        ticket.setHandedOverAt(java.time.LocalDateTime.now(clock)); ticket.setHandedOverBy(f.receptionist);
        var item = f.item(ticket); item.setWarrantyStartDate(LocalDate.now(clock)); item.setWarrantyEndDate(LocalDate.now(clock).plusDays(30));
        em.flush();
        String phone = ticket.getCustomerDevice().getCustomer().getPhone();
        mvc.perform(get("/api/v1/service-tickets/lookup").param("phone",phone)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ticketCode").value(ticket.getTicketCode()))
                .andExpect(jsonPath("$[0].approvedTotal").value(100))
                .andExpect(jsonPath("$[0].repairItems[0].deviceModelId").value(f.model.getId()))
                .andExpect(jsonPath("$[0].repairItems[0].serviceCatalogItemId").value(f.catalog.getId()))
                .andExpect(jsonPath("$[0].repairItems[0].serviceTypeCode").value("REPAIR"))
                .andExpect(jsonPath("$[0].createdById").doesNotExist())
                .andExpect(jsonPath("$[0].inspectionResult").doesNotExist())
                .andExpect(jsonPath("$[0].repairItems[0].approvalNote").doesNotExist());
        mvc.perform(get("/api/v1/service-tickets/lookup").param("ticketCode",ticket.getTicketCode()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",hasSize(1)))
                .andExpect(jsonPath("$[0].ticketCode").value(ticket.getTicketCode()));
        mvc.perform(get("/api/v1/service-tickets/lookup").param("phone",phone).param("ticketCode",ticket.getTicketCode()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BUSINESS_RULE_VIOLATION"));
        mvc.perform(get("/api/v1/warranties/eligibility").param("repairItemId",item.getId().toString()).param("phone","wrong"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/warranties/eligibility").param("repairItemId",item.getId().toString()).param("phone",phone))
                .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(true));
        String uri="/api/v1/service-tickets/"+ticket.getTicketCode()+"/feedback";
        mvc.perform(post(uri).contentType("application/json").content(json.writeValueAsString(new PublicFeedbackRequest("wrong",true,"Fine"))))
                .andExpect(status().isNotFound());
        String body=json.writeValueAsString(new PublicFeedbackRequest(phone,true,"Fine"));
        mvc.perform(post(uri).contentType("application/json").content(body)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticketCode").value(ticket.getTicketCode())).andExpect(jsonPath("$.serviceTicketId").doesNotExist());
        mvc.perform(post(uri).contentType("application/json").content(body)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test void invalidFiltersAndMissingRecordsUseTypedErrors() throws Exception {
        mvc.perform(get("/api/v1/device-models").param("deviceTypeId","-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/appointment-slots").param("branchId","1").param("date","invalid"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/warranties/eligibility").param("phone",f.prefix).param("repairItemId",Long.toString(Long.MAX_VALUE)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }
}
