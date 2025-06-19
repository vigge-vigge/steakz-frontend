import React from 'react';
import { OrderWithDetails } from '../../types';

interface OrderListProps {
  orders: OrderWithDetails[];
  onSelect?: (order: OrderWithDetails) => void;
  onDeliver?: (order: OrderWithDetails) => void;
}

const OrderList: React.FC<OrderListProps> = ({ orders, onSelect, onDeliver }) => (
  <div className="space-y-2">
    {orders.map(order => (
      <div
        key={order.id}
        className="border p-2 rounded cursor-pointer hover:bg-gray-100"
        onClick={() => onSelect && onSelect(order)}
      >
        <div className="font-semibold">Order #{order.id} - {order.status}</div>
        <div>Total: ${order.totalAmount.toFixed(2)}</div>
        <div>Customer: {order.customer?.username || 'N/A'}</div>
        <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
        {/* Confirm Delivery button for PENDING and READY orders */}
        {(order.status === 'READY' || order.status === 'PENDING') && onDeliver && (
          <button
            style={{
              marginTop: 8,
              padding: '6px 12px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={e => {
              e.stopPropagation();
              onDeliver(order);
            }}
          >
            Confirm Delivery
          </button>
        )}
      </div>
    ))}
  </div>
);

export default OrderList;
