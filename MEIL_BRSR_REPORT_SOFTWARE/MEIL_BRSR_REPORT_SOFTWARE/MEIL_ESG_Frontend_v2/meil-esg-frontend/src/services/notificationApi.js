import apiClient from './apiClient';
import { mapNotification } from './mappers';

export const notificationApi = {

  async getNotifications() {
    const response =
      await apiClient.get(
        '/notifications'
      );

    return (
      Array.isArray(
        response.data
      )
        ? response.data
        : []
    ).map(
      mapNotification
    );
  },


  async markAsRead(
    notificationId
  ) {
    const response =
      await apiClient.post(
        `/notifications/${notificationId}/read`
      );

    return mapNotification(
      response.data
    );
  },


  async markAllAsRead() {
    const response =
      await apiClient.post(
        '/notifications/mark-read'
      );

    return response.data;
  },
};

export default notificationApi;