package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateBranchRequest;
import com.applecare.apple_repair_service.dto.request.UpdateBranchRequest;
import com.applecare.apple_repair_service.dto.response.BranchResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.BranchRepository;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BranchService {
    private final BranchRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public BranchResponse getById(Long id) {
        return mapper.map(access.get(Branch.class, id));
    }

    public List<BranchResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public BranchResponse create(CreateBranchRequest r) {
        rules.validate(r);
        var e = new Branch();
        apply(e, new UpdateBranchRequest(r.name(), r.address(), r.phone()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public BranchResponse update(Long id, UpdateBranchRequest r) {
        rules.validate(r);
        var e = access.lock(Branch.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public BranchResponse activate(Long id) {
        var e = access.lock(Branch.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public BranchResponse deactivate(Long id) {
        var e = access.lock(Branch.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    private void apply(Branch e, UpdateBranchRequest r) {

        e.setName(BusinessRules.text(r.name()));
        e.setAddress(BusinessRules.text(r.address()));
        e.setPhone(BusinessRules.text(r.phone()));

    }

    private BranchResponse save(Branch e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("Branch conflicts with an existing unique key");
        }
    }
}
