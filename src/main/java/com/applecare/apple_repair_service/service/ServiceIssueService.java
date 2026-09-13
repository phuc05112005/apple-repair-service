package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceIssueRequest;
import com.applecare.apple_repair_service.dto.request.UpdateServiceIssueRequest;
import com.applecare.apple_repair_service.dto.response.ServiceIssueResponse;
import com.applecare.apple_repair_service.entity.ServiceIssue;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.ServiceIssueRepository;

import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ServiceIssueService {
    private final ServiceIssueRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public ServiceIssueResponse getById(Long id) {
        return mapper.map(access.get(ServiceIssue.class, id));
    }

    public List<ServiceIssueResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceIssueResponse create(CreateServiceIssueRequest r) {
        rules.validate(r);
        var e = new ServiceIssue();
        apply(e, new UpdateServiceIssueRequest(r.name()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceIssueResponse update(Long id, UpdateServiceIssueRequest r) {
        rules.validate(r);
        var e = access.lock(ServiceIssue.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceIssueResponse activate(Long id) {
        var e = access.lock(ServiceIssue.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceIssueResponse deactivate(Long id) {
        var e = access.lock(ServiceIssue.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    private void apply(ServiceIssue e, UpdateServiceIssueRequest r) {
        repository.findByNameIgnoreCase(r.name().trim()).filter(x -> !Objects.equals(x.getId(), e.getId())).ifPresent(x -> {
            throw new DuplicateResourceException("Name already exists");
        });
        e.setName(BusinessRules.text(r.name()));

    }

    private ServiceIssueResponse save(ServiceIssue e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("ServiceIssue conflicts with an existing unique key");
        }
    }
}
