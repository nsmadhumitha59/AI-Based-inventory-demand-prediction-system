import React from 'react';

export const StockStatusBadge = ({ status }) => {
  const config = {
    IN_STOCK: {
      label: 'In Stock',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    },
    LOW_STOCK: {
      label: 'Low Stock',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
    OUT_OF_STOCK: {
      label: 'Out of Stock',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500 animate-pulse',
    },
    OVERSTOCKED: {
      label: 'Overstocked',
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500',
    },
  };

  const item = config[status] || config.IN_STOCK;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
      {item.label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const config = {
    CRITICAL: {
      label: 'Critical Risk',
      bg: 'bg-rose-100 text-rose-800 border-rose-300',
    },
    HIGH: {
      label: 'High Priority',
      bg: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    MEDIUM: {
      label: 'Medium Priority',
      bg: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    LOW: {
      label: 'Low Priority',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    OPTIMAL: {
      label: 'Stock Optimal',
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
  };

  const item = config[priority] || config.MEDIUM;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${item.bg}`}>
      {item.label}
    </span>
  );
};

export const ChannelBadge = ({ channel }) => {
  const config = {
    ONLINE: { label: 'E-Commerce', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    IN_STORE: { label: 'Retail Store', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    WHOLESALE: { label: 'Wholesale', bg: 'bg-violet-50 text-violet-700 border-violet-200' },
    B2B: { label: 'Corporate B2B', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
  };

  const item = config[channel] || { label: channel, bg: 'bg-gray-50 text-gray-700 border-gray-200' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.bg}`}>
      {item.label}
    </span>
  );
};
