import api from "./axios";

export const getMyNotifications = (userId) =>
  api.get(`/api/notifications/my/${userId}`);

export const getUnreadCount = (userId) =>
  api.get(`/api/notifications/unread-count/${userId}`);

export const markRead = (id) =>
  api.put(`/api/notifications/read/${id}`);

export const markAllRead = (userId) =>
  api.put(`/api/notifications/read-all/${userId}`);
