package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.dto.request.SlotRule;
import java.util.List;

public record WeeklyScheduleResponse(Long branchId, int weekday, boolean enabled, List<SlotRule> slots) { }
