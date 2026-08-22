/**
 * Society announcements and the in-app notification feed.
 *
 * The feed is filtered server-side by audience, so a notice addressed to STAFF
 * never reaches a resident's list — the client does no audience filtering of
 * its own.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Announcement, AnnouncementCreate, Notification } from "./types";

export const announcementKeys = {
  list: ["announcements"] as const,
  notifications: (unreadOnly: boolean) =>
    ["notifications", unreadOnly ? "unread" : "all"] as const,
  allNotifications: ["notifications"] as const,
};

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.list,
    queryFn: () => api.get<Announcement[]>("/v1/announcements"),
  });
}

export function usePostAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AnnouncementCreate) =>
      api.post<Announcement>("/v1/announcements", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.list });
      // Posting notifies the audience, so their feeds change too.
      queryClient.invalidateQueries({ queryKey: announcementKeys.allNotifications });
    },
  });
}

/**
 * The caller's own notifications.
 *
 * Complaints, payments, bookings, announcements and SOS acknowledgements all
 * write rows here, and until now nothing in the UI read them.
 */
export function useNotifications(unreadOnly = false, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: announcementKeys.notifications(unreadOnly),
    queryFn: () =>
      api.get<Notification[]>(`/v1/notifications${unreadOnly ? "?unread_only=true" : ""}`),
    refetchInterval: options?.refetchInterval,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      api.post<Notification>(`/v1/notifications/${notificationId}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: announcementKeys.allNotifications }),
  });
}
