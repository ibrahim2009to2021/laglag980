/**
 * Utility functions for formatting data
 * Centralized formatters to avoid code duplication
 */

/**
 * Format number as currency (USD)
 */
export const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US').format(numValue);
};

/**
 * Format date to readable string
 */
export const formatDate = (date: Date | string, format: 'short' | 'long' | 'full' = 'short'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const options: Intl.DateTimeFormatOptions = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  }[format];

  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 */
export const formatTimeAgo = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMs = now.getTime() - dateObj.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) {
    return diffInMinutes + ' minute' + (diffInMinutes === 1 ? '' : 's') + ' ago';
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours + ' hour' + (diffInHours === 1 ? '' : 's') + ' ago';
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return diffInDays + ' day' + (diffInDays === 1 ? '' : 's') + ' ago';
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths + ' month' + (diffInMonths === 1 ? '' : 's') + ' ago';
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return diffInYears + ' year' + (diffInYears === 1 ? '' : 's') + ' ago';
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  if (isNaN(value)) return '0%';
  return value.toFixed(decimals) + '%';
};

/**
 * Format file size (bytes to human readable)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Get stock status based on quantity
 */
export const getStockStatus = (quantity: number, lowStockThreshold: number = 5) => {
  if (quantity === 0) {
    return {
      status: 'out-of-stock',
      label: 'Out of Stock',
      className: 'text-destructive bg-destructive/10',
    };
  }
  
  if (quantity <= lowStockThreshold) {
    return {
      status: 'low-stock',
      label: 'Low Stock',
      className: 'text-orange-600 bg-orange-600/10',
    };
  }

  return {
    status: 'in-stock',
    label: 'In Stock',
    className: 'text-accent bg-accent/10',
  };
};

/**
 * Get invoice status color class
 */
export const getInvoiceStatusClass = (status: string): string => {
  const statusMap: Record<string, string> = {
    'Pending': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'Processed': 'bg-green-100 text-green-700 border-green-300',
    'Deleted': 'bg-red-100 text-red-700 border-red-300',
  };

  return statusMap[status] || 'bg-gray-100 text-gray-700 border-gray-300';
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return '(' + cleaned.substring(0, 3) + ') ' + cleaned.substring(3, 6) + '-' + cleaned.substring(6);
  }

  return phone;
};

/**
 * Generate initials from name
 */
export const getInitials = (firstName?: string, lastName?: string, email?: string): string => {
  if (firstName && lastName) {
    return (firstName[0] + lastName[0]).toUpperCase();
  }
  
  if (email) {
    return email[0].toUpperCase();
  }

  return 'U';
};

/**
 * Constants for thresholds
 */
export const THRESHOLDS = {
  LOW_STOCK: 5,
  CRITICAL_STOCK: 2,
  HIGH_VALUE_ORDER: 1000,
} as const;
