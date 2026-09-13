package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateDeviceModelRequest;
import com.applecare.apple_repair_service.dto.request.UpdateDeviceModelRequest;
import com.applecare.apple_repair_service.dto.response.DeviceModelResponse;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.DeviceModelRepository;

import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeviceModelService {
    private final DeviceModelRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public DeviceModelResponse getById(Long id) {
        return mapper.map(access.get(DeviceModel.class, id));
    }

    public List<DeviceModelResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceModelResponse create(CreateDeviceModelRequest r) {
        rules.validate(r);
        var e = new DeviceModel();
        apply(e, new UpdateDeviceModelRequest(r.deviceTypeId(), r.name()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceModelResponse update(Long id, UpdateDeviceModelRequest r) {
        rules.validate(r);
        var e = access.lock(DeviceModel.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceModelResponse activate(Long id) {
        var e = access.lock(DeviceModel.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DeviceModelResponse deactivate(Long id) {
        var e = access.lock(DeviceModel.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    private void apply(DeviceModel e, UpdateDeviceModelRequest r) {
        if (repository.findAllByDeviceType_Id(r.deviceTypeId()).stream().anyMatch(x -> x.getName().equalsIgnoreCase(r.name().trim()) && !Objects.equals(x.getId(), e.getId())))
            throw new DuplicateResourceException("Model name already exists for device type");
        e.setDeviceType(access.get(DeviceType.class, r.deviceTypeId()));
        e.setName(BusinessRules.text(r.name()));

    }

    private DeviceModelResponse save(DeviceModel e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("DeviceModel conflicts with an existing unique key");
        }
    }
}
