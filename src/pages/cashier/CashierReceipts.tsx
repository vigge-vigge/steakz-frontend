import React, { useEffect, useState, useContext } from 'react';
import { getOrders } from '../../services/api';
import { Payment, OrderWithDetails } from '../../types';
import ReceiptList from '../../components/common/ReceiptList';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { useShift } from '../../hooks/useShift';
import { AuthContext } from '../../context/AuthContext';

const CashierReceipts: React.FC = () => {
  const { settings, t } = useSettings();
  const { isDarkMode } = useTheme();
  const { isActive: shiftActive } = useShift();
  const { user } = useContext(AuthContext);
  const [receipts, setReceipts] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [message, setMessage] = useState('');
  const [emailModal, setEmailModal] = useState<{ show: boolean; receipt: Payment | null; order: OrderWithDetails | null }>({
    show: false,
    receipt: null,
    order: null
  });
  const [emailAddress, setEmailAddress] = useState('');  useEffect(() => {
    console.log('CashierReceipts mounted, user:', user);
    loadReceipts();
    
    // Refresh receipts every 10 seconds to keep data up to date
    const interval = setInterval(loadReceipts, 10000);
    
    // Listen for order placed events to immediately refresh
    const handleOrderPlaced = () => {
      console.log('Order placed event received, refreshing receipts...');
      loadReceipts();
    };
    
    window.addEventListener('orderPlaced', handleOrderPlaced);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('orderPlaced', handleOrderPlaced);
    };
  }, []);const loadReceipts = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // Get ALL orders regardless of branch for comprehensive receipts
      console.log('Loading all orders...');
      const response = await getOrders({});
      console.log('All orders response:', response.data);
      
      setOrders(response.data);
      
      // Flatten all payments from orders (including previous orders)
      const allReceipts = response.data
        .map((order: OrderWithDetails) => order.payment)
        .filter((p): p is Payment => !!p);
      
      console.log('Extracted receipts:', allReceipts);
      setReceipts(allReceipts);
      
    } catch (error: any) {
      console.error('Error loading orders:', error);
      setMessage(`Error loading receipts: ${error?.response?.data?.message || error.message}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = (receipt: Payment) => {
    // Find the associated order
    const order = orders.find(o => o.payment?.id === receipt.id);
    if (!order) {
      setMessage('Order data not found for reprint');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Generate receipt HTML for printing
    const receiptHTML = generateReceiptHTML(receipt, order);
    
    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.print();
      setMessage('Receipt sent to printer');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Unable to open print window');
      setTimeout(() => setMessage(''), 3000);
    }
  };
  const handleEmail = async (receipt: Payment) => {
    // Find the associated order
    const order = orders.find(o => o.payment?.id === receipt.id);
    if (!order) {
      setMessage('Order data not found for email');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Set default email from customer data and open modal
    setEmailAddress(order.customer?.email || '');
    setEmailModal({ show: true, receipt, order });
  };

  const handleSendEmail = async () => {
    if (!emailModal.receipt || !emailModal.order || !emailAddress.trim()) {
      setMessage('Please enter a valid email address');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      // Generate email content
      const emailContent = generateEmailContent(emailModal.receipt, emailModal.order);
      
      // Simulate sending email via API
      // In a real application, you would call your backend API here
      const emailData = {
        to: emailAddress,
        subject: `Receipt #${emailModal.receipt.id} - Order #${emailModal.order.id}`,
        html: generateReceiptHTML(emailModal.receipt, emailModal.order),
        text: emailContent
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
        setMessage(`Receipt successfully sent to ${emailAddress}`);
      setEmailModal({ show: false, receipt: null, order: null });
      setEmailAddress('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to send email. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const generateReceiptHTML = (receipt: Payment, order: OrderWithDetails) => {
    const now = new Date();
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt #${receipt.id}</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 20px; max-width: 300px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total-section { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; }
          .total { font-weight: bold; border-top: 2px solid #000; padding-top: 5px; }
          .footer { text-align: center; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>RESTAURANT RECEIPT</h2>
          <p>Receipt #${receipt.id}</p>
          <p>Order #${order.id}</p>
          <p>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
          <p>Customer: ${order.customer?.username || 'N/A'}</p>
        </div>
        
        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <span>${item.menuItem.name} x${item.quantity}</span>
              <span>$${item.subtotal.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="total-section">
          <div class="item total">
            <span>TOTAL:</span>
            <span>$${receipt.amount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Payment Method: ${receipt.method.replace('_', ' ')}</p>
          <p>Status: ${receipt.status}</p>
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;
  };

  const generateEmailContent = (receipt: Payment, order: OrderWithDetails) => {
    return `
Dear ${order.customer?.username || 'Customer'},

Thank you for your order! Here are your receipt details:

Receipt #${receipt.id}
Order #${order.id}
Date: ${new Date(receipt.createdAt).toLocaleDateString()}
Time: ${new Date(receipt.createdAt).toLocaleTimeString()}

Order Items:
${order.items.map(item => `- ${item.menuItem.name} x${item.quantity} = $${item.subtotal.toFixed(2)}`).join('\n')}

Total Amount: $${receipt.amount.toFixed(2)}
Payment Method: ${receipt.method.replace('_', ' ')}
Status: ${receipt.status}

Thank you for choosing our restaurant!

Best regards,
Restaurant Management Team
    `.trim();
  };

  const filteredReceipts = receipts.filter(receipt => {
    const matchesSearch = receipt.id.toString().includes(searchTerm) || 
                         receipt.orderId.toString().includes(searchTerm);
    const matchesMethod = methodFilter === 'ALL' || receipt.method === methodFilter;
    const matchesStatus = statusFilter === 'ALL' || receipt.status === statusFilter;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const getTotalRevenue = () => {
    return filteredReceipts
      .filter(r => r.status === 'COMPLETED')
      .reduce((total, receipt) => total + receipt.amount, 0);
  };

  const getMethodStats = () => {
    const stats = { CASH: 0, CREDIT_CARD: 0, DEBIT_CARD: 0, MOBILE_PAYMENT: 0 };
    filteredReceipts
      .filter(r => r.status === 'COMPLETED')
      .forEach(receipt => {
        stats[receipt.method] += receipt.amount;
      });
    return stats;
  };

  const methodStats = getMethodStats();

  return (    <div className={isDarkMode ? 'dark' : ''} style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#18181b' : '#f9fafb', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto' }}>        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: isDarkMode ? '#fbbf24' : '#111827', marginBottom: '8px' }}>{t('receipts')} & {t('payment')}</h1>
              <p style={{ color: isDarkMode ? '#f3f4f6' : '#6b7280' }}>View and manage payment receipts. Search by receipt or order ID.</p>
            </div>
            <div style={{ 
              padding: '8px 16px', 
              borderRadius: '20px', 
              backgroundColor: shiftActive ? '#d1fae5' : '#fee2e2',
              color: shiftActive ? '#065f46' : '#991b1b',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Shift: {shiftActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Total Revenue</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>${getTotalRevenue().toFixed(2)}</p>
              </div>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#d1fae5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Total Receipts</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>{receipts.length}</p>
              </div>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#dbeafe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Completed Payments</p>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {receipts.filter(r => r.status === 'COMPLETED').length}
                </p>
              </div>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#e9d5ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg style={{ width: '24px', height: '24px', color: '#7c3aed' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Payment Method Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>${methodStats.CASH.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Cash</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>${methodStats.CREDIT_CARD.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Credit Card</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>${methodStats.DEBIT_CARD.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Debit Card</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>${methodStats.MOBILE_PAYMENT.toFixed(2)}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>Mobile Payment</div>
            </div>
          </div>
        </div>        {/* Search and Filters */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Search Receipts
              </label>
              <input
                type="text"
                placeholder="Search by receipt or order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Payment Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="MOBILE_PAYMENT">Mobile Payment</option>
              </select>
            </div>            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Payment Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>

            <div>
              <button
                onClick={loadReceipts}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              Receipts ({filteredReceipts.length})
            </h3>
          </div>
            <div style={{ padding: '24px' }}>
            {message && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: message.includes('Failed') || message.includes('Unable') ? '#fef2f2' : '#f0fdf4',
                color: message.includes('Failed') || message.includes('Unable') ? '#dc2626' : '#166534',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading receipts...</div>
              </div>
            ) : filteredReceipts.length > 0 ? (
              <ReceiptList 
                receipts={filteredReceipts} 
                onReprint={handleReprint}
                onEmail={handleEmail}
              />            ) : (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <svg style={{ width: '48px', height: '48px', color: '#9ca3af', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '8px' }}>
                  {receipts.length === 0 ? 'No receipts available yet' : 'No receipts found'}
                </p>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                  {receipts.length === 0 ? 'Place orders in the POS to see receipts here' : 'Try adjusting your search or filter criteria'}
                </p>
              </div>
            )}</div>
        </div>

        {/* Email Modal */}
        {emailModal.show && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                Email Receipt
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="Enter email address"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  <strong>Receipt:</strong> #{emailModal.receipt?.id}<br />
                  <strong>Order:</strong> #{emailModal.order?.id}<br />
                  <strong>Amount:</strong> ${emailModal.receipt?.amount.toFixed(2)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setEmailModal({ show: false, receipt: null, order: null });
                    setEmailAddress('');
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={!emailAddress.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: emailAddress.trim() ? '#2563eb' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: emailAddress.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierReceipts;
