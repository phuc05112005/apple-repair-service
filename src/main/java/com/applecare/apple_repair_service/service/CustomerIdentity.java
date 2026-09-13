package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CustomerDeviceInfoRequest;
import com.applecare.apple_repair_service.dto.request.CustomerInfoRequest;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.repository.CustomerDeviceRepository;
import com.applecare.apple_repair_service.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Internal collaborator. Participates in the caller's transaction, including booking rollback.
 */
@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class CustomerIdentity {
    private final CustomerRepository customers;
    private final CustomerDeviceRepository devices;
    private final DomainAccess access;
    private final BusinessRules rules;

    Customer resolve(String fullName, String phone) {
        rules.validate(new CustomerInfoRequest(fullName, phone));
        String normalized = phone.trim();
        var customer = customers.findByPhone(normalized).orElseGet(Customer::new);
        customer.setFullName(fullName.trim());
        customer.setPhone(normalized);
        return customers.saveAndFlush(customer);
    }

    CustomerDevice resolveDevice(Long customerId, CustomerDeviceInfoRequest r) {
        rules.validate(r);
        var customer = access.lock(Customer.class, customerId);
        var model = access.get(DeviceModel.class, r.deviceModelId());
        String serial = BusinessRules.text(r.serialNumber());
        var device = serial == null ? new CustomerDevice() : devices.findBySerialNumber(serial).orElseGet(CustomerDevice::new);
        if (device.getId() != null) {
            if (!device.getCustomer().getId().equals(customerId))
                throw new ConflictException("Serial belongs to another customer");
            if (!device.getDeviceModel().getId().equals(model.getId()))
                throw new ConflictException("Serial has a different device model");
        }
        device.setCustomer(customer);
        device.setDeviceModel(model);
        device.setSerialNumber(serial);
        if (BusinessRules.text(r.storage()) != null) device.setStorage(r.storage().trim());
        return devices.saveAndFlush(device);
    }
}
