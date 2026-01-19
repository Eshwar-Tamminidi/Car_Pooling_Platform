package com.carpool.repository;

import com.carpool.model.Notification;
import com.carpool.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserOrderByCreatedAtDesc(User user);

    // Paginated access for large notification streams
    org.springframework.data.domain.Page<Notification> findByUserOrderByCreatedAtDesc(User user, org.springframework.data.domain.Pageable pageable);

    long countByUserAndIsReadFalse(User user);
}
