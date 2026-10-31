package com.applecare.apple_repair_service.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RepairItemDetailResponse {
    private Long repairItemId;
    private Long serviceTicketId;
    private String serviceType;
    private String serviceName;
    private BigDecimal finalPrice;
    private String partName;
    private String partCode;
    private String partBrand;
    private String partVariant;
    private String approvalStatus;
}