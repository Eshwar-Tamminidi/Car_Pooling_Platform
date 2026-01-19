package com.carpool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.carpool.model.Ride;

import java.time.LocalDateTime;
import java.util.List;

public interface RideRepository extends JpaRepository<Ride, Long> {

    List<Ride> findByOwnerEmail(String ownerEmail);

    // Atomically deduct seats
    @Modifying(clearAutomatically = true)
    @Query("""
        update Ride r
        set r.seatsAvailable = r.seatsAvailable - :seats
        where r.id = :rideId and r.seatsAvailable >= :seats
    """)
    int deductSeatsIfAvailable(@Param("rideId") Long rideId,
                               @Param("seats") int seats);

    // ✅ FIXED: Find rides whose estimated completion time has passed OR (no estimated completion time and dateTime has passed)
    @Query("""
        select r.id
        from Ride r
        where (r.estimatedCompletionDateTime is not null
               and r.estimatedCompletionDateTime <= :now)
           or (r.estimatedCompletionDateTime is null
               and r.dateTime <= :now)
    """)
    List<Long> findEndedRideIds(@Param("now") String now);


}
