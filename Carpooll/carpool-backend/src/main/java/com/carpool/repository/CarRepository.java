//src/main/java/com/carpool/repository/CarRepository.java
package com.carpool.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.carpool.model.Car;
import java.util.List;

public interface CarRepository extends JpaRepository<Car, Long> {
    List<Car> findByOwnerId(Long ownerId);
}