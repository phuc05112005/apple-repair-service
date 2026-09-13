package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record AppointmentDetailResponse(AppointmentResponse appointment,
                                        List<AppointmentDeviceDetailResponse> devices) {
}
