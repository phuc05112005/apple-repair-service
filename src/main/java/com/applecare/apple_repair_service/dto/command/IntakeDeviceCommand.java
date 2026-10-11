package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
import java.util.List;

public record IntakeDeviceCommand(@Size(max=255) String serialNumber, @Size(max=255) String storage,
                                  @Size(max=5000) String receivedCondition,
                                  @Size(min=1, max=10) List<@NotNull @Positive Long> serviceCatalogItemIds) {
    public IntakeDeviceCommand(String serialNumber, String storage, String receivedCondition) {
        this(serialNumber, storage, receivedCondition, null);
    }
}
