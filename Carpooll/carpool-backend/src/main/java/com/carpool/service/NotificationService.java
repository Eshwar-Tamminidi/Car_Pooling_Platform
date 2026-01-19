package com.carpool.service;

import com.carpool.model.Notification;
import com.carpool.model.User;
import com.carpool.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    // ✅ SAFE default creator (use this most of the time)
    public Notification create(User user, String title, String message) {
        return create(user, title, message, "GENERAL", "/notifications");
    }

    // ✅ FULL creator
    public Notification create(User user, String title, String message, String type, String redirectUrl) {
        Notification n = new Notification();
        n.setUser(user);
        n.setTitle(title);
        n.setMessage(message);
        n.setType(type);
        n.setRedirectUrl(redirectUrl);
        n.setRead(false);
        return repo.save(n);
    }

    // ✅ Get all for user (non-paginated)
    public List<Notification> getUserNotifications(User user) {
        return repo.findByUserOrderByCreatedAtDesc(user);
    }

    // ✅ Paginated retrieval
    public org.springframework.data.domain.Page<Notification> getUserNotifications(User user, int page, int size) {
        org.springframework.data.domain.Pageable pg = org.springframework.data.domain.PageRequest.of(page, size);
        return repo.findByUserOrderByCreatedAtDesc(user, pg);
    }

    // ✅ Unread count
    public long getUnreadCount(User user) {
        return repo.countByUserAndIsReadFalse(user);
    }

    // ✅ Mark one as read
    public void markAsRead(Long id) {
        Notification n = repo.findById(id).orElseThrow();
        n.setRead(true);
        repo.save(n);
    }

    // ✅ Mark all as read
    public void markAllAsRead(User user) {
        List<Notification> list = repo.findByUserOrderByCreatedAtDesc(user);
        list.forEach(n -> n.setRead(true));
        repo.saveAll(list);
    }
}
