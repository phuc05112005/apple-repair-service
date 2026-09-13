package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CustomerDeviceInfoRequest;
import com.applecare.apple_repair_service.dto.response.CustomerDeviceResponse;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.CustomerDeviceRepository;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerDeviceService {
    private final CustomerIdentity identity;
    private final CustomerDeviceRepository repository;
    private final RetryingWrites writes;
    private final DomainAccess access;
    private final EntityResponses mapper;

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.SUPPORTS)
    public CustomerDeviceResponse findOrCreateDevice(Long customerId, CustomerDeviceInfoRequest r) {
        return writes.execute(() -> mapper.map(identity.resolveDevice(customerId, r)));
    }

    public CustomerDeviceResponse getById(Long id) {
        return mapper.map(access.get(CustomerDevice.class, id));
    }

    public List<CustomerDeviceResponse> listByCustomer(Long customerId) {
        access.get(Customer.class, customerId);
        return repository.findAllByCustomer_Id(customerId).stream().map(mapper::map).toList();
    }
}
