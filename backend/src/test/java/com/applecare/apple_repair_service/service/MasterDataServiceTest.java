package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateDeviceTypeRequest;
import com.applecare.apple_repair_service.dto.request.CreatePartRequest;
import com.applecare.apple_repair_service.dto.request.CreateServiceCatalogItemRequest;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceIssue;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.SystemSetting;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.DeviceTypeRepository;
import com.applecare.apple_repair_service.repository.AdminReferenceRepository;
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
        var service = new PartService(repo, mock(DomainAccess.class), rules, new EntityResponses(), mock(AdminReferenceRepository.class));
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
        var service = new ServiceCatalogService(repo, access, rules, new EntityResponses(), mock(AdminReferenceRepository.class));
        assertThrows(BusinessRuleViolationException.class, () -> service.create(new CreateServiceCatalogItemRequest(1L, 2L, 3L, null, "Replace", BigDecimal.TEN, 30, 90)));
        verifyNoInteractions(repo);
    }

    @Test
    void warrantyConfigurationRequiresOnlyTechnicalRemedy() {
        var access = mock(DomainAccess.class);
        var repo = mock(ServiceCatalogItemRepository.class);
        var deviceType = new DeviceType(); deviceType.setId(1L);
        var model = new DeviceModel(); model.setId(1L); model.setName("iPhone 16 Pro"); model.setDeviceType(deviceType);
        var issue = new ServiceIssue(); issue.setId(3L); issue.setName("Pin"); issue.getDeviceTypes().add(deviceType);
        var repairType = new ServiceType(); repairType.setId(2L); repairType.setCode(ServiceTypeCode.REPAIR); repairType.setName("Sửa chữa");
        when(access.get(DeviceModel.class, 1L)).thenReturn(model);
        when(access.get(ServiceType.class, 2L)).thenReturn(repairType);
        when(access.get(ServiceIssue.class, 3L)).thenReturn(issue);
        var service = new ServiceCatalogService(repo, access, rules, new EntityResponses(), mock(AdminReferenceRepository.class));
        assertThrows(BusinessRuleViolationException.class, () -> service.create(new CreateServiceCatalogItemRequest(
                1L, 2L, 3L, null, "Sửa nguồn", BigDecimal.TEN, 30, 90, null, null)));

        when(repo.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        assertDoesNotThrow(() -> service.create(new CreateServiceCatalogItemRequest(
                1L, 2L, 3L, null, "Sửa nguồn", BigDecimal.TEN, 30, 90, WarrantyRemedy.REPLACEMENT, null)));
        verify(repo).saveAndFlush(any(ServiceCatalogItem.class));
    }

    @Test
    void replacementServiceCanUseRepairWarrantyWithoutReplacementCatalog() {
        var access = mock(DomainAccess.class);
        var repo = mock(ServiceCatalogItemRepository.class);
        var deviceType = new DeviceType(); deviceType.setId(1L);
        var model = new DeviceModel(); model.setId(1L); model.setName("16 Pro"); model.setDeviceType(deviceType);
        var issue = new ServiceIssue(); issue.setId(3L); issue.setName("Pin"); issue.getDeviceTypes().add(deviceType);
        var replacementType = new ServiceType(); replacementType.setId(2L); replacementType.setCode(ServiceTypeCode.REPLACEMENT); replacementType.setName("Thay thế linh kiện");
        var part = new Part(); part.setId(7L); part.setName("Pin iPhone 16 Pro"); part.setBrand("Pisen"); part.setVariant("Dung lượng cao");
        when(access.get(DeviceModel.class, 1L)).thenReturn(model);
        when(access.get(ServiceType.class, 2L)).thenReturn(replacementType);
        when(access.get(ServiceIssue.class, 3L)).thenReturn(issue);
        when(access.get(Part.class, 7L)).thenReturn(part);
        when(repo.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new ServiceCatalogService(repo, access, rules, new EntityResponses(), mock(AdminReferenceRepository.class));

        service.create(new CreateServiceCatalogItemRequest(1L, 2L, 3L, 7L, null,
                BigDecimal.TEN, 60, 180, WarrantyRemedy.REPAIR, null));
        var repairCaptor = org.mockito.ArgumentCaptor.forClass(ServiceCatalogItem.class);
        verify(repo).saveAndFlush(repairCaptor.capture());
        assertNull(repairCaptor.getValue().getWarrantyReplacementCatalog());
        assertEquals("Thay pin iPhone 16 Pro — Pisen Dung lượng cao", repairCaptor.getValue().getName());
    }

    @Test
    void replacementWarrantyCharacteristicDoesNotBindAnotherCatalog() {
        var access = mock(DomainAccess.class);
        var repo = mock(ServiceCatalogItemRepository.class);
        var deviceType = new DeviceType(); deviceType.setId(1L);
        var model = new DeviceModel(); model.setId(1L); model.setName("16 Pro"); model.setDeviceType(deviceType);
        var issue = new ServiceIssue(); issue.setId(3L); issue.setName("Pin"); issue.getDeviceTypes().add(deviceType);
        var replacementType = new ServiceType(); replacementType.setId(2L); replacementType.setCode(ServiceTypeCode.REPLACEMENT); replacementType.setName("Thay thế linh kiện");
        var currentPart = new Part(); currentPart.setId(7L); currentPart.setName("Pin dung lượng cao");
        var warrantyPart = new Part(); warrantyPart.setId(8L); warrantyPart.setName("Pin tiêu chuẩn");
        var warrantyCatalog = new ServiceCatalogItem(); warrantyCatalog.setId(9L); warrantyCatalog.setName("Thay pin tiêu chuẩn");
        warrantyCatalog.setDeviceModel(model); warrantyCatalog.setServiceIssue(issue); warrantyCatalog.setServiceType(replacementType);
        warrantyCatalog.setPart(warrantyPart); warrantyCatalog.setStandardDurationMinutes(45);
        when(access.get(DeviceModel.class, 1L)).thenReturn(model);
        when(access.get(ServiceType.class, 2L)).thenReturn(replacementType);
        when(access.get(ServiceIssue.class, 3L)).thenReturn(issue);
        when(access.get(Part.class, 7L)).thenReturn(currentPart);
        when(repo.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new ServiceCatalogService(repo, access, rules, new EntityResponses(), mock(AdminReferenceRepository.class));

        service.create(new CreateServiceCatalogItemRequest(1L, 2L, 3L, 7L, null,
                BigDecimal.TEN, 60, 180, WarrantyRemedy.REPLACEMENT, 9L));

        var captor = org.mockito.ArgumentCaptor.forClass(ServiceCatalogItem.class);
        verify(repo).saveAndFlush(captor.capture());
        assertEquals(WarrantyRemedy.REPLACEMENT, captor.getValue().getWarrantyRemedy());
        assertNull(captor.getValue().getWarrantyReplacementCatalog());
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
        var service = new DeviceTypeService(repo, mock(DomainAccess.class), rules, new EntityResponses(), mock(AdminReferenceRepository.class), mock(com.applecare.apple_repair_service.repository.ServiceIssueRepository.class));
        assertThrows(DuplicateResourceException.class, () -> service.create(new CreateDeviceTypeRequest(" iPhone ")));
        verify(repo, never()).saveAndFlush(any());
    }
}
