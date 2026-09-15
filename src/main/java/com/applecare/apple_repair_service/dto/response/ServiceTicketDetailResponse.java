package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record ServiceTicketDetailResponse(ServiceTicketResponse ticket, List<RepairItemResponse> repairItems,
                                          List<ServiceStatusHistoryResponse> history,
                                          TicketContextResponse context) {
}
