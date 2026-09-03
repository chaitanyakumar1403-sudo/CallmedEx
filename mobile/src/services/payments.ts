/**
 * CallMedex Native Razorpay Payments Service
 */
import { api } from './api';

export interface PaymentOrderResponse {
  id: string;
  amount: number;
  currency: string;
  key_id?: string;
  booking_id: string;
  description?: string;
}

export interface PaymentVerificationPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentResult {
  success: boolean;
  payment_id?: string;
  order_id?: string;
  message?: string;
}

export const paymentsService = {
  /**
   * Create Razorpay payment order on the CallMedex backend
   */
  async createOrder(
    bookingId: string,
    amount: number,
    providerId?: string,
    description: string = 'CallMedex Healthcare Payment'
  ): Promise<PaymentOrderResponse> {
    const res = await api.post<{ success: boolean; order: PaymentOrderResponse }>(
      '/api/payments/create-order',
      {
        booking_id: bookingId,
        amount,
        provider_id: providerId,
        description,
      }
    );
    return res.order;
  },

  /**
   * Verify signature with CallMedex backend
   */
  async verifyPayment(payload: PaymentVerificationPayload): Promise<PaymentResult> {
    return await api.post<PaymentResult>('/api/payments/verify', payload);
  },

  /**
   * Fetch provider earnings dashboard
   */
  async getProviderEarnings(): Promise<any> {
    return await api.get('/api/payments/earnings');
  },
};
