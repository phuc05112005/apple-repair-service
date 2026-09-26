package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.repository.ServiceTimeEstimateHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class TimingQueryService {
 private final ServiceTimeEstimateHistoryRepository repository;
 private final TicketAccessPolicy policy;
 private final DefectiveInventoryService defectiveInventory;
 private final DomainAccess access;
 private final ServiceTimingService timing;
 private final com.applecare.apple_repair_service.security.CurrentActor actor;
 @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
 @Transactional
 public TicketTimingResponse manual(Long id,com.applecare.apple_repair_service.dto.command.ManualEtaCommand request) {
  var t=access.lock(com.applecare.apple_repair_service.entity.ServiceTicket.class,id);
  timing.manual(t,request.estimatedStartAt(),request.estimatedCompletionAt(),request.estimatedDurationMinutes(),access.get(com.applecare.apple_repair_service.entity.User.class,actor.id()),request.reason());
  return TicketTimingResponse.from(t);
 }

 public List<DefectivePartReturnResponse> defective(Long id){policy.requireRead(id);return defectiveInventory.list(null,null,null,id);}

 public List<ServiceTimeEstimateResponse> history(Long id){policy.requireRead(id);return repository.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(id).stream().map(h->new ServiceTimeEstimateResponse(h.getId(),h.getTechnician()==null?null:h.getTechnician().getId(),h.getEstimatedStartAt(),h.getEstimatedCompletionAt(),h.getEstimatedDurationMinutes(),h.getEstimateSource(),h.getReason(),h.getBreakMinutesSnapshot(),h.getApprovedPriceSnapshot(),h.getCreatedAt(),h.getCreatedBy()==null?null:h.getCreatedBy().getId())).toList();}
}
