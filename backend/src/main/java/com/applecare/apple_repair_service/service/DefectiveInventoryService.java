package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.repository.DefectivePartReturnRepository;
import com.applecare.apple_repair_service.dto.command.DefectiveStatusCommand;
import com.applecare.apple_repair_service.dto.response.DefectivePartReturnResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.*;
import java.util.*;
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class DefectiveInventoryService {
 private final DefectivePartReturnRepository repository;
 private final DomainAccess access;
 private final BusinessRules rules;
 private final Clock clock;
 @Transactional(propagation=Propagation.MANDATORY)
 public DefectivePartReturn record(PartUsage usage,Part removedPart,String reason) {
  BusinessRules.require(usage.getStatus()==PartUsageStatus.ACTIVE,"Chỉ ghi nhận thu hồi cho lần xuất linh kiện đang có hiệu lực.");
  // Caller holds the ticket lock. The unique usage FK also protects concurrent retries.
  var previous=repository.findBySourcePartUsage_Id(usage.getId());
  if(previous.isPresent()) {
   BusinessRules.require(previous.get().getPart().getId().equals(removedPart.getId()) && previous.get().getQuantity().equals(usage.getQuantity()),"Lần thay này đã có biên nhận thu hồi khác.");
   return previous.get();
  }
  var d=new DefectivePartReturn();d.setBranch(usage.getRepairItem().getServiceTicket().getBranch());d.setPart(removedPart);
  d.setSourcePartUsage(usage);d.setQuantity(usage.getQuantity());d.setReason(BusinessRules.required(reason,"Mô tả linh kiện lỗi"));
  d.setRecordedBy(usage.getRecordedBy());d.setReceivedAt(usage.getUsedAt());return repository.saveAndFlush(d);
 }
 public List<DefectivePartReturnResponse> list(Long branch,Long part,DefectivePartStatus status,Long ticket) {return repository.search(branch,part,status,ticket).stream().map(this::response).toList();}
 public long onHand(Long branch,Long part) {return repository.onHand(branch,part);}
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public DefectivePartReturnResponse changeStatus(Long id,DefectiveStatusCommand request,Long actorId) {
  rules.validate(request);var d=access.lock(DefectivePartReturn.class,id);var old=d.getStatus();
  BusinessRules.require(old!=request.status(),"Linh kiện đã ở trạng thái này.");
  BusinessRules.require(old==DefectivePartStatus.IN_STOCK || old==DefectivePartStatus.SENT_TO_SUPPLIER,"Biên nhận đã kết thúc xử lý.");
  d.setStatus(request.status());d.setStatusChangedBy(access.get(User.class,actorId));d.setStatusChangedAt(LocalDateTime.now(clock));
  d.setNote((d.getNote()==null?"":d.getNote()+"\n")+d.getStatusChangedAt()+" · "+old+" → "+request.status()+" · "+request.note().trim());
  return response(d);
 }
 private DefectivePartReturnResponse response(DefectivePartReturn d) {
  var i=d.getSourcePartUsage().getRepairItem();var t=i.getServiceTicket();
  return new DefectivePartReturnResponse(d.getId(),d.getBranch().getId(),d.getBranch().getName(),d.getPart().getId(),d.getPart().getName(),d.getSourcePartUsage().getId(),i.getId(),t.getId(),t.getTicketCode(),d.getQuantity(),d.getStatus(),d.getReason(),d.getNote(),d.getRecordedBy().getId(),d.getReceivedAt(),d.getStatusChangedBy()==null?null:d.getStatusChangedBy().getId(),d.getStatusChangedAt());
 }
}
