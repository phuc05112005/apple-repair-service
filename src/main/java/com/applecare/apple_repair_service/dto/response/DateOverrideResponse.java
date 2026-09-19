package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.dto.request.SlotRule;
import java.time.LocalDate;
import java.util.List;

public record DateOverrideResponse(Long branchId, LocalDate date, String mode, List<SlotRule> slots) { }
