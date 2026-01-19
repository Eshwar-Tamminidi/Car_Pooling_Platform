//src/main/java/com/carpool/repository/UserRepository.java
package com.carpool.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.carpool.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}
