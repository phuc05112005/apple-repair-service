package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreatePartRequest(
        @NotBlank @Size(max = 255) String partCode, @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String brand, @Size(max = 255) String variant,
        @NotNull @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal salePrice
) {
}
