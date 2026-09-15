package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@Transactional
class TechnicianAuthorizationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ObjectMapper json;
    @Autowired Clock clock;
    ApiFixture f;
    ServiceTicket ticket;
    RepairItem item;
    Assignment initial;
    String a,b,reception;
    @BeforeEach void fixture() throws Exception {
        f=new ApiFixture(em,clock); f.create();
        for(var user:List.of(f.technician,f.otherTechnician)) {
            var shift=new TechnicianSchedule();shift.setTechnician(user);shift.setBranch(f.branch);
            shift.setWorkDate(LocalDate.now(clock));shift.setStartTime(LocalTime.MIN);shift.setEndTime(LocalTime.of(23,59,59));
            em.persist(shift);
        }
        ticket=f.ticket(ServiceTicketStatus.ASSIGNED);item=f.item(ticket);
        initial=new Assignment();initial.setServiceTicket(ticket);initial.setTechnician(f.technician);
        initial.setAssignedBy(f.receptionist);initial.setSource(AssignmentSource.MANUAL_OVERRIDE);initial.setAssignedAt(LocalDateTime.now(clock));
        em.persist(initial);em.flush();
        a=login(f.technician);b=login(f.otherTechnician);reception=login(f.receptionist);
    }
    String login(User user) throws Exception {
        var response=mvc.perform(post("/api/v1/auth/login").contentType("application/json")
                .content(json.writeValueAsString(new LoginRequest(user.getUsername(),ApiFixture.PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer "+json.readTree(response).get("accessToken").asString();
    }
    ResultActions command(String uri,String bearer,Object body) throws Exception {
        var request=post("/api/v1/internal/"+uri).header("Authorization",bearer);
        if(body!=null) request.contentType("application/json").content(json.writeValueAsString(body));
        return mvc.perform(request);
    }
    String ticketPath(String suffix) {return "service-tickets/"+ticket.getId()+"/"+suffix;}
    void denied(ResultActions result) throws Exception {
        result.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());
    }
    long requestTransfer() throws Exception {
        var body=command(ticketPath("transfers/request"),a,new TransferCommand(f.otherTechnician.getId(),"Please transfer"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.requestedById").value(f.technician.getId()))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asLong();
    }
    void assertOwner(User user) {
        em.flush();
        var active=em.createQuery("select a from Assignment a where a.serviceTicket.id=:id and a.status=:status",Assignment.class)
                .setParameter("id",ticket.getId()).setParameter("status",AssignmentStatus.ACTIVE).getResultList();
        assertEquals(1,active.size());assertEquals(user.getId(),active.getFirst().getTechnician().getId());
    }
    @Test void onlyActiveAssigneeCanInspectAndReadTicket() throws Exception {
        denied(command(ticketPath("inspection/start"),b,null));
        denied(mvc.perform(get("/api/v1/internal/service-tickets/"+ticket.getId()).header("Authorization",b)));
        command(ticketPath("inspection/start"),a,null).andExpect(status().isOk()).andExpect(jsonPath("$.ticket.status").value("INSPECTING"));
        var inspection=new InspectionCommand("Same repair",false,List.of(new InspectionRepairItemRequest(f.catalog.getId(),new BigDecimal("100.00"),new BigDecimal("100.00"),null)));
        denied(command(ticketPath("inspection"),b,inspection));
        command(ticketPath("inspection"),a,inspection).andExpect(status().isOk())
                .andExpect(jsonPath("$.ticket.inspectedById").value(f.technician.getId())).andExpect(jsonPath("$.ticket.status").value("REPAIRING"));
        em.flush();assertEquals(f.technician.getId(),ticket.getInspectedBy().getId());
        denied(command(ticketPath("wait-for-part"),b,new NoteCommand("wait")));
        denied(command(ticketPath("finish-repair"),b,null));
    }
    @Test void directTransferRevokesOldTechnicianWithoutChangingBusinessStatus() throws Exception {
        command(ticketPath("inspection/start"),a,null).andExpect(status().isOk());
        denied(command(ticketPath("transfers/direct"),a,new TransferCommand(f.otherTechnician.getId(),null)));
        command(ticketPath("transfers/direct"),reception,new TransferCommand(f.otherTechnician.getId(),"Direct"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"));
        em.flush();assertEquals(AssignmentStatus.ENDED,initial.getStatus());assertOwner(f.otherTechnician);
        assertEquals(ServiceTicketStatus.INSPECTING,ticket.getStatus());
        var inspection=new InspectionCommand("Same repair",false,List.of(new InspectionRepairItemRequest(f.catalog.getId(),new BigDecimal("100.00"),new BigDecimal("100.00"),null)));
        denied(command(ticketPath("inspection"),a,inspection));
        command(ticketPath("inspection"),b,inspection).andExpect(status().isOk()).andExpect(jsonPath("$.ticket.inspectedById").value(f.otherTechnician.getId()));
    }
    @Test void pendingRequestPreservesSourceAccessAndOnlyTargetCanAccept() throws Exception {
        denied(command(ticketPath("transfers/request"),b,new TransferCommand(f.technician.getId(),null)));
        long transfer=requestTransfer();assertOwner(f.technician);
        denied(command(ticketPath("inspection/start"),b,null));
        command(ticketPath("inspection/start"),a,null).andExpect(status().isOk());
        denied(command("transfers/"+transfer+"/accept",a,new NoteCommand(null)));
        command("transfers/"+transfer+"/accept",b,new NoteCommand("Accepted")).andExpect(status().isOk())
                .andExpect(jsonPath("$.respondedById").value(f.otherTechnician.getId()));
        assertOwner(f.otherTechnician);assertEquals(AssignmentStatus.ENDED,initial.getStatus());
        assertEquals(ServiceTicketStatus.INSPECTING,ticket.getStatus());
        var inspection=new InspectionCommand("Same",false,List.of(new InspectionRepairItemRequest(f.catalog.getId(),new BigDecimal("100.00"),new BigDecimal("100.00"),null)));
        denied(command(ticketPath("inspection"),a,inspection));
        command(ticketPath("inspection"),b,inspection).andExpect(status().isOk());
    }
    @Test void rejectedRequestPreservesSourceAccessAndOnlyTargetCanReject() throws Exception {
        long transfer=requestTransfer();
        denied(command("transfers/"+transfer+"/reject",a,new NoteCommand("No")));
        command("transfers/"+transfer+"/reject",b,new NoteCommand("No")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        assertOwner(f.technician);assertEquals(AssignmentStatus.ACTIVE,initial.getStatus());
        denied(command(ticketPath("inspection/start"),b,null));
        command(ticketPath("inspection/start"),a,null).andExpect(status().isOk());
    }
    @Test void cancellationRequiresRequesterOrReceptionist() throws Exception {
        long transfer=requestTransfer();
        denied(command("transfers/"+transfer+"/cancel",b,new NoteCommand("Cancel")));
        command("transfers/"+transfer+"/cancel",a,new NoteCommand("Cancel")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        long next=requestTransfer();
        command("transfers/"+next+"/cancel",reception,new NoteCommand("Cancel")).andExpect(status().isOk());
        assertOwner(f.technician);
    }
    @Test void partUsageAndReversalRequireAssigneeAndReverseOnlyOnce() throws Exception {
        ticket.setStatus(ServiceTicketStatus.REPAIRING);
        var part=new Part();part.setPartCode(f.prefix);part.setName(f.prefix);part.setSalePrice(BigDecimal.TEN);em.persist(part);
        var stock=new BranchInventory();stock.setBranch(f.branch);stock.setPart(part);stock.setQuantity(5);em.persist(stock);em.flush();
        String use="repair-items/"+item.getId()+"/part-usages";
        denied(command(use,b,new PartUsageCommand(part.getId(),2)));
        var result=command(use,a,new PartUsageCommand(part.getId(),2)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedById").value(f.technician.getId())).andReturn().getResponse().getContentAsString();
        long usage=json.readTree(result).get("id").asLong();em.flush();assertEquals(3,stock.getQuantity());
        denied(command("part-usages/"+usage+"/reverse",b,new NoteCommand("Return")));
        command("part-usages/"+usage+"/reverse",a,new NoteCommand("Return")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVERSED")).andExpect(jsonPath("$.reversedById").value(f.technician.getId()));
        em.flush();assertEquals(5,stock.getQuantity());
        command("part-usages/"+usage+"/reverse",a,new NoteCommand("Again")).andExpect(status().isConflict());
    }
    @Test void operationalReadModelsAreActorScopedAndExposeRealTicketContext() throws Exception {
        var part=new Part();part.setPartCode(f.prefix);part.setName("Battery");part.setBrand("Apple");
        part.setVariant("Original");part.setSalePrice(BigDecimal.TEN);em.persist(part);
        var stock=new BranchInventory();stock.setBranch(f.branch);stock.setPart(part);stock.setQuantity(5);em.persist(stock);em.flush();

        mvc.perform(get("/api/v1/internal/technician/work").header("Authorization",a))
                .andExpect(status().isOk()).andExpect(jsonPath("$",org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].ticketId").value(ticket.getId()))
                .andExpect(jsonPath("$[0].customerFullName").value(ticket.getCustomerDevice().getCustomer().getFullName()))
                .andExpect(jsonPath("$[0].deviceModelName").value(f.model.getName()))
                .andExpect(jsonPath("$[0].activeTechnicianId").value(f.technician.getId()));
        mvc.perform(get("/api/v1/internal/technician/work").header("Authorization",b))
                .andExpect(status().isOk()).andExpect(jsonPath("$",org.hamcrest.Matchers.hasSize(0)));
        denied(mvc.perform(get("/api/v1/internal/technician/work").header("Authorization",reception)));

        mvc.perform(get("/api/v1/internal/service-tickets").header("Authorization",reception)
                        .param("query",ticket.getTicketCode()))
                .andExpect(status().isOk()).andExpect(jsonPath("$",org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[0].ticketId").value(ticket.getId()));
        denied(mvc.perform(get("/api/v1/internal/service-tickets").header("Authorization",a)));

        mvc.perform(get("/api/v1/internal/service-tickets/"+ticket.getId()+"/available-parts").header("Authorization",a))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].partId").value(part.getId()))
                .andExpect(jsonPath("$[0].brand").value("Apple"))
                .andExpect(jsonPath("$[0].availableQuantity").value(5));
        denied(mvc.perform(get("/api/v1/internal/service-tickets/"+ticket.getId()+"/available-parts").header("Authorization",b)));

        mvc.perform(get("/api/v1/internal/service-tickets/"+ticket.getId()+"/transfer-candidates").header("Authorization",a))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].technicianId").value(f.otherTechnician.getId()));
        long transfer=requestTransfer();
        mvc.perform(get("/api/v1/internal/transfers/incoming").header("Authorization",b))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].transfer.id").value(transfer))
                .andExpect(jsonPath("$[0].ticket.ticketId").value(ticket.getId()));
        mvc.perform(get("/api/v1/internal/transfers/incoming").header("Authorization",a))
                .andExpect(status().isOk()).andExpect(jsonPath("$",org.hamcrest.Matchers.hasSize(0)));

        ticket.setStatus(ServiceTicketStatus.REPAIRING);em.flush();
        var usage=command("repair-items/"+item.getId()+"/part-usages",a,new PartUsageCommand(part.getId(),1))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/v1/internal/repair-items/"+item.getId()+"/part-usages").header("Authorization",a))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(json.readTree(usage).get("id").asLong()));
        denied(mvc.perform(get("/api/v1/internal/repair-items/"+item.getId()+"/part-usages").header("Authorization",b)));
    }
    @Test void warrantyRequiresAssigneeAndApprovalRemainsReceptionistOnly() throws Exception {
        ticket.setStatus(ServiceTicketStatus.REPAIRING);
        var sourceTicket=f.ticket(ServiceTicketStatus.HANDED_OVER);sourceTicket.setCustomerDevice(ticket.getCustomerDevice());
        var source=f.item(sourceTicket);source.setWarrantyStartDate(LocalDate.now(clock).minusDays(1));source.setWarrantyEndDate(LocalDate.now(clock).plusDays(29));
        var matches=em.createQuery("select s from ServiceType s where s.code=:code",ServiceType.class).setParameter("code",ServiceTypeCode.WARRANTY).getResultList();
        ServiceType warrantyType;
        if(matches.isEmpty()){warrantyType=new ServiceType();warrantyType.setCode(ServiceTypeCode.WARRANTY);warrantyType.setName(f.prefix+"warranty");em.persist(warrantyType);}
        else warrantyType=matches.getFirst();
        var warrantyCatalog=new ServiceCatalogItem();warrantyCatalog.setName(f.prefix+"warranty");warrantyCatalog.setDeviceModel(f.model);
        warrantyCatalog.setServiceIssue(f.issue);warrantyCatalog.setServiceType(warrantyType);em.persist(warrantyCatalog);
        item.setServiceCatalogItem(warrantyCatalog);item.setWarrantySourceItem(source);em.flush();
        var request=new WarrantyDecisionRequest(WarrantyDecision.APPROVED,null);
        denied(command("repair-items/"+item.getId()+"/warranty-decision",b,request));
        command("repair-items/"+item.getId()+"/warranty-decision",a,request).andExpect(status().isOk())
                .andExpect(jsonPath("$.finalPrice").value(0)).andExpect(jsonPath("$.warrantyDecision").value("APPROVED"));
        assertEquals(LocalDate.now(clock).plusDays(29),source.getWarrantyEndDate());
        denied(command("repair-items/"+item.getId()+"/approval",a,new ApprovalCommand(ApprovalStatus.APPROVED,null)));
        denied(mvc.perform(get("/api/v1/admin/statistics/overview").header("Authorization",a)
                .param("from",LocalDate.now(clock).toString()).param("to",LocalDate.now(clock).toString())));
    }
}
