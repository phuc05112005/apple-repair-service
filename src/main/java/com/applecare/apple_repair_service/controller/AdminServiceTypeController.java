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
@RequestMapping("/api/v1/admin/service-types")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminServiceTypeController {
    private final ServiceTypeService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceTypeResponse create(@Valid @RequestBody CreateServiceTypeRequest request) { return service.create(request); }
    @GetMapping
    public List<ServiceTypeResponse> list() { return service.list(); }
    @GetMapping("/{id}")
    public ServiceTypeResponse get(@PathVariable @Positive Long id) { return service.getById(id); }
    @PutMapping("/{id}")
    public ServiceTypeResponse update(@PathVariable @Positive Long id, @Valid @RequestBody UpdateServiceTypeRequest request) {
        return service.update(id, request);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Positive Long id) { service.delete(id); }
    @PostMapping("/{id}/activate")
    public ServiceTypeResponse activate(@PathVariable @Positive Long id) { return service.activate(id); }
    @PostMapping("/{id}/deactivate")
    public ServiceTypeResponse deactivate(@PathVariable @Positive Long id) { return service.deactivate(id); }
}
