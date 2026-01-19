package com.carpool.controller;

import com.carpool.model.User;
import com.carpool.service.NotificationService;
import com.carpool.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin
public class NotificationController {

    private final NotificationService service;
    private final UserRepository userRepo;

    public NotificationController(NotificationService service, UserRepository userRepo) {
        this.service = service;
        this.userRepo = userRepo;
    }

    // 🔔 Get notifications (paginated support)
    @GetMapping("/my/{userId}")
    public Object myNotifications(@PathVariable Long userId, @RequestParam(required = false, defaultValue = "0") int page, @RequestParam(required = false, defaultValue = "10") int size) {
        User user = userRepo.findById(userId).orElseThrow();
        // If client explicitly requests large page (size>100) we still cap it to 100
        int cappedSize = Math.min(size, 100);
        return service.getUserNotifications(user, page, cappedSize);
    }

    // 🔴 Unread count (for bell badge)
    @GetMapping("/unread-count/{userId}")
    public long unreadCount(@PathVariable Long userId) {
        User user = userRepo.findById(userId).orElseThrow();
        return service.getUnreadCount(user);
    }

    // ✅ Mark one as read
    @PutMapping("/read/{id}")
    public void markRead(@PathVariable Long id) {
        service.markAsRead(id);
    }

    // ✅ Mark all as read
    @PutMapping("/read-all/{userId}")
    public void markAllRead(@PathVariable Long userId) {
        User user = userRepo.findById(userId).orElseThrow();
        service.markAllAsRead(user);
    }
}
