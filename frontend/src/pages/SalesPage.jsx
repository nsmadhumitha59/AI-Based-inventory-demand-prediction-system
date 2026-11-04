import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, DollarSign, TrendingUp, Package, Plus, Download, Upload, Filter
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { salesApi } from '../api/sales';
import { inventoryApi } from '../api/inventory';
import { MetricCard } from '../components/common/MetricCard';
import { Modal } from '../components/common/Modal';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { ChannelBadge } from '../components/common/Badge';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#f43f5e','#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-slate-700/50">
        <p className="font-semibold text-slate-200 mb-1">{label}</p>
        {payload.map((e, i) => (
          <p key={i} style={{ color: e.color }}>
            {e.name}: <strong>{typeof e.value === 'number' && e.name.includes('Revenue') ? '$' + e.value.toFixed(2) : e.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AddSaleModal = ({ products, onSave, onClose, isSaving }) => {
  const [form, setForm] = useState({ product: '', quantity: 1, unit_price: '', customer_name: 'Walk-in Customer', channel: 'IN_STORE', notes: '' });

  const handleProductChange = (e) => {
    const p = products.find(p => String(p.id) === e.target.value);
    setForm(f => ({ ...f, product: e.target.value, unit_price: p ? p.unit_price : '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Product *</label>
        <select value={form.product} onChange={handleProductChange} required className={fieldCls}>
          <option value="">Select a product...</option>
          {products.map(p => (
            <option key={p.id} value={p.id} disabled={p.current_stock === 0}>
              {p.name} ({p.sku}) — Stock: {p.current_stock}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quantity *</label>
          <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} required className={fieldCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Unit Price ($) *</label>
          <input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} required className={fieldCls} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Customer Name</label>
        <input type="text" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className={fieldCls} placeholder="Walk-in Customer" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Sales Channel</label>
        <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className={fieldCls}>
          <option value="IN_STORE">In-Store POS</option>
          <option value="ONLINE">E-Commerce</option>
          <option value="WHOLESALE">Wholesale Partner</option>
          <option value="B2B">Corporate B2B</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-60">
          {isSaving ? 'Recording...' : 'Record Sale'}
        </button>
      </div>
    </form>
  );
};

export const SalesPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saleModal, setSaleModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;

      const [analyticsData, salesData] = await Promise.all([
        salesApi.getAnalytics(params),
        salesApi.getSales({ ...params, page_size: 20 })
      ]);
      setAnalytics(analyticsData);
      setSales(salesData.results || salesData);
    } catch (err) {
      setError(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  useEffect(() => {
    inventoryApi.getProducts({ page_size: 200 }).then(d => setProducts(d.results || d));
  }, []);

  const handleAddSale = async (formData) => {
    setIsSaving(true);
    try {
      await salesApi.createSale(formData);
      toast.success('Sale recorded and inventory updated!');
      setSaleModal(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.quantity?.[0] || err.response?.data?.detail || 'Failed to record sale';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    const token = localStorage.getItem('stockwise_access_token');
    fetch(salesApi.getExportCsvUrl(), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'sales_report.csv'; a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await salesApi.importCsv(file);
      toast.success(res.message || 'Sales imported successfully!');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Sales import failed';
      toast.error(msg);
    }
  };

  const formatDate = (d) => { const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`; };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
        <ChartSkeleton /><TableSkeleton />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const daily = analytics?.daily_trends || [];
  const categoryData = analytics?.category_sales || [];
  const topProducts = analytics?.top_products || [];
  const channelData = analytics?.channel_breakdown || [];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
            <label className="text-xs text-slate-500 font-medium">From:</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="text-sm text-slate-700 outline-none bg-transparent" />
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
            <label className="text-xs text-slate-500 font-medium">To:</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="text-sm text-slate-700 outline-none bg-transparent" />
          </div>
          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 bg-white border border-slate-200 rounded-xl">Clear</button>
          )}
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs cursor-pointer transition-all">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
          </label>
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setSaleModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all">
            <Plus className="w-4 h-4" /> Record Sale
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard title="Total Revenue" value={`$${(analytics?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={DollarSign} iconGradient="from-emerald-500 to-teal-500" />
        <MetricCard title="Units Sold" value={(analytics?.total_units_sold || 0).toLocaleString()} icon={ShoppingCart} iconGradient="from-blue-600 to-indigo-600" />
        <MetricCard title="Total Orders" value={(analytics?.total_orders || 0).toLocaleString()} icon={Package} iconGradient="from-violet-600 to-purple-600" />
        <MetricCard title="Avg. Order Value" value={`$${(analytics?.average_order_value || 0).toFixed(2)}`} icon={TrendingUp} iconGradient="from-amber-500 to-orange-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Sales Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">Daily Sales Trend</h3>
          <p className="text-xs text-slate-500 mb-5">Units sold and revenue by day</p>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={daily} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sale_date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="left" type="monotone" dataKey="units" name="Units Sold" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#10b981" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No sales data" description="Record your first sale to see trends" />}
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">By Category</h3>
          <p className="text-xs text-slate-500 mb-4">Sales distribution</p>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3} dataKey="units" nameKey="category">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {categoryData.slice(0, 5).map((c, i) => (
                  <div key={c.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></span>
                      <span className="text-slate-600 truncate max-w-[120px]">{c.category}</span>
                    </div>
                    <span className="font-bold text-slate-800">{c.units} units</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState title="No data" description="No categorized sales yet" />}
        </div>
      </div>

      {/* Top Products + Sales History */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Top Selling Products</h3>
          </div>
          {topProducts.length > 0 ? (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts.slice(0,7)} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="product__name" tick={{ fontSize: 9, fill: '#64748b' }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="units_sold" name="Units Sold" radius={[0, 4, 4, 0]} fill="#3b82f6" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="p-8"><EmptyState title="No sales data" description="Record your first sale" /></div>}
        </div>

        {/* Recent Sales History Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Recent Sales</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">Invoice</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">No sales records found</td></tr>
                ) : sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-blue-700 font-semibold">{s.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[140px] truncate">{s.product_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{s.quantity}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">${Number(s.total_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">{s.sale_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={saleModal} onClose={() => setSaleModal(false)} title="Record New Sale" subtitle="This will automatically deduct from inventory" maxWidth="max-w-md">
        <AddSaleModal products={products} onSave={handleAddSale} onClose={() => setSaleModal(false)} isSaving={isSaving} />
      </Modal>
    </div>
  );
};

