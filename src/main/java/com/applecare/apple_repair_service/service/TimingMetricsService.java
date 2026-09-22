package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.response.TicketTimingMetricsResponse;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class TimingMetricsService {
 private final DomainAccess access;private final TicketAccessPolicy policy;private final ServiceStatusHistoryRepository histories;
 private final AssignmentRepository assignments;private final TransferRepository transfers;private final ServiceTimeEstimateHistoryRepository estimates;
 private final RepairDurationService duration;private final Clock clock;
 public TicketTimingMetricsResponse metrics(Long id) {
  policy.requireRead(id);return calculate(id);
 }
 // Internal calculation is also used in integration tests; endpoint always enforces ticket access.
 TicketTimingMetricsResponse calculate(Long id) {
  var t=access.get(ServiceTicket.class,id);var now=t.getActualRepairCompletedAt()==null?LocalDateTime.now(clock):t.getActualRepairCompletedAt();
  var hs=histories.findAllByServiceTicket_IdOrderByChangedAtAsc(id).stream().sorted(Comparator.comparing(ServiceStatusHistory::getChangedAt).thenComparing(ServiceStatusHistory::getId)).toList();
  var as=assignments.findAllByServiceTicket_IdOrderByAssignedAtAsc(id);var es=estimates.findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(id);
  Long active=null;boolean complete=!hs.isEmpty();
  try{if(complete)active=RepairDurationService.calculate(hs,now);}catch(com.applecare.apple_repair_service.exception.BusinessRuleViolationException ex){complete=false;}
  var byTech=new LinkedHashMap<Long,Long>();
  if(complete) for(var a:as) {
   long seconds=0;
   for(int i=0;i<hs.size();i++) {
    var h=hs.get(i);if(h.getToStatus()!=ServiceTicketStatus.REPAIRING)continue;
    var end=i+1<hs.size()?hs.get(i+1).getChangedAt():now;
    var start=max(h.getChangedAt(),a.getAssignedAt());end=min(end,a.getEndedAt()==null?now:a.getEndedAt());
    if(end.isAfter(start))seconds+=Duration.between(start,end).getSeconds();
   }
   byTech.merge(a.getTechnician().getId(),seconds,Long::sum);
  }
  byTech.replaceAll((k,v)->v/60);
  java.math.BigDecimal priceChange=null;
  if(!es.isEmpty() && es.getFirst().getApprovedPriceSnapshot()!=null && es.getLast().getApprovedPriceSnapshot()!=null)
   priceChange=es.getLast().getApprovedPriceSnapshot().subtract(es.getFirst().getApprovedPriceSnapshot());
  return new TicketTimingMetricsResponse(as.isEmpty()?null:between(t.getReceivedAt(),as.getFirst().getAssignedAt()),
   complete?stateMinutes(hs,ServiceTicketStatus.ASSIGNED,t.getActualRepairStartedAt()==null?now:t.getActualRepairStartedAt()):null,
   delay(t.getInitialEstimatedStartAt(),t.getActualRepairStartedAt()),t.getEstimatedDurationMinutes(),active,
   delay(t.getInitialEstimatedCompletionAt(),t.getActualRepairCompletedAt()),delay(t.getEstimatedCompletionAt(),t.getActualRepairCompletedAt()),
   complete?stateMinutes(hs,ServiceTicketStatus.WAITING_PART,now):null,complete?stateMinutes(hs,ServiceTicketStatus.WAITING_APPROVAL,now):null,
   transfers.findAllByFromAssignment_ServiceTicket_IdOrderByRequestedAtDesc(id).stream().filter(x->x.getStatus()==TransferStatus.ACCEPTED).count(),
   es.stream().filter(x->x.getReason().equals("SERVICE_PLAN_CHANGE")).count(),priceChange,byTech,complete);
 }
 static Long delay(LocalDateTime expected,LocalDateTime actual){Long n=between(expected,actual);return n==null?null:Math.max(0,n);}
 static Long between(LocalDateTime start,LocalDateTime end){return start==null || end==null?null:Duration.between(start,end).toMinutes();}
 static long stateMinutes(List<ServiceStatusHistory> hs,ServiceTicketStatus state,LocalDateTime until) {
  long seconds=0;
  for(int i=0;i<hs.size();i++)if(hs.get(i).getToStatus()==state){var start=hs.get(i).getChangedAt();var end=i+1<hs.size()?min(hs.get(i+1).getChangedAt(),until):until;if(end.isAfter(start))seconds+=Duration.between(start,end).getSeconds();}
  return seconds/60;
 }
 private static LocalDateTime min(LocalDateTime a,LocalDateTime b){return a.isBefore(b)?a:b;}
 private static LocalDateTime max(LocalDateTime a,LocalDateTime b){return a.isAfter(b)?a:b;}
}
