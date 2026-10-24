package com.applecare.apple_repair_service.dto.response;
import com.applecare.apple_repair_service.enums.DefectivePartStatus;
import java.time.LocalDateTime;
public record DefectivePartReturnResponse(Long id,Long branchId,String branchName,Long partId,String partName,Long sourcePartUsageId,Long repairItemId,Long ticketId,String ticketCode,int quantity,DefectivePartStatus status,String reason,String note,Long recordedById,LocalDateTime receivedAt,Long statusChangedById,LocalDateTime statusChangedAt) {}
