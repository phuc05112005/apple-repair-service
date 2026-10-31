package com.applecare.apple_repair_service.event;

import com.applecare.apple_repair_service.client.MlClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class MlPredictionEventListener {

    private final MlClient mlClient;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleMlPredictionEvent(MlPredictionEvent event) {
        mlClient.predictAndUpdate(event.ticketId(), event.userId());
    }
}