package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;

/** Shared validation for a new booking or a newly selected repair plan. */
final class CatalogPolicy {
    private CatalogPolicy() {}

    static void requireModel(DeviceModel model) {
        BusinessRules.require(model != null && model.getStatus() == ActiveStatus.ACTIVE,
                "Dòng thiết bị hiện không còn được hỗ trợ.");
        BusinessRules.require(model.getDeviceType() != null && model.getDeviceType().getStatus() == ActiveStatus.ACTIVE,
                "Loại thiết bị hiện không còn được hỗ trợ.");
    }

    static void requireUsable(ServiceCatalogItem catalog, Long modelId) {
        BusinessRules.require(catalog.getStatus() == ActiveStatus.ACTIVE, "Dịch vụ hiện đã ngừng sử dụng.");
        requireModel(catalog.getDeviceModel());
        BusinessRules.require(catalog.getDeviceModel().getId().equals(modelId),
                "Dịch vụ không phù hợp với dòng thiết bị đã chọn.");
        var issue = catalog.getServiceIssue();
        BusinessRules.require(issue != null && issue.getStatus() == ActiveStatus.ACTIVE,
                "Vấn đề dịch vụ hiện đã ngừng sử dụng.");
        var typeId = catalog.getDeviceModel().getDeviceType().getId();
        BusinessRules.require(issue.getDeviceTypes().stream().anyMatch(type -> type.getId().equals(typeId)),
                "Vấn đề dịch vụ không áp dụng cho loại thiết bị này.");
        var serviceType = catalog.getServiceType();
        BusinessRules.require(serviceType != null && serviceType.getStatus() == ActiveStatus.ACTIVE
                        && serviceType.getCode() != null,
                "Loại dịch vụ hiện không khả dụng.");
        var part = catalog.getPart();
        BusinessRules.require(serviceType.getCode() != ServiceTypeCode.REPLACEMENT || part != null,
                "Dịch vụ thay thế chưa được cấu hình linh kiện.");
        BusinessRules.require(part == null || part.getStatus() == ActiveStatus.ACTIVE,
                "Linh kiện của dịch vụ hiện đã ngừng sử dụng.");
    }
}
