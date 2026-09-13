package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

final class TestData {
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-11T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    static User user(long id) {
        var u = new User();
        u.setId(id);
        u.setFullName("User");
        u.setRole(UserRole.TECHNICIAN);
        u.setStatus(UserStatus.ACTIVE);
        return u;
    }

    static Branch branch(long id) {
        var b = new Branch();
        b.setId(id);
        b.setName("Branch");
        b.setAddress("Address");
        return b;
    }

    static ServiceTicket ticket(ServiceTicketStatus status) {
        var t = new ServiceTicket();
        t.setId(1L);
        t.setStatus(status);
        t.setBranch(branch(1));
        var c = new Customer();
        c.setId(1L);
        var d = new CustomerDevice();
        d.setId(1L);
        d.setCustomer(c);
        var model = new DeviceModel();
        model.setId(1L);
        d.setDeviceModel(model);
        t.setCustomerDevice(d);
        return t;
    }

    static ServiceCatalogItem catalog(long id) {
        var c = new ServiceCatalogItem();
        c.setId(id);
        c.setName("Repair");
        c.setConfiguredPrice(BigDecimal.TEN);
        c.setStandardDurationMinutes(30);
        var m = new DeviceModel();
        m.setId(1L);
        c.setDeviceModel(m);
        var st = new ServiceType();
        st.setCode(ServiceTypeCode.REPAIR);
        c.setServiceType(st);
        return c;
    }

    static RepairItem item(long id, ServiceTicket t, ApprovalStatus status) {
        var i = new RepairItem();
        i.setId(id);
        i.setServiceTicket(t);
        i.setServiceCatalogItem(catalog(id));
        i.setApprovalStatus(status);
        i.setFinalPrice(BigDecimal.TEN);
        return i;
    }
}
