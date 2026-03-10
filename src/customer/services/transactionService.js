import { authGet } from "./apiClient";

export const transactionService = {
  getTransactions: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/transaction/getByUserId", { pageNumber, pageSize }),
};
