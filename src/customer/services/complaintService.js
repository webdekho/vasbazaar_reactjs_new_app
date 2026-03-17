import { authGet, authPost } from "./apiClient";

export const complaintService = {
  getAll: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/complaint/getAllUserId", { pageNumber, pageSize }),

  create: (payload) =>
    authPost("/api/customer/complaint/create", payload),
};
