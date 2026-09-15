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
@RequestMapping("/api/v1/admin/service-catalog-items")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminServiceCatalogController {
    private final ServiceCatalogService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceCatalogItemResponse create(@Valid @RequestBody CreateServiceCatalogItemRequest request) { return service.create(request); }
    @GetMapping
    public List<ServiceCatalogItemResponse> list() { return service.list(); }
    @GetMapping("/{id}")
    public ServiceCatalogItemResponse get(@PathVariable @Positive Long id) { return service.getById(id); }
    @PutMapping("/{id}")
    public ServiceCatalogItemResponse update(@PathVariable @Positive Long id, @Valid @RequestBody UpdateServiceCatalogItemRequest request) {
        return service.update(id, request);
    }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Positive Long id) { service.delete(id); }
    @PostMapping("/{id}/activate")
    public ServiceCatalogItemResponse activate(@PathVariable @Positive Long id) { return service.activate(id); }
    @PostMapping("/{id}/deactivate")
    public ServiceCatalogItemResponse deactivate(@PathVariable @Positive Long id) { return service.deactivate(id); }
}
