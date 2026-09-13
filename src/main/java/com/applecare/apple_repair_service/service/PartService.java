package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreatePartRequest;
import com.applecare.apple_repair_service.dto.request.UpdatePartRequest;
import com.applecare.apple_repair_service.dto.response.PartResponse;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.PartRepository;

import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PartService {
    private final PartRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    public PartResponse getById(Long id) {
        return mapper.map(access.get(Part.class, id));
    }

    public List<PartResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PartResponse create(CreatePartRequest r) {
        rules.validate(r);
        var e = new Part();
        apply(e, new UpdatePartRequest(r.partCode(), r.name(), r.brand(), r.variant(), r.salePrice()));
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PartResponse update(Long id, UpdatePartRequest r) {
        rules.validate(r);
        var e = access.lock(Part.class, id);
        apply(e, r);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PartResponse activate(Long id) {
        var e = access.lock(Part.class, id);
        e.setStatus(ActiveStatus.ACTIVE);
        return save(e);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PartResponse deactivate(Long id) {
        var e = access.lock(Part.class, id);
        e.setStatus(ActiveStatus.INACTIVE);
        return save(e);
    }

    private void apply(Part e, UpdatePartRequest r) {
        repository.findByPartCode(r.partCode().trim()).filter(x -> !Objects.equals(x.getId(), e.getId())).ifPresent(x -> {
            throw new DuplicateResourceException("Part code already exists");
        });
        e.setPartCode(BusinessRules.text(r.partCode()));
        e.setName(BusinessRules.text(r.name()));
        e.setBrand(BusinessRules.text(r.brand()));
        e.setVariant(BusinessRules.text(r.variant()));
        e.setSalePrice(r.salePrice());

    }

    private PartResponse save(Part e) {
        try {
            return mapper.map(repository.saveAndFlush(e));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("Part conflicts with an existing unique key");
        }
    }
}
