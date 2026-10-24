package com.applecare.apple_repair_service.dto.publicapi;

public record PublicAppointmentDeviceResponse(String deviceModelName, java.util.List<PublicBookedServiceResponse> services) {
}
