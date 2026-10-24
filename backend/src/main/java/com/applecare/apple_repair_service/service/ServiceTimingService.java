package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Transactional(propagation=Propagation.MANDATORY)
public class ServiceTimingService {
 private final AssignmentRepository assignments;
 private final TechnicianScheduleRepository schedules;
 private final ServiceTicketRepository tickets;
 private final RepairItemRepository items;
 private final ServiceStatusHistoryRepository statusHistory;
 private final ServiceTimeEstimateHistoryRepository estimates;
 private final TimingSettings settings;
 private final Clock clock;

 public void created(ServiceTicket ticket,User actor) {
  ticket.setAssignmentDueAt(ticket.getReceivedAt().plusMinutes(settings.values().assignmentMinutes()));
  recalculate(ticket,actor,"CREATED");
  // Only the creation event may set the initial promise. Legacy rows remain unknown.
  ticket.setInitialEstimatedStartAt(ticket.getEstimatedStartAt());
  ticket.setInitialEstimatedCompletionAt(ticket.getEstimatedCompletionAt());
 }
 public void statusChanged(ServiceTicket t,ServiceTicketStatus previous,User actor) {
  var now=LocalDateTime.now(clock);var next=t.getStatus();
  if(next==ServiceTicketStatus.HANDED_OVER)return;
  String reason=next.name();
  if(next==ServiceTicketStatus.INSPECTING || next==ServiceTicketStatus.REPAIRING) {
   if(t.getActualRepairStartedAt()==null)t.setActualRepairStartedAt(now);
   reason=previous==ServiceTicketStatus.WAITING_PART || previous==ServiceTicketStatus.WAITING_APPROVAL ? "RESUME" : previous==ServiceTicketStatus.ASSIGNED ? "ACTUAL_START" : next.name();
  }
  if(next==ServiceTicketStatus.WAITING_HANDOVER && t.getActualRepairCompletedAt()==null)t.setActualRepairCompletedAt(now);
  recalculate(t,actor,reason);
 }
 public void planChanged(ServiceTicket t,User actor) {recalculate(t,actor,"SERVICE_PLAN_CHANGE");}
 public void transferred(ServiceTicket t,User actor) {recalculate(t,actor,"TRANSFER");}
 public void assignmentPrediction(ServiceTicket t,User technician,long minutes,User actor) {
  BusinessRules.require(minutes>0,"Thời lượng kỹ thuật dự đoán phải lớn hơn 0.");
  BusinessRules.require(t.getStatus()==ServiceTicketStatus.ASSIGNED,"Chỉ tinh chỉnh ETA sau khi phân công thành công.");
  recalculate(t,actor,"ML_ASSIGNMENT_REFINEMENT",minutes);
 }
 public void manual(ServiceTicket t,LocalDateTime start,LocalDateTime completion,long minutes,User actor,String reason) {
  BusinessRules.require(!terminal(t) && !waiting(t),"Chỉ điều chỉnh ETA cho phiếu đang có thể xử lý.");
  BusinessRules.require(!completion.isBefore(start) && completion.isAfter(LocalDateTime.now(clock)),"ETA hoàn thành phải sau thời điểm hiện tại và không trước thời điểm bắt đầu.");
  t.setEstimatedStartAt(start);t.setEstimatedCompletionAt(completion);t.setEstimatedDurationMinutes(minutes);t.setEstimateSource(EstimateSource.MANUAL);
  recalculate(t,actor,"MANUAL: "+BusinessRules.required(reason,"Lý do điều chỉnh ETA"));
 }

 private void recalculate(ServiceTicket trigger,User actor,String reason) {recalculate(trigger,actor,reason,null);}
 private void recalculate(ServiceTicket trigger,User actor,String reason,Long triggerDurationOverride) {
  var now=LocalDateTime.now(clock);var config=settings.values();
  var active=assignments.findTimingAssignments();
  var unassigned=tickets.findUnassignedForTiming();
  var all=new LinkedHashMap<Long,ServiceTicket>();all.put(trigger.getId(),trigger);
  active.forEach(a->all.put(a.getServiceTicket().getId(),a.getServiceTicket()));unassigned.forEach(t->all.put(t.getId(),t));
  var itemMap=items.findTimingItems(all.keySet()).stream().collect(Collectors.groupingBy(i->i.getServiceTicket().getId()));
  var historyMap=statusHistory.findTimingHistories(all.keySet()).stream().collect(Collectors.groupingBy(h->h.getServiceTicket().getId()));
  var shifts=schedules.findTimingSchedules(now.toLocalDate(),now.toLocalDate().plusDays(TimingSettings.SCHEDULE_HORIZON_DAYS));
  var workers=new TreeMap<Long,User>();shifts.forEach(s->workers.put(s.getTechnician().getId(),s.getTechnician()));
  var cursors=new HashMap<Long,LocalDateTime>();
  for(var row:assignments.latestTechnicalCompletions())cursors.put((Long)row[0],max(now,((LocalDateTime)row[1]).plusMinutes(config.breakMinutes())));
  var blocked=new HashSet<Long>();
  var byWorker=active.stream().collect(Collectors.groupingBy(a->a.getTechnician().getId()));
  var durationMap=new HashMap<Long,Long>();
  for(var t:all.values())durationMap.put(t.getId(),t.getId().equals(trigger.getId()) && triggerDurationOverride!=null
          ?triggerDurationOverride:estimate(t,itemMap.getOrDefault(t.getId(),List.of()),t==trigger && reason.equals("SERVICE_PLAN_CHANGE")));
  for(var worker:byWorker.entrySet()) {
   long workerId=worker.getKey();var queue=new ArrayList<>(worker.getValue());
   queue.sort(Comparator.comparingInt((Assignment a)->active(a.getServiceTicket())?0:1)
           .thenComparing(Assignment::getAssignedAt).thenComparing(Assignment::getId));
   for(var assignment:queue) {
    var t=assignment.getServiceTicket();if(terminal(t)||waiting(t))continue;
    long minutes=durationMap.get(t.getId());long elapsed=elapsed(historyMap.getOrDefault(t.getId(),List.of()),now);
    long remaining=Math.max(0,minutes-elapsed);
    var earliest=cursors.getOrDefault(workerId,now);boolean isTrigger=t.getId().equals(trigger.getId());
    if(isTrigger && active(t))earliest=now;
    var range=blocked.contains(workerId)?new WorkCalendar.Estimate(null,null):WorkCalendar.allocate(earliest,remaining,windows(shifts,workerId,t.getBranch().getId()));
    if(isTrigger && active(t) && (reason.equals("ACTUAL_START") || reason.equals("RESUME")))
     range=new WorkCalendar.Estimate(now,range.completion());
    if(isTrigger && active(t) && !reason.equals("ACTUAL_START") && !reason.equals("RESUME"))
     range=new WorkCalendar.Estimate(t.getEstimatedStartAt()!=null?t.getEstimatedStartAt():t.getActualRepairStartedAt(),range.completion());
    if(isTrigger && reason.startsWith("MANUAL:"))range=new WorkCalendar.Estimate(t.getEstimatedStartAt(),t.getEstimatedCompletionAt());
    // Running work keeps its deadline until an explicit event on that work changes it.
    if(active(t) && !isTrigger && t.getEstimatedDurationMinutes()!=null) {
     if(range.completion()!=null)cursors.put(workerId,max(now,range.completion()).plusMinutes(config.breakMinutes()));else blocked.add(workerId);
     continue;
    }
    apply(t,range,minutes,assignment.getTechnician(),isTrigger?reason:"QUEUE_RECALCULATED",actor,config.breakMinutes(),itemMap.getOrDefault(t.getId(),List.of()),isTrigger,now);
    if(range.completion()==null)blocked.add(workerId);else cursors.put(workerId,max(now,range.completion()).plusMinutes(config.breakMinutes()));
   }
  }
  // Provisional FIFO reservations prevent multiple unassigned tickets claiming the same free time.
  // They are estimates only: never create or modify an Assignment.
  for(var t:unassigned) {
   WorkCalendar.Estimate best=null;Long selected=null;long minutes=durationMap.get(t.getId());
   for(var worker:workers.entrySet()) {
    if(blocked.contains(worker.getKey()))continue;
    var candidate=WorkCalendar.allocate(cursors.getOrDefault(worker.getKey(),now),minutes,windows(shifts,worker.getKey(),t.getBranch().getId()));
    if(candidate.completion()!=null && (best==null || candidate.completion().isBefore(best.completion()))) {best=candidate;selected=worker.getKey();}
   }
   boolean isTrigger=t.getId().equals(trigger.getId());
   if(isTrigger && reason.startsWith("MANUAL:"))best=new WorkCalendar.Estimate(t.getEstimatedStartAt(),t.getEstimatedCompletionAt());
   if(best==null)best=new WorkCalendar.Estimate(null,null);
   apply(t,best,minutes,null,isTrigger?reason:"QUEUE_RECALCULATED",actor,config.breakMinutes(),itemMap.getOrDefault(t.getId(),List.of()),isTrigger,now);
   if(selected!=null && best.completion()!=null)cursors.put(selected,best.completion().plusMinutes(config.breakMinutes()));
  }
  if(waiting(trigger))apply(trigger,new WorkCalendar.Estimate(null,null),durationMap.get(trigger.getId()),assignedUser(active,trigger.getId()),reason,actor,config.breakMinutes(),itemMap.getOrDefault(trigger.getId(),List.of()),true,now);
  else if(terminal(trigger))snapshot(trigger,assignedUser(active,trigger.getId()),reason,actor,config.breakMinutes(),itemMap.getOrDefault(trigger.getId(),List.of()),now);
  else if(trigger.getStatus()!=ServiceTicketStatus.WAITING_ASSIGNMENT && active.stream().noneMatch(a->a.getServiceTicket().getId().equals(trigger.getId()))) {
   // Legacy/incomplete assignment data: expose unknown ETA rather than invent a technician.
   apply(trigger,new WorkCalendar.Estimate(null,null),durationMap.get(trigger.getId()),null,reason+": NO_ASSIGNMENT",actor,config.breakMinutes(),itemMap.getOrDefault(trigger.getId(),List.of()),true,now);
  }
 }
 private User assignedUser(List<Assignment> active,Long id){return active.stream().filter(a->a.getServiceTicket().getId().equals(id)).map(Assignment::getTechnician).findFirst().orElse(null);}
 private List<WorkCalendar.Window> windows(List<TechnicianSchedule> shifts,long technician,long branch) {
  return shifts.stream().filter(s->s.getTechnician().getId()==technician && s.getBranch().getId()==branch)
    .map(s->new WorkCalendar.Window(s.getWorkDate().atTime(s.getStartTime()),s.getWorkDate().atTime(s.getEndTime()))).toList();
 }
 private long estimate(ServiceTicket t,List<RepairItem> selected,boolean changedPlan) {
  if(!changedPlan && t.getEstimateSource()==EstimateSource.MANUAL && t.getEstimatedDurationMinutes()!=null)return t.getEstimatedDurationMinutes();
   long total=selected.stream().filter(i->i.getApprovalStatus()!=ApprovalStatus.REJECTED)
   .map(i->i.getWarrantyReplacementCatalog()!=null?i.getWarrantyReplacementCatalog():i.getServiceCatalogItem())
   .filter(c->c.getStatus()==ActiveStatus.ACTIVE).map(ServiceCatalogItem::getStandardDurationMinutes).filter(Objects::nonNull).filter(n->n>0).mapToLong(Integer::longValue).sum();
  if(changedPlan)t.setEstimateSource(EstimateSource.STANDARD);
  if(total>0)return total;
  BusinessRules.require(t.getEstimatedDurationMinutes()!=null && t.getEstimatedDurationMinutes()>0,
          "Phiếu dịch vụ chưa có thời lượng tiêu chuẩn hợp lệ.");
  return t.getEstimatedDurationMinutes();
 }
 private long elapsed(List<ServiceStatusHistory> history,LocalDateTime now) {
  try{return RepairDurationService.calculate(history,now);}catch(com.applecare.apple_repair_service.exception.BusinessRuleViolationException ex){return 0;}
 }
 private void apply(ServiceTicket t,WorkCalendar.Estimate range,long minutes,User technician,String reason,User actor,int pause,List<RepairItem> selected,boolean force,LocalDateTime now) {
  boolean changed=!Objects.equals(t.getEstimatedStartAt(),range.start())||!Objects.equals(t.getEstimatedCompletionAt(),range.completion())||!Objects.equals(t.getEstimatedDurationMinutes(),minutes);
  t.setEstimatedStartAt(range.start());t.setEstimatedCompletionAt(range.completion());t.setEstimatedDurationMinutes(minutes);
  if(t.getEstimateSource()==null)t.setEstimateSource(EstimateSource.STANDARD);
  if(changed||force)snapshot(t,technician,reason,actor,pause,selected,now);
 }
 private void snapshot(ServiceTicket t,User technician,String reason,User actor,int pause,List<RepairItem> selected,LocalDateTime now) {
  var h=new ServiceTimeEstimateHistory();h.setServiceTicket(t);h.setTechnician(technician);h.setEstimatedStartAt(t.getEstimatedStartAt());h.setEstimatedCompletionAt(t.getEstimatedCompletionAt());h.setEstimatedDurationMinutes(t.getEstimatedDurationMinutes());
  h.setEstimateSource(t.getEstimateSource()==null?EstimateSource.STANDARD:t.getEstimateSource());h.setReason(reason);h.setCreatedBy(actor);h.setCreatedAt(now);h.setBreakMinutesSnapshot(pause);
  var approved=selected.stream().filter(i->i.getApprovalStatus()==ApprovalStatus.APPROVED).toList();
  if(approved.stream().allMatch(i->i.getFinalPrice()!=null))h.setApprovedPriceSnapshot(approved.stream().map(RepairItem::getFinalPrice).reduce(BigDecimal.ZERO,BigDecimal::add));
  estimates.save(h);
 }
 private static LocalDateTime max(LocalDateTime a,LocalDateTime b){return a.isAfter(b)?a:b;}
 private static boolean waiting(ServiceTicket t){return t.getStatus()==ServiceTicketStatus.WAITING_PART || t.getStatus()==ServiceTicketStatus.WAITING_APPROVAL;}
 private static boolean active(ServiceTicket t){return t.getStatus()==ServiceTicketStatus.INSPECTING || t.getStatus()==ServiceTicketStatus.REPAIRING;}
 private static boolean terminal(ServiceTicket t){return t.getStatus()==ServiceTicketStatus.WAITING_HANDOVER || t.getStatus()==ServiceTicketStatus.HANDED_OVER || t.getStatus()==ServiceTicketStatus.CANCELLED;}
}
