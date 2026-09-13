package com.applecare.apple_repair_service.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class PricePolicy {
    public static final BigDecimal DEFAULT_ONLINE_DISCOUNT = new BigDecimal("10.00");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private PricePolicy() {
    }

    public static BigDecimal discounted(BigDecimal price, BigDecimal percent) {
        BusinessRules.require(percent != null && percent.signum() >= 0 && percent.compareTo(HUNDRED) <= 0, "Discount must be 0..100");
        BusinessRules.require(percent.stripTrailingZeros().scale() <= 2, "Discount supports at most two decimal places");
        BusinessRules.money(price);
        return price == null ? null : price.multiply(HUNDRED.subtract(percent)).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }
}
