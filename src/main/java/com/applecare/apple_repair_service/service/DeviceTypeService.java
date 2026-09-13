package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateDeviceTypeRequest;
import com.applecare.apple_repair_service.dto.request.UpdateDeviceTypeRequest;
import com.applecare.apple_repair_service.dto.response.DeviceTypeResponse;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.DeviceTypeRepository;

import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeviceTypeService {
    private final DeviceTypeRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public DeviceTypeResponse getById(Long id) {
        return mapper.map(access.get(DeviceType.class, id));
    }

    public List<DeviceTypeResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceTypeResponse create(CreateDeviceTypeRequest r) {
        rules.validate(r);
        var e = new DeviceType();
        apply(e, new UpdateDeviceTypeRequest(r.name()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceTypeResponse update(Long id, UpdateDeviceTypeRequest r) {
        rules.validate(r);
        var e = access.lock(DeviceType.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceTypeResponse activate(Long id) {
        var e = access.lock(DeviceType.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceTypeResponse deactivate(Long id) {
        var e = access.lock(DeviceType.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    private void apply(DeviceType e, UpdateDeviceTypeRequest r) {
        repository.findByNameIgnoreCase(r.name().trim()).filter(x -> !Objects.equals(x.getId(), e.getId())).ifPresent(x -> {
            throw new DuplicateResourceException("Name already exists");
        });
        e.setName(BusinessRules.text(r.name()));

    }

    private DeviceTypeResponse save(DeviceType e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("DeviceType conflicts with an existing unique key");
        }
    }
}
