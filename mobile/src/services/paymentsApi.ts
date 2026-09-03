/**
 * CallMedex Payments API Service
 * Consumes: /api/payments/ endpoints from payments.py router
 */
import { api } from './api';
import type {
  APIResponse,
  PaymentCreateOrderResponse,
  PaymentVerifyRequest,
  TransactionResponse,
} from '../types/api';

export const paymentsService = {
  /** Create a Razorpay order for a booking */
  async createOrder(bookingId: string, amount: number): Promise<PaymentCreateOrderResponse> {
    const res = await api.post<APIResponse<PaymentCreateOrderResponse>>(
      '/api/payments/create-order',
      { booking_id: bookingId, amount }
    );
    return res.data as PaymentCreateOrderResponse;
  },

  /** Verify Razorpay payment signature (server-side verification) */
  async verifyPayment(data: PaymentVerifyRequest): Promise<{ verified: boolean }> {
    const res = await api.post<APIResponse<{ verified: boolean }>>(
      '/api/payments/verify',
      data
    );
    return res.data as { verified: boolean };
  },

  /** Get user's transaction history */
  async getMyTransactions(): Promise<TransactionResponse[]> {
    const res = await api.get<APIResponse<TransactionResponse[]>>(
      '/api/payments/my-transactions'
    );
    return res.data ?? (Array.isArray(res) ? res : []);
  },

  /** Get provider earnings summary */
  async getMyEarnings(): Promise<{
    total_earnings: number;
    pending_payout: number;
    transactions: TransactionResponse[];
  }> {
    return await api.get('/api/payments/my-earnings');
  },
};
