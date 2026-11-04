import React from 'react';

export const CardSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
    </div>
    <div className="h-8 bg-slate-200 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-slate-100 rounded w-1/4"></div>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 6 }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs animate-pulse">
    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
      <div className="h-8 bg-slate-100 rounded w-1/6"></div>
    </div>
    <div className="p-4 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 bg-slate-100 rounded flex-1"
              style={{ opacity: 1 - j * 0.12 }}
            ></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs animate-pulse">
    <div className="flex items-center justify-between mb-6">
      <div className="space-y-2">
        <div className="h-5 bg-slate-200 rounded w-48"></div>
        <div className="h-3 bg-slate-100 rounded w-32"></div>
      </div>
      <div className="h-8 bg-slate-100 rounded w-24"></div>
    </div>
    <div className="h-64 bg-slate-50 rounded-xl flex items-end justify-between p-4 gap-2">
      {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 85].map((h, i) => (
        <div
          key={i}
          className="bg-slate-200 rounded-t w-full"
          style={{ height: `${h}%` }}
        ></div>
      ))}
    </div>
  </div>
);
