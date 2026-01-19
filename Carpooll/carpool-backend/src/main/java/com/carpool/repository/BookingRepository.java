//src/main/java/com/carpool/repository/BookingRepository.java
package com.carpool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.carpool.model.Booking;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByRequesterId(Long requesterId);
    List<Booking> findByRideId(Long rideId);
    boolean existsByTransactionId(String transactionId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE Booking b SET b.status = :status WHERE b.id = :id")
    int updateStatusById(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("status") Booking.Status status);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query(value = "UPDATE booking SET status = :status WHERE id = :id", nativeQuery = true)
    int updateStatusByIdNative(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("status") String status);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE Booking b SET b.status = :status WHERE b.rideId = :rideId AND b.status IN :currentStatuses")
    int updateStatusByRideIdAndCurrentStatuses(@org.springframework.data.repository.query.Param("rideId") Long rideId, @org.springframework.data.repository.query.Param("status") Booking.Status status, @org.springframework.data.repository.query.Param("currentStatuses") java.util.List<Booking.Status> currentStatuses);
}
