package com.applecare.apple_repair_service.controller;
import com.applecare.apple_repair_service.dto.command.DefectiveStatusCommand;
import com.applecare.apple_repair_service.dto.response.DefectivePartReturnResponse;
import com.applecare.apple_repair_service.enums.DefectivePartStatus;
import com.applecare.apple_repair_service.service.*;
import com.applecare.apple_repair_service.security.CurrentActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
@RestController @RequestMapping("/api/v1") @RequiredArgsConstructor
public class DefectiveInventoryController {
 private final DefectiveInventoryService inventory;private final TimingQueryService queries;private final CurrentActor actor;
 @GetMapping("/admin/defective-part-returns") @PreAuthorize("hasRole('ADMIN')")
 public List<DefectivePartReturnResponse> list(@RequestParam(required=false) @Positive Long branchId,@RequestParam(required=false) @Positive Long partId,@RequestParam(required=false) DefectivePartStatus status) {return inventory.list(branchId,partId,status,null);}
 @PutMapping("/admin/defective-part-returns/{id}/status") @PreAuthorize("hasRole('ADMIN')")
 public DefectivePartReturnResponse status(@PathVariable @Positive Long id,@Valid @RequestBody DefectiveStatusCommand request) {return inventory.changeStatus(id,request,actor.id());}
 @GetMapping("/internal/service-tickets/{id}/defective-part-returns") @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN')")
 public List<DefectivePartReturnResponse> ticket(@PathVariable @Positive Long id) {return queries.defective(id);}
}
