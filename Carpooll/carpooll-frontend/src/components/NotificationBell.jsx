// src/components/NotificationBell.jsx
import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import axios from "axios";

export default function NotificationBell({ userId }) {
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(0);
    const [size] = useState(10);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);

    // ✅ If user not logged in, DO NOT render bell
    if (!userId) return null;

    useEffect(() => {
        fetchUnreadCount();
        fetchNotifications(0);
        // optional: polling every 30s
        const interval = setInterval(() => {
            fetchUnreadCount();
        }, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    const fetchUnreadCount = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`http://localhost:8080/api/notifications/unread-count/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUnreadCount(Number(res.data || 0));
        } catch (err) {
            console.error("Unread count fetch failed", err);
        }
    };

    const fetchNotifications = async (forPage = 0) => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");

            const res = await axios.get(
                `http://localhost:8080/api/notifications/my/${userId}?page=${forPage}&size=${size}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            // Server returns a Page object with 'content' field
            const data = res.data;
            const list = data.content || [];

            if (forPage === 0) setNotifications(list);
            else setNotifications(prev => [...prev, ...list]);

            setHasMore(data.number < (data.totalPages - 1));
            setPage(data.number || forPage);

            // refresh unread count to keep badge consistent
            fetchUnreadCount();
        } catch (err) {
            console.error("Notification fetch failed", err);
        } finally {
            setLoading(false);
        }
    };

    const markReadAndNavigate = async (n) => {
        try {
            const token = localStorage.getItem("token");
            if (!n.read) {
                await axios.put(`http://localhost:8080/api/notifications/read/${n.id}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Optimistically update
                setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                setUnreadCount(c => Math.max(0, c - 1));
            }
            if (n.redirectUrl) {
                window.location.href = n.redirectUrl;
            }
        } catch (err) {
            console.error("Failed to mark read or navigate", err);
        }
    };

    return (
        <div style={{ position: "relative" }}>
            {/* 🔔 Bell */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    padding: "6px"
                }}
            >
                <Bell size={20} />

                {/* 🔴 Unread badge */}
                {unreadCount > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            top: "0",
                            right: "0",
                            background: "red",
                            color: "white",
                            borderRadius: "50%",
                            fontSize: "10px",
                            padding: "2px 5px",
                            fontWeight: "700"
                        }}
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* 📩 Dropdown */}
            {open && (
                <div
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "32px",
                        width: "320px",
                        background: "var(--card-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        zIndex: 999
                    }}
                >
                    <div style={{ padding: "10px", fontWeight: "700" }}>
                        Notifications
                    </div>

                    {notifications.length === 0 ? (
                        <div style={{ padding: "12px", color: "var(--text-muted)" }}>
                            No notifications
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => markReadAndNavigate(n)}
                                style={{
                                    padding: "10px",
                                    borderTop: "1px solid var(--border)",
                                    fontSize: "13px",
                                    background: n.read ? "transparent" : "rgba(59,130,246,0.08)",
                                    cursor: "pointer"
                                }}
                            >
                                {n.message}
                            </div>
                        ))
                    )}

                    {hasMore && (
                        <div style={{ padding: 10, textAlign: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => fetchNotifications(page + 1)} disabled={loading}>
                                {loading ? 'Loading...' : 'Load more'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
