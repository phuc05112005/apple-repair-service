package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
@DataJpaTest(showSql=false, properties={"spring.jpa.hibernate.ddl-auto=validate"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@Import({StatisticsService.class, DomainAccess.class})
@Transactional
class StatisticsIntegrationTest {
    @Autowired EntityManager em;
    @org.springframework.beans.factory.annotation.Value("${spring.datasource.url}") String datasourceUrl;
    @Autowired StatisticsService statistics;
    final LocalDate day=LocalDate.of(2026,9,11);
    String prefix;
    Branch first,second;
    DeviceType firstType,secondType;
    DeviceModel firstModel,secondModel;
    User actor;
    Customer customer;
    ServiceType serviceType;
    ServiceIssue issue;
    @BeforeEach void fixture() {
        prefix="APITEST"+UUID.randomUUID().toString().replace("-","");
        first=branch("a");second=branch("b");
        firstType=new DeviceType();firstType.setName(prefix+"a");em.persist(firstType);
        secondType=new DeviceType();secondType.setName(prefix+"b");em.persist(secondType);
        firstModel=model(firstType,"a");secondModel=model(secondType,"b");
        actor=TestData.user(1);actor.setId(null);actor.setUsername(prefix);actor.setPasswordHash("TEST-ONLY-NON-AUTHENTICATING-HASH");em.persist(actor);
        customer=new Customer();customer.setFullName(prefix);customer.setPhone(prefix);em.persist(customer);
        var existing=em.createQuery("select s from ServiceType s where s.code=:code",ServiceType.class).setParameter("code",ServiceTypeCode.REPAIR).getResultList();
        if(existing.isEmpty()){serviceType=new ServiceType();serviceType.setName(prefix);serviceType.setCode(ServiceTypeCode.REPAIR);em.persist(serviceType);}
        else serviceType=existing.getFirst();
        issue=new ServiceIssue();issue.setName(prefix);em.persist(issue);
        var source=ticket(first,firstModel,day.minusDays(1),PaymentStatus.PAID,day);
        var sourceItem=item(source,"300",ApprovalStatus.APPROVED,null);
        var paid=ticket(first,firstModel,day,PaymentStatus.PAID,day);
        var paidItem=item(paid,"100",ApprovalStatus.APPROVED,null);
        item(paid,"900",ApprovalStatus.REJECTED,null);item(paid,"50",ApprovalStatus.PENDING,null);
        var unpaid=ticket(second,secondModel,day,PaymentStatus.PENDING,null);item(unpaid,"200",ApprovalStatus.APPROVED,null);
        var warranty=ticket(first,firstModel,day,PaymentStatus.PENDING,null);
        item(warranty,"0",ApprovalStatus.APPROVED,sourceItem);item(warranty,"0",ApprovalStatus.APPROVED,sourceItem);
        var tomorrow=ticket(first,firstModel,day.minusDays(2),PaymentStatus.PAID,day.plusDays(1));
        item(tomorrow,"700",ApprovalStatus.APPROVED,null);
        var part=new Part();part.setName(prefix);part.setPartCode(prefix);part.setSalePrice(new BigDecimal("999"));em.persist(part);
        var usage=new PartUsage();usage.setRepairItem(paidItem);usage.setPart(part);usage.setQuantity(3);usage.setRecordedBy(actor);usage.setUsedAt(day.atTime(11,0));em.persist(usage);
        em.flush();em.clear();
    }
    Branch branch(String suffix) {var b=TestData.branch(1);b.setId(null);b.setName(prefix+suffix);em.persist(b);return b;}
    DeviceModel model(DeviceType type,String suffix) {var m=new DeviceModel();m.setDeviceType(type);m.setName(prefix+suffix);em.persist(m);return m;}
    ServiceTicket ticket(Branch branch,DeviceModel model,LocalDate received,PaymentStatus payment,LocalDate paid) {
        var device=new CustomerDevice();device.setCustomer(customer);device.setDeviceModel(model);em.persist(device);
        var t=new ServiceTicket();t.setTicketCode(prefix+UUID.randomUUID().toString().substring(0,8));t.setCustomerDevice(device);t.setBranch(branch);
        t.setCreatedBy(actor);t.setReceivedCondition("Fixture");t.setReceivedAt(received.atTime(10,0));t.setPaymentStatus(payment);
        if(paid!=null){t.setPaidAt(paid.atTime(11,0));t.setStatus(ServiceTicketStatus.HANDED_OVER);t.setHandedOverAt(paid.atTime(12,0));t.setHandedOverBy(actor);t.setPaymentMethod(PaymentMethod.CASH);}
        em.persist(t);return t;
    }
    RepairItem item(ServiceTicket ticket,String price,ApprovalStatus approval,RepairItem source) {
        var catalog=new ServiceCatalogItem();catalog.setDeviceModel(ticket.getCustomerDevice().getDeviceModel());catalog.setServiceType(serviceType);
        catalog.setServiceIssue(issue);catalog.setName(prefix+UUID.randomUUID().toString().substring(0,8));catalog.setStandardDurationMinutes(30);em.persist(catalog);
        var item=new RepairItem();item.setServiceTicket(ticket);item.setServiceCatalogItem(catalog);item.setItemNameSnapshot("Fixture");
        item.setFinalPrice(new BigDecimal(price));item.setApprovalStatus(approval);item.setWarrantySourceItem(source);em.persist(item);return item;
    }
    @Test void aggregatesReceiptStatusesAndPaidRevenueWithDistinctWarrantyTickets() {
        var result=statistics.overview(day,day,null,null);
        assertEquals(3,result.totalTickets());
        assertEquals(2,result.currentStatusCounts().stream().filter(s->s.status()==ServiceTicketStatus.WAITING_ASSIGNMENT).findFirst().orElseThrow().count());
        assertEquals(1,result.currentStatusCounts().stream().filter(s->s.status()==ServiceTicketStatus.HANDED_OVER).findFirst().orElseThrow().count());
        assertEquals(new BigDecimal("400.00"),result.paidRevenue());
        assertEquals(1,result.warrantyReturnTickets());
    }
    @Test void filtersBranchAndDeviceTypeConsistently() {
        assertEquals(2,statistics.overview(day,day,first.getId(),null).totalTickets());
        assertEquals(new BigDecimal("400.00"),statistics.overview(day,day,null,firstType.getId()).paidRevenue());
        var other=statistics.overview(day,day,second.getId(),secondType.getId());
        assertEquals(1,other.totalTickets());assertEquals(new BigDecimal("0.00"),other.paidRevenue());assertEquals(0,other.warrantyReturnTickets());
        assertEquals(0,statistics.overview(day,day,first.getId(),secondType.getId()).totalTickets());
    }

    @Test void includesBothCalendarBoundariesAndExcludesNextMidnight() {
        var isolated=branch("boundaries");
        var lastDay=day.plusDays(2);
        var times=java.util.List.of(day.atStartOfDay(),lastDay.atTime(23,59,59,999999000),
                lastDay.plusDays(1).atStartOfDay(),day.atStartOfDay().minusNanos(1000));
        for(int i=0;i<times.size();i++) {
            var time=times.get(i);
            var ticket=ticket(isolated,firstModel,time.toLocalDate(),PaymentStatus.PAID,time.toLocalDate());
            ticket.setReceivedAt(time);ticket.setPaidAt(time);
            item(ticket,Integer.toString((i+1)*10),ApprovalStatus.APPROVED,null);
        }
        em.flush();em.clear();
        var result=statistics.overview(day,lastDay,isolated.getId(),firstType.getId());
        assertEquals(2,result.totalTickets());
        assertEquals(new BigDecimal("30.00"),result.paidRevenue());
        var database = em.createNativeQuery("select database()", String.class).getSingleResult();
        assertTrue(datasourceUrl.split("\\?")[0].endsWith("/" + database), "Statistics must use the configured test database");
    }
}
