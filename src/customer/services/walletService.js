import { authGet } from "./apiClient";

export const walletService = {
  getWalletTransactions: (pageNumber = 0, pageSize = 10) =>
    authGet("/api/customer/wallet_transaction/getAll", { pageNumber, pageSize }),
};
