package com.applecare.apple_repair_service.exception;

import lombok.Getter;

@Getter
public class InsufficientStockException extends BusinessException {

    private final Long partId;
    private final String partName;
    private final Integer requestedQuantity;
    private final Integer availableQuantity;

    // Constructor 1: Tương thích ngược với các vị trí code cũ đang sử dụng chuỗi message
    public InsufficientStockException(String message) {
        super(message);
        this.partId = null;
        this.partName = null;
        this.requestedQuantity = null;
        this.availableQuantity = null;
    }

    // Constructor 2: Chuyên dụng cho nghiệp vụ xuất/trừ kho với đầy đủ tham số
    public InsufficientStockException(Long partId, String partName, Integer requestedQuantity, Integer availableQuantity) {
        super(String.format("Linh kiện '%s' (ID: %d) không đủ tồn kho. Yêu cầu: %d, Hiện có: %d",
                partName, partId, requestedQuantity, availableQuantity));
        this.partId = partId;
        this.partName = partName;
        this.requestedQuantity = requestedQuantity;
        this.availableQuantity = availableQuantity;
    }
}