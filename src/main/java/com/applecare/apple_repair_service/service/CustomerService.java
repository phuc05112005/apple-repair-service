package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.response.CustomerResponse;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.CustomerRepository;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomerService {
    private final CustomerIdentity identity;
    private final CustomerRepository repository;
    private final DomainAccess access;
    private final EntityResponses mapper;
    private final RetryingWrites writes;

    public CustomerResponse findOrCreateByPhone(String fullName, String phone) {
        return writes.execute(() -> mapper.map(identity.resolve(fullName, phone)));
    }

    @Transactional(readOnly = true)
    public CustomerResponse getById(Long id) {
        return mapper.map(access.get(Customer.class, id));
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }
}
