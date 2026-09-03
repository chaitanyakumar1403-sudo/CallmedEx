/**
 * CallMedex Pharmacy API Service
 * Consumes: /api/pharmacy/ endpoints from pharmacy_orders.py router
 */
import { api } from './api';
import type {
  APIResponse,
  PharmacyOrder,
  PharmacyInventoryItem,
  PharmacyInventoryCreate,
} from '../types/api';

export const pharmacyService = {
  /** Search medicines/products */
  async searchProducts(query: string): Promise<any[]> {
    const res = await api.get<APIResponse>(`/api/pharmacy/search?q=${encodeURIComponent(query)}`);
    return res.data ?? [];
  },

  /** Create a pharmacy order */
  async createOrder(data: { prescription_url?: string; items?: any[] }): Promise<PharmacyOrder> {
    const res = await api.post<APIResponse<PharmacyOrder>>('/api/pharmacy/order', data);
    return res.data as PharmacyOrder;
  },

  /** Get incoming orders (pharmacy role) */
  async getIncomingOrders(): Promise<PharmacyOrder[]> {
    const res = await api.get<APIResponse<PharmacyOrder[]>>('/api/pharmacy/orders/incoming');
    return res.data ?? [];
  },

  /** Update order status (pharmacy role) */
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await api.patch(`/api/pharmacy/orders/${orderId}/status`, { status });
  },

  /** Track order delivery */
  async trackOrder(orderId: string): Promise<any> {
    return await api.get(`/api/pharmacy/track/${orderId}`);
  },

  /** Get inventory list (pharmacy role) */
  async getInventory(): Promise<PharmacyInventoryItem[]> {
    const res = await api.get<APIResponse<PharmacyInventoryItem[]>>('/api/pharmacy/inventory');
    return res.data ?? [];
  },

  /** Add inventory item (pharmacy role) */
  async addInventoryItem(data: PharmacyInventoryCreate): Promise<PharmacyInventoryItem> {
    const res = await api.post<APIResponse<PharmacyInventoryItem>>('/api/pharmacy/inventory', data);
    return res.data as PharmacyInventoryItem;
  },

  /** Update inventory item (pharmacy role) */
  async updateInventoryItem(
    itemId: string,
    data: Partial<PharmacyInventoryCreate>
  ): Promise<void> {
    await api.patch(`/api/pharmacy/inventory/${itemId}`, data);
  },
};
