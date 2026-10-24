package com.applecare.apple_repair_service.controller;
import com.applecare.apple_repair_service.dto.command.ManualEtaCommand;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
@RestController @RequestMapping("/api/v1/internal/service-tickets") @RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN')")
public class ServiceTimingController {
 private final TimingQueryService queries;
 private final TimingMetricsService metrics;
 @GetMapping("/{id}/timing-metrics")
 public TicketTimingMetricsResponse metrics(@PathVariable @Positive Long id) {return metrics.metrics(id);}
 @GetMapping("/{id}/time-estimates")
 public List<ServiceTimeEstimateResponse> history(@PathVariable @Positive Long id){return queries.history(id);}
 @PutMapping("/{id}/eta") @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
 public TicketTimingResponse manual(@PathVariable @Positive Long id,@Valid @RequestBody ManualEtaCommand request) {
  return queries.manual(id,request);
 }
}
