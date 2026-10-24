package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CustomerDeviceInfoRequest;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.repository.CustomerDeviceRepository;
import com.applecare.apple_repair_service.repository.CustomerRepository;
import jakarta.validation.Validation;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomerIdentityTest {
    final CustomerRepository customers = mock(CustomerRepository.class);
    final CustomerDeviceRepository devices = mock(CustomerDeviceRepository.class);
    final DomainAccess access = mock(DomainAccess.class);
    final CustomerIdentity service = new CustomerIdentity(customers, devices, access, new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()));

    @Test
    void createsCustomerWithTrimmedPhoneAndName() {
        when(customers.findByPhone("0901")).thenReturn(Optional.empty());
        when(customers.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        var c = service.resolve(" An ", " 0901 ");
        assertEquals("An", c.getFullName());
        assertEquals("0901", c.getPhone());
    }

    @Test
    void reusesCustomerAndUpdatesName() {
        var c = new Customer();
        c.setId(1L);
        c.setPhone("0901");
        c.setFullName("Old");
        when(customers.findByPhone("0901")).thenReturn(Optional.of(c));
        when(customers.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        assertSame(c, service.resolve("New", "0901"));
        assertEquals("New", c.getFullName());
    }

    @Test
    void serialOwnedByAnotherCustomerConflicts() {
        var owner = new Customer();
        owner.setId(2L);
        var c = new Customer();
        c.setId(1L);
        var model = new DeviceModel();
        model.setId(3L);
        var device = new CustomerDevice();
        device.setId(4L);
        device.setCustomer(owner);
        when(access.lock(Customer.class, 1L)).thenReturn(c);
        when(access.get(DeviceModel.class, 3L)).thenReturn(model);
        when(devices.findBySerialNumber("SER")).thenReturn(Optional.of(device));
        assertThrows(ConflictException.class, () -> service.resolveDevice(1L, new CustomerDeviceInfoRequest(3L, " SER ", null)));
    }

    @Test
    void noSerialCreatesDistinctPhysicalDevices() {
        var c = new Customer();
        c.setId(1L);
        when(access.lock(Customer.class, 1L)).thenReturn(c);
        when(access.get(DeviceModel.class, 2L)).thenReturn(new DeviceModel());
        when(devices.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        var r = new CustomerDeviceInfoRequest(2L, " ", null);
        assertNotSame(service.resolveDevice(1L, r), service.resolveDevice(1L, r));
        verify(devices, never()).findBySerialNumber(any());
    }
}
