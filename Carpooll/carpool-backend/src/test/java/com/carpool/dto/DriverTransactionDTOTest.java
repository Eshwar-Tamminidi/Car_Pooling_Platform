package com.carpool.dto;

import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class DriverTransactionDTOTest {

    @Test
    public void constructorAndGetters() {
        LocalDateTime now = LocalDateTime.now();
        DriverTransactionDTO dto = new DriverTransactionDTO(
                123L,
                "Passenger",
                "A",
                "B",
                now,
                2,
                200.0,
                10.0,
                2.0,
                2.0,
                190.0,
                "tx_123"
        );

        assertEquals(123L, dto.getBookingId());
        assertEquals("Passenger", dto.getPassengerName());
        assertEquals("A", dto.getSource());
        assertEquals("B", dto.getDestination());
        assertEquals(2, dto.getSeats());
        assertEquals(200.0, dto.getGrossFare());
        assertEquals(10.0, dto.getPlatformFee());
        assertEquals(2.0, dto.getCgst());
        assertEquals(2.0, dto.getSgst());
        assertEquals(190.0, dto.getNetAmount());
        assertEquals("tx_123", dto.getTransactionId());
    }
}