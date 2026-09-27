package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;

// Fixtures are inserted only inside rollback tests, or tracked explicitly by the HTTP workflow cleanup.
final class ApiFixture {
    static final String PASSWORD = "Api-test-password-17!";
    final EntityManager em;
    final Clock clock;
    final String prefix = "APITEST" + UUID.randomUUID().toString().replace("-", "");
    Branch branch;
    DeviceType deviceType;
    DeviceModel model;
    ServiceType serviceType;
    ServiceIssue issue;
    ServiceCatalogItem catalog;
    AppointmentSlot slot;
    User admin, receptionist, technician, otherTechnician;
    ApiFixture(EntityManager em, Clock clock) { this.em=em; this.clock=clock; }
    void create() {
        branch = new Branch(); branch.setName(prefix); branch.setAddress("Fixture address"); em.persist(branch);
        deviceType = new DeviceType(); deviceType.setName(prefix); em.persist(deviceType);
        model = new DeviceModel(); model.setName(prefix); model.setDeviceType(deviceType); em.persist(model);
        var existing = em.createQuery("select s from ServiceType s where s.code=:code", ServiceType.class)
                .setParameter("code", ServiceTypeCode.REPAIR).getResultList();
        if (existing.isEmpty()) {
            serviceType = new ServiceType(); serviceType.setName(prefix); serviceType.setCode(ServiceTypeCode.REPAIR); em.persist(serviceType);
        } else serviceType = existing.getFirst();
        issue = new ServiceIssue(); issue.setName(prefix); issue.getDeviceTypes().add(deviceType); issue.setMappingInitialized(true); em.persist(issue);
        catalog = new ServiceCatalogItem(); catalog.setName(prefix); catalog.setDeviceModel(model);
        catalog.setServiceType(serviceType); catalog.setServiceIssue(issue); catalog.setConfiguredPrice(new BigDecimal("100.00"));
        catalog.setStandardDurationMinutes(30); catalog.setWarrantyDays(30); catalog.setWarrantyRemedy(WarrantyRemedy.REPAIR); em.persist(catalog);
        slot = new AppointmentSlot(); slot.setBranch(branch); slot.setAppointmentDate(LocalDate.now(clock).plusDays(1));
        slot.setStartTime(LocalTime.of(10,0)); slot.setEndTime(LocalTime.of(11,0)); em.persist(slot);
        admin = user(UserRole.ADMIN, "admin"); receptionist = user(UserRole.RECEPTIONIST, "receptionist");
        technician = user(UserRole.TECHNICIAN, "technician"); otherTechnician = user(UserRole.TECHNICIAN, "other");
        em.flush();
    }
    User user(UserRole role, String suffix) {
        var u = new User(); u.setUsername(prefix+suffix); u.setFullName(prefix+suffix); u.setRole(role);
        u.setPasswordHash(new BCryptPasswordEncoder(4).encode(PASSWORD)); em.persist(u); return u;
    }
    ServiceTicket ticket(ServiceTicketStatus status) {
        var c = new Customer(); c.setFullName(prefix); c.setPhone(prefix+UUID.randomUUID().toString().substring(0,8)); em.persist(c);
        var d = new CustomerDevice(); d.setCustomer(c); d.setDeviceModel(model); em.persist(d);
        var t = new ServiceTicket(); t.setTicketCode(prefix+UUID.randomUUID().toString().substring(0,8));
        t.setCustomerDevice(d); t.setBranch(branch); t.setCreatedBy(receptionist);
        t.setReceivedCondition("PRIVATE RECEIVED NOTE"); t.setInspectionResult("PRIVATE INSPECTION NOTE");
        t.setStatus(status); t.setReceivedAt(LocalDateTime.now(clock)); em.persist(t); return t;
    }
    RepairItem item(ServiceTicket ticket) {
        var i = new RepairItem(); i.setServiceTicket(ticket); i.setServiceCatalogItem(catalog);
        i.setItemNameSnapshot(catalog.getName()); i.setApprovalStatus(ApprovalStatus.APPROVED);
        i.setBasePrice(new BigDecimal("100.00")); i.setFinalPrice(new BigDecimal("100.00"));
        i.setApprovalNote("PRIVATE APPROVAL NOTE"); em.persist(i); return i;
    }
}
