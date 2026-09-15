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
@RequestMapping("/api/v1/admin/branches")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminBranchController {
    private final BranchService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BranchResponse create(@Valid @RequestBody CreateBranchRequest request) {
        return service.create(request);
    }

    @GetMapping
    public List<BranchResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public BranchResponse get(@PathVariable @Positive Long id) {
        return service.getById(id);
    }

    @PutMapping("/{id}")
    public BranchResponse update(@PathVariable @Positive Long id, @Valid @RequestBody UpdateBranchRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Positive Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/activate")
    public BranchResponse activate(@PathVariable @Positive Long id) {
        return service.activate(id);
    }

    @PostMapping("/{id}/deactivate")
    public BranchResponse deactivate(@PathVariable @Positive Long id) {
        return service.deactivate(id);
    }
}
