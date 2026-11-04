import React, { useState, useEffect } from 'react';
import {
  Package, ShoppingCart, TrendingUp, AlertTriangle, BarChart3, BrainCircuit,
  Activity, ArrowUpRight, ArrowDownRight, RefreshCw, Info
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { dashboardApi } from '../api/dashboard';
import { MetricCard } from '../components/common/MetricCard';
import { CardSkeleton, ChartSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { StockStatusBadge, PriorityBadge } from '../components/common/Badge';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  muted: '#e2e8f0',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-slate-700/50">
        <p className="font-semibold text-slate-200 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getDashboardData();
      setData(result);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartSkeleton /><ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboard} />;
  }

  const { metrics, sales_trend_chart, demand_forecast_chart, inventory_distribution, stock_health, top_selling_products, alerts } = data;

  // Format X-axis dates
  const formatDate = (d) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const alertColors = { critical: 'border-rose-400 bg-rose-50', warning: 'border-amber-400 bg-amber-50', danger: 'border-rose-500 bg-rose-100' };
  const alertIconColors = { critical: 'text-rose-600', warning: 'text-amber-600', danger: 'text-rose-700' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-500">Live metrics from your inventory database</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard
          title="Total Products"
          value={metrics.total_products.toLocaleString()}
          icon={Package}
          iconGradient="from-blue-600 to-indigo-600"
          subValue="Active SKUs in catalog"
        />
        <MetricCard
          title="Total Stock"
          value={metrics.total_stock.toLocaleString()}
          icon={ShoppingCart}
          iconGradient="from-emerald-500 to-teal-500"
          subValue="Units across all products"
        />
        <MetricCard
          title="Units Sold (30d)"
          value={metrics.units_sold_30d.toLocaleString()}
          trend={metrics.units_sold_trend}
          icon={TrendingUp}
          iconGradient="from-violet-600 to-purple-600"
          subValue="vs prior 30-day window"
        />
        <MetricCard
          title="Low Stock Alerts"
          value={metrics.low_stock_alerts}
          icon={AlertTriangle}
          iconGradient="from-rose-500 to-orange-500"
          subValue={`${metrics.out_of_stock_alerts} fully out of stock`}
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Sales Trend (Last 30 Days)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily units sold across all channels</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sales_trend_chart} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="units" name="Units Sold" stroke={CHART_COLORS.primary} fill="url(#salesGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Demand Forecast Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BrainCircuit className="w-4.5 h-4.5 text-violet-600" />
                Demand Forecast View
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Historical actual vs AI-predicted demand</p>
            </div>
            <button
              onClick={() => navigate('/forecast')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Generate <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {demand_forecast_chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={demand_forecast_chart} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="actual" name="Actual" stroke={CHART_COLORS.primary} fill="url(#actualGrad)" strokeWidth={2} dot={false} connectNulls />
                <Area type="monotone" dataKey="forecast" name="AI Forecast" stroke={CHART_COLORS.secondary} fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BrainCircuit}
              title="No forecast data yet"
              description="Generate your first AI forecast to see predictions here"
              actionLabel="Go to AI Forecast"
              onAction={() => navigate('/forecast')}
            />
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stock Health Donut */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">Stock Health</h3>
          <p className="text-xs text-slate-500 mb-4">Distribution of stock status</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={[
                  { name: 'In Stock', value: stock_health.in_stock },
                  { name: 'Low Stock', value: stock_health.low_stock },
                  { name: 'Out of Stock', value: stock_health.out_of_stock },
                  { name: 'Overstocked', value: stock_health.overstocked },
                ].filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.secondary].map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { label: 'In Stock', count: stock_health.in_stock, color: 'bg-emerald-500' },
              { label: 'Low Stock', count: stock_health.low_stock, color: 'bg-amber-500' },
              { label: 'Out of Stock', count: stock_health.out_of_stock, color: 'bg-rose-500' },
              { label: 'Overstocked', count: stock_health.overstocked, color: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`}></span>
                <span>{item.label}: <strong>{item.count}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Distribution Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 col-span-1 lg:col-span-2">
          <h3 className="text-base font-bold text-slate-900 mb-1">Inventory by Category</h3>
          <p className="text-xs text-slate-500 mb-4">Total stock units per product category</p>
          {inventory_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={inventory_distribution} margin={{ left: -20, right: 10 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 9.5, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="stock" name="Stock Units" radius={[6, 6, 0, 0]}>
                  {inventory_distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No inventory data" description="Add products to see distribution" />
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Top Selling Products Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Top Selling Products</h3>
            <button onClick={() => navigate('/inventory')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {top_selling_products.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {top_selling_products.map((product, i) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">{product.name}</div>
                      <div className="text-xs text-slate-400">{product.sku} · {product.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-800">{product.quantity_sold.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">units sold</div>
                    </div>
                    <div className={`flex items-center gap-0.5 text-xs font-semibold ${
                      product.trend === 'UP' ? 'text-emerald-600' : product.trend === 'DOWN' ? 'text-rose-600' : 'text-slate-400'
                    }`}>
                      {product.trend === 'UP' ? <ArrowUpRight className="w-4 h-4" /> : product.trend === 'DOWN' ? <ArrowDownRight className="w-4 h-4" /> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No sales data" description="Record your first sale to see top products" />
          )}
        </div>

        {/* Alerts Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Inventory Alerts
              {alerts.length > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                  {alerts.length}
                </span>
              )}
            </h3>
            <button onClick={() => navigate('/inventory')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
              Manage <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {alerts.length > 0 ? (
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-6 py-3.5 border-l-4 hover:bg-slate-50 transition-colors ${
                    alert.severity === 'critical' || alert.severity === 'danger'
                      ? 'border-l-rose-500'
                      : 'border-l-amber-400'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                    alert.severity === 'critical' || alert.severity === 'danger'
                      ? 'text-rose-500'
                      : 'text-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{alert.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.message}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{alert.sku}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="All systems healthy"
              description="No active stock alerts. Your inventory levels are within optimal ranges."
            />
          )}
        </div>
      </div>
    </div>
  );
};

