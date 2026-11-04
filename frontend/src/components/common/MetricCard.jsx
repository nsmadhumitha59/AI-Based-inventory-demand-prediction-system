import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const MetricCard = ({
  title,
  value,
  trend,
  trendLabel = 'vs last period',
  icon: Icon,
  iconGradient = 'from-blue-600 to-indigo-600',
  subValue,
}) => {
  const isPositive = typeof trend === 'number' && trend > 0;
  const isNegative = typeof trend === 'number' && trend < 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500 tracking-wide">{title}</span>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </div>
          {subValue && (
            <div className="text-xs text-slate-400 mt-1 font-medium">{subValue}</div>
          )}
        </div>

        {trend !== undefined && trend !== null && (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                isPositive
                  ? 'bg-emerald-50 text-emerald-600'
                  : isNegative
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
              {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-slate-400 font-normal hidden sm:inline">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};
