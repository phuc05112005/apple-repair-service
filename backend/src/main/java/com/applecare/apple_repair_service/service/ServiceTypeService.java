package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceTypeRequest;
import com.applecare.apple_repair_service.dto.request.UpdateServiceTypeRequest;
import com.applecare.apple_repair_service.dto.response.ServiceTypeResponse;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.ServiceTypeRepository;
import com.applecare.apple_repair_service.repository.AdminReferenceRepository;

import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ServiceTypeService {
    private final ServiceTypeRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final AdminReferenceRepository references;

    public ServiceTypeResponse getById(Long id) {
        return mapper.map(access.get(ServiceType.class, id));
    }

    public List<ServiceTypeResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTypeResponse create(CreateServiceTypeRequest r) {
        rules.validate(r);
        var e = new ServiceType();
        apply(e, new UpdateServiceTypeRequest(r.code(), r.name()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTypeResponse update(Long id, UpdateServiceTypeRequest r) {
        rules.validate(r);
        var e = access.lock(ServiceType.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTypeResponse activate(Long id) {
        var e = access.lock(ServiceType.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTypeResponse deactivate(Long id) {
        var e = access.lock(ServiceType.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void delete(Long id) {
        var entity = access.lock(ServiceType.class, id);
        String message = "Không thể xóa loại dịch vụ vì dữ liệu này đang được sử dụng.";
        if (references.serviceTypeIsReferenced(id)) throw new ConflictException(message);
        try {
            repository.delete(entity);
            repository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException(message, ex);
        }
    }

    private void apply(ServiceType e, UpdateServiceTypeRequest r) {
        repository.findByNameIgnoreCase(r.name().trim()).filter(x -> !Objects.equals(x.getId(), e.getId())).ifPresent(x -> {
            throw new DuplicateResourceException("Name already exists");
        });
        repository.findByCode(r.code()).filter(x -> !Objects.equals(x.getId(), e.getId())).ifPresent(x -> {
            throw new DuplicateResourceException("Code already exists");
        });
        e.setCode(r.code());
        e.setName(BusinessRules.text(r.name()));

    }

    private ServiceTypeResponse save(ServiceType e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("ServiceType conflicts with an existing unique key");
        }
    }
}
