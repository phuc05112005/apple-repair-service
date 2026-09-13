package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import com.applecare.apple_repair_service.dto.request.InspectionRepairItemRequest;
import java.util.List;
public record InspectionCommand(@NotBlank @Size(max=5000) String inspectionResult, @NotNull Boolean requiresCustomerApproval,
                                @NotEmpty List<@NotNull @Valid InspectionRepairItemRequest> items) {}
