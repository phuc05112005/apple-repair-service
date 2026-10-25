package com.applecare.apple_repair_service.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CreatePartRequest(
        List<Long> deviceModelIds,
        Long serviceIssueId, // <--- Bổ sung trường này
        @NotBlank @Size(max = 255) String partCode,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String brand,
        @Size(max = 255) String variant,
        @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal salePrice,
        @Size(max = 255) String origin,
        @Size(max = 255) String manufacturer,
        @Size(max = 255) String supplier
) {
    public CreatePartRequest(String partCode, String name, String brand, String variant, BigDecimal salePrice) {
        this(null, null, partCode, name, brand, variant, salePrice, null, null, null);
    }

    public CreatePartRequest(String partCode, String name, String brand, String variant, BigDecimal salePrice,
                             String origin, String manufacturer) {
        this(null, null, partCode, name, brand, variant, salePrice, origin, manufacturer, null);
    }
}