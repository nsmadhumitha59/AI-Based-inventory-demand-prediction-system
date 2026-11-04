import React, { useState } from 'react';
import { FileText, Download, Package, ShoppingCart, AlertTriangle, Filter, Calendar } from 'lucide-react';
import { reportsApi } from '../api/reports';
import { StockStatusBadge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import toast from 'react-hot-toast';

const ReportCard = ({ icon: Icon, title, description, onGenerate, onDownload, loading }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
    <div className="flex gap-2 pt-2 border-t border-slate-100">
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex-1 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Preview'}
      </button>
      <button
        onClick={onDownload}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
      >
        <Download className="w-4 h-4" /> CSV
      </button>
    </div>
  </div>
);

export const ReportsPage = () => {
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchReport = async (type) => {
    setLoading(type);
    setError(null);
    setActiveReport(type);
    try {
      let data;
      const params = { start_date: dateRange.start, end_date: dateRange.end };
      if (type === 'inventory') data = await reportsApi.getInventoryReport();
      else if (type === 'sales') data = await reportsApi.getSalesReport(params);
      else if (type === 'low_stock') data = await reportsApi.getLowStockReport();
      setReportData({ type, data });
    } catch (err) {
      setError('Failed to load report');
      toast.error('Report load failed');
    } finally {
      setLoading(null);
    }
  };

  const downloadReport = (type) => {
    const token = localStorage.getItem('stockwise_access_token');
    let url;
    if (type === 'inventory') url = reportsApi.getInventoryCsvUrl();
    else if (type === 'sales') url = reportsApi.getSalesCsvUrl(dateRange.start, dateRange.end);
    else if (type === 'low_stock') url = reportsApi.getLowStockCsvUrl();

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = blobUrl; a.download = `${type}_report.csv`; a.click();
        URL.revokeObjectURL(blobUrl);
        toast.success('Report downloaded successfully');
      }).catch(() => toast.error('Download failed'));
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter (for sales reports) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          Date Range (Sales Reports)
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-xs text-slate-400 hover:text-slate-600 px-2">Clear</button>
          )}
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <ReportCard
          icon={Package}
          title="Inventory Summary"
          description="Full product catalog with stock levels, prices, and status"
          onGenerate={() => fetchReport('inventory')}
          onDownload={() => downloadReport('inventory')}
          loading={loading === 'inventory'}
        />
        <ReportCard
          icon={ShoppingCart}
          title="Sales Report"
          description="Complete sales history with revenue totals and channel breakdown"
          onGenerate={() => fetchReport('sales')}
          onDownload={() => downloadReport('sales')}
          loading={loading === 'sales'}
        />
        <ReportCard
          icon={AlertTriangle}
          title="Low Stock Report"
          description="Products below their reorder threshold that need attention"
          onGenerate={() => fetchReport('low_stock')}
          onDownload={() => downloadReport('low_stock')}
          loading={loading === 'low_stock'}
        />
      </div>

      {/* Report Preview Area */}
      {error && <ErrorState message={error} onRetry={() => fetchReport(activeReport)} />}

      {reportData && !error && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {reportData.type.replace('_', ' ')} Report Preview
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Showing up to 200 records</p>
            </div>
            <button
              onClick={() => downloadReport(reportData.type)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {reportData.type === 'inventory' && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>{['SKU','Name','Category','Stock','Reorder Lvl','Unit Price','Inv. Value','Status'].map(h => <th key={h} className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(reportData.data.products || []).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-blue-700">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.category}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{p.current_stock}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.reorder_level}</td>
                      <td className="px-4 py-2.5 font-semibold">${p.unit_price}</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700">${p.inventory_value.toFixed(2)}</td>
                      <td className="px-4 py-2.5"><StockStatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportData.type === 'sales' && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>{['Invoice','Date','Product','SKU','Qty','Unit Price','Total','Customer','Channel'].map(h => <th key={h} className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(reportData.data.sales || []).map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-blue-700 text-[11px]">{s.invoice_number}</td>
                      <td className="px-4 py-2.5 text-slate-600">{s.date}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[150px] truncate">{s.product_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.sku}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{s.quantity}</td>
                      <td className="px-4 py-2.5 text-slate-600">${s.unit_price}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-700">${s.total_price.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{s.customer}</td>
                      <td className="px-4 py-2.5 text-slate-500">{s.channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reportData.type === 'low_stock' && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>{['SKU','Product','Category','Stock','Reorder Lvl','Deficit','Status'].map(h => <th key={h} className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(reportData.data.products || []).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-blue-700">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.category}</td>
                      <td className="px-4 py-2.5 font-bold text-rose-700">{p.current_stock}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.reorder_level}</td>
                      <td className="px-4 py-2.5 font-bold text-amber-700">{p.deficit}</td>
                      <td className="px-4 py-2.5"><StockStatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary Footer */}
          {reportData.type === 'inventory' && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-sm">
              <span className="text-slate-600">{reportData.data.products?.length || 0} products</span>
              <span className="font-bold text-slate-900">Total Inventory Value: ${Number(reportData.data.total_inventory_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {reportData.type === 'sales' && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-sm">
              <span className="text-slate-600">{reportData.data.total_units_sold || 0} total units sold</span>
              <span className="font-bold text-emerald-700">Total Revenue: ${Number(reportData.data.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {reportData.type === 'low_stock' && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 text-sm text-slate-600">
              {reportData.data.low_stock_count || 0} products require attention
            </div>
          )}
        </div>
      )}

      {!reportData && !error && (
        <EmptyState
          icon={FileText}
          title="Select a report to preview"
          description="Click 'Preview' on any report type above to view data. Use 'CSV' to download directly."
        />
      )}
    </div>
  );
};

