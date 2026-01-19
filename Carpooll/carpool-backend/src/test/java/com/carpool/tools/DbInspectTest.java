package com.carpool.tools;

import com.carpool.model.Booking;
import com.carpool.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig;

import java.util.List;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:file:./data/carpooldb;AUTO_SERVER=TRUE", "spring.datasource.username=sa", "spring.datasource.password=", "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect", "spring.flyway.enabled=false"})
@Import(TestMailConfig.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public class DbInspectTest {

    @Autowired
    BookingRepository bookingRepository;

    @Test
    public void dumpProblemBookings() {
        List<Long> ids = List.of(22L, 23L, 74L, 75L);
        for (Long id : ids) {
            bookingRepository.findById(id).ifPresentOrElse(b ->
                    System.out.println("booking id=" + id + " status=" + b.getStatus()),
                    () -> System.out.println("booking id=" + id + " not found")
            );
        }
    }
}
