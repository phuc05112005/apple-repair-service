package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/service-issues")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminServiceIssueController {
    private final ServiceIssueService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceIssueResponse create(@Valid @RequestBody CreateServiceIssueRequest request) { return service.create(request); }
    @GetMapping
    public List<ServiceIssueResponse> list() { return service.list(); }
    @GetMapping("/{id}")
    public ServiceIssueResponse get(@PathVariable @Positive Long id) { return service.getById(id); }
    @PutMapping("/{id}")
    public ServiceIssueResponse update(@PathVariable @Positive Long id, @Valid @RequestBody UpdateServiceIssueRequest request) {
        return service.update(id, request);
    }
    @PostMapping("/{id}/activate")
    public ServiceIssueResponse activate(@PathVariable @Positive Long id) { return service.activate(id); }
    @PostMapping("/{id}/deactivate")
    public ServiceIssueResponse deactivate(@PathVariable @Positive Long id) { return service.deactivate(id); }
}

