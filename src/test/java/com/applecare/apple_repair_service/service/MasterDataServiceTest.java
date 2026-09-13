package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateDeviceTypeRequest;
import com.applecare.apple_repair_service.dto.request.CreatePartRequest;
import com.applecare.apple_repair_service.dto.request.CreateServiceCatalogItemRequest;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.SystemSetting;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.DeviceTypeRepository;
import com.applecare.apple_repair_service.repository.PartRepository;
import com.applecare.apple_repair_service.repository.ServiceCatalogItemRepository;
import com.applecare.apple_repair_service.repository.SystemSettingRepository;
import jakarta.validation.Validation;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MasterDataServiceTest {
    private final BusinessRules rules = new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator());

    @Test
    void partRejectsNegativePriceBeforePersistence() {
        var repo = mock(PartRepository.class);
        var service = new PartService(repo, mock(DomainAccess.class), rules, new EntityResponses());
        assertThrows(BusinessRuleViolationException.class, () -> service.create(new CreatePartRequest("P", "Pin", null, null, new BigDecimal("-1"))));
        verifyNoInteractions(repo);
    }

    @Test
    void replacementRequiresPart() {
        var access = mock(DomainAccess.class);
        var repo = mock(ServiceCatalogItemRepository.class);
        var type = new ServiceType();
        type.setCode(ServiceTypeCode.REPLACEMENT);
        when(access.get(ServiceType.class, 2L)).thenReturn(type);
        var service = new ServiceCatalogService(repo, access, rules, new EntityResponses());
        assertThrows(BusinessRuleViolationException.class, () -> service.create(new CreateServiceCatalogItemRequest(1L, 2L, 3L, null, "Replace", BigDecimal.TEN, 30, 90)));
        verifyNoInteractions(repo);
    }

    @Test
    void malformedSettingIsBusinessError() {
        var repo = mock(SystemSettingRepository.class);
        var e = new SystemSetting();
        e.setSettingValue("abc");
        when(repo.findBySettingKey("K")).thenReturn(Optional.of(e));
        var service = new SystemSettingService(repo, rules, new EntityResponses());
        assertThrows(BusinessRuleViolationException.class, () -> service.getInteger("K"));
        assertThrows(BusinessRuleViolationException.class, () -> service.getDecimal("K"));
    }

    @Test
    void duplicateNameIsCaseInsensitiveAndWhitespaceNormalized() {
        var repo = mock(DeviceTypeRepository.class);
        var existing = new DeviceType();
        existing.setId(2L);
        when(repo.findByNameIgnoreCase("iPhone")).thenReturn(Optional.of(existing));
        var service = new DeviceTypeService(repo, mock(DomainAccess.class), rules, new EntityResponses());
        assertThrows(DuplicateResourceException.class, () -> service.create(new CreateDeviceTypeRequest(" iPhone ")));
        verify(repo, never()).saveAndFlush(any());
    }
}
