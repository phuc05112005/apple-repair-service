package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record AppointmentDeviceDetailResponse(AppointmentDeviceResponse device,
                                              List<AppointmentServiceItemResponse> serviceItems) {
}
