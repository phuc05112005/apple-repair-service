package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import java.util.Set;

public record CreateServiceIssueRequest(
        @NotBlank @Size(max = 255) String name,
        @NotEmpty Set<@Positive Long> deviceTypeIds
) {
}
