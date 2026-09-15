package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceCatalogItemRequest;
import com.applecare.apple_repair_service.dto.request.UpdateServiceCatalogItemRequest;
import com.applecare.apple_repair_service.dto.response.ServiceCatalogItemResponse;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceIssue;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.ServiceCatalogItemRepository;
import com.applecare.apple_repair_service.repository.AdminReferenceRepository;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ServiceCatalogService {
    private final ServiceCatalogItemRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final AdminReferenceRepository references;

    public ServiceCatalogItemResponse getById(Long id) {
        return mapper.map(access.get(ServiceCatalogItem.class, id));
    }

    public List<ServiceCatalogItemResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceCatalogItemResponse create(CreateServiceCatalogItemRequest r) {
        rules.validate(r);
        var e = new ServiceCatalogItem();
        apply(e, new UpdateServiceCatalogItemRequest(r.deviceModelId(), r.serviceTypeId(), r.serviceIssueId(), r.partId(), r.name(), r.configuredPrice(), r.standardDurationMinutes(), r.warrantyDays()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceCatalogItemResponse update(Long id, UpdateServiceCatalogItemRequest r) {
        rules.validate(r);
        var e = access.lock(ServiceCatalogItem.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceCatalogItemResponse activate(Long id) {
        var e = access.lock(ServiceCatalogItem.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceCatalogItemResponse deactivate(Long id) {
        var e = access.lock(ServiceCatalogItem.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void delete(Long id) {
        var entity = access.lock(ServiceCatalogItem.class, id);
        String message = "Không thể xóa dịch vụ vì dữ liệu này đang được sử dụng.";
        if (references.serviceCatalogItemIsReferenced(id)) throw new ConflictException(message);
        try {
            repository.delete(entity);
            repository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException(message, ex);
        }
    }

    private void apply(ServiceCatalogItem e, UpdateServiceCatalogItemRequest r) {

        e.setDeviceModel(access.get(DeviceModel.class, r.deviceModelId()));
        e.setServiceType(access.get(ServiceType.class, r.serviceTypeId()));
        e.setServiceIssue(access.get(ServiceIssue.class, r.serviceIssueId()));
        e.setPart(r.partId() == null ? null : access.get(Part.class, r.partId()));
        e.setName(BusinessRules.text(r.name()));
        e.setConfiguredPrice(r.configuredPrice());
        e.setStandardDurationMinutes(r.standardDurationMinutes());
        e.setWarrantyDays(r.warrantyDays());
        BusinessRules.require(e.getServiceType().getCode() != ServiceTypeCode.REPLACEMENT || e.getPart() != null, "Replacement requires part");
    }

    private ServiceCatalogItemResponse save(ServiceCatalogItem e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("ServiceCatalogItem conflicts with an existing unique key");
        }
    }
}
