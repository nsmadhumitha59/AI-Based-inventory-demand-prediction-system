import React, { useState, useEffect } from 'react';
import {
  BrainCircuit, Zap, AlertTriangle, CheckCircle, TrendingUp, Info,
  ChevronDown, RefreshCw, CalendarDays, BarChart3, PackageCheck
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { forecastingApi } from '../api/forecasting';
import { inventoryApi } from '../api/inventory';
import { PriorityBadge } from '../components/common/Badge';
import { ChartSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import toast from 'react-hot-toast';

const CHART_COLORS = { primary: '#3b82f6', secondary: '#8b5cf6', actual: '#10b981' };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-slate-700/50">
        <p className="font-semibold text-slate-200 mb-1">{label}</p>
        {payload.map((entry, i) => entry.value !== null && (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{Number(entry.value).toFixed(1)} units</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ForecastPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [horizonDays, setHorizonDays] = useState(30);
  const [forecastData, setForecastData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noSalesDataInfo, setNoSalesDataInfo] = useState(null);

  useEffect(() => {
    // Fetch products using lookup endpoint so all products are available and sorted by sales count
    const loadProducts = async () => {
      try {
        let list = await inventoryApi.getProductsLookup();
        if (!list || list.length === 0) {
          const fallback = await inventoryApi.getProducts({ page_size: 100 });
          list = fallback.results || fallback;
        }
        setProducts(list);
        if (list.length > 0) {
          const firstId = String(list[0].id);
          setSelectedProductId(firstId);
          handleViewProductForecast(firstId);
        }
      } catch (err) {
        console.error('Failed to load products lookup:', err);
      }
    };

    loadProducts();

    forecastingApi.getRecommendations({ status: 'PENDING' }).then((d) => {
      setRecommendations(d.results || d);
      setRecLoading(false);
    }).catch(() => setRecLoading(false));
  }, []);

  const handleProductSelect = async (productId) => {
    setSelectedProductId(String(productId));
    setError(null);
    setNoSalesDataInfo(null);
    await handleViewProductForecast(productId);
  };

  const handleGenerateForecast = async (overrideHorizon) => {
    if (!selectedProductId) return;
    const targetHorizon = overrideHorizon !== undefined ? overrideHorizon : horizonDays;
    setGenerating(true);
    setError(null);
    setNoSalesDataInfo(null);
    try {
      const result = await forecastingApi.generateForecast(selectedProductId, targetHorizon);
      setForecastData(result);
      toast.success('Forecast generated successfully!');
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.error === 'NO_SALES_DATA') {
        setNoSalesDataInfo({
          productName: errData.product_name,
          sku: errData.product_sku,
          message: errData.detail,
          requiredColumns: errData.required_csv_columns,
          dateFormat: errData.date_format
        });
        setForecastData(null);
      } else {
        const msg = errData?.detail || errData?.error || 'Forecast generation failed';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleHorizonChange = (d) => {
    setHorizonDays(d);
    // If a forecast is already loaded or being inspected, regenerate for the new horizon
    if (forecastData && selectedProductId) {
      handleGenerateForecast(d);
    }
  };

  const handleViewProductForecast = async (productId) => {
    setSelectedProductId(String(productId));
    setLoading(true);
    setError(null);
    try {
      const data = await forecastingApi.getProductForecast(productId);
      if (!data.has_sales_data && data.sales_count === 0) {
        setNoSalesDataInfo({
          productName: data.product_name,
          sku: data.product_sku,
          message: `No historical sales transactions found for "${data.product_name}" (${data.product_sku}). AI demand forecasting requires recorded sales transactions or a historical sales CSV upload.`
        });
        setForecastData(null);
      } else if (data.latest_run) {
        setNoSalesDataInfo(null);
        setForecastData({
          forecast_run: data.latest_run,
          recommendation: data.recommendation,
          historical_sales: data.historical_sales
        });
      } else {
        setForecastData(null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDismissRecommendation = async (recId) => {
    try {
      await forecastingApi.reviewRecommendation(recId, 'DISMISSED');
      setRecommendations(prev => prev.filter(r => r.id !== recId));
      toast.success('Recommendation dismissed');
    } catch {
      toast.error('Failed to update recommendation');
    }
  };

  const handleMarkReviewed = async (recId) => {
    try {
      await forecastingApi.reviewRecommendation(recId, 'REVIEWED');
      setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, status: 'REVIEWED' } : r));
      toast.success('Marked as reviewed');
    } catch {
      toast.error('Failed to update recommendation');
    }
  };

  // Merge historical + forecast for chart
  const chartData = React.useMemo(() => {
    if (!forecastData) return [];
    const hist = (forecastData.historical_sales || []).map(h => ({
      date: h.date,
      actual: h.actual_quantity,
      forecast: null,
      lower: null,
      upper: null,
    }));
    const future = (forecastData.forecast_run?.results || []).map(f => ({
      date: f.date,
      actual: null,
      forecast: f.predicted_quantity,
      lower: f.lower_bound,
      upper: f.upper_bound,
    }));
    return [...hist, ...future];
  }, [forecastData]);

  const formatDate = (d) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const run = forecastData?.forecast_run;
  const rec = forecastData?.recommendation;
  const metrics = run?.evaluation_metrics || {};

  return (
    <div className="space-y-6">
      {/* Controls Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) {p.sales_count > 0 ? `· ${p.sales_count} sales` : '· (No sales data)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Forecast Horizon</label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-semibold">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => handleHorizonChange(d)}
                  className={`px-4 py-2.5 transition-colors ${horizonDays === d ? 'bg-blue-600 text-white' : 'text-slate-600 bg-white hover:bg-slate-50'}`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleGenerateForecast()}
            disabled={generating || !selectedProductId}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all disabled:opacity-60"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : (
              <><BrainCircuit className="w-4 h-4" /> Generate AI Forecast</>
            )}
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && <ChartSkeleton />}

      {/* Dedicated No Sales Data Banner */}
      {noSalesDataInfo && !loading && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-amber-900 shadow-xs space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-bold text-amber-900">
                No Usable Historical Sales Data
              </h3>
              <p className="text-sm text-amber-800">
                {noSalesDataInfo.message}
              </p>
              <div className="mt-3 p-3.5 bg-white/90 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Required Sales CSV Format to Enable Forecasting:
                </div>
                <div className="font-mono text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                  Invoice #, Sale Date, SKU, Quantity, Unit Price, Customer, Channel
                </div>
                <ul className="text-slate-600 space-y-1 list-disc pl-4 text-[11px]">
                  <li><strong>Sale Date:</strong> Format <code>YYYY-MM-DD</code> (e.g. <code>2026-03-15</code>)</li>
                  <li><strong>SKU:</strong> Must match product SKU (<code>{noSalesDataInfo.sku}</code>)</li>
                  <li><strong>Channel:</strong> <code>IN_STORE</code>, <code>ONLINE</code>, <code>WHOLESALE</code>, or <code>B2B</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && <ErrorState message={error} onRetry={() => handleGenerateForecast()} />}

      {/* Forecast Results */}
      {forecastData && run && (
        <div className="space-y-5">
          {/* Model Info Banner */}
          <div className={`rounded-2xl border p-4 flex items-start gap-4 ${run.is_sufficient_data ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-300'}`}>
            {run.is_sufficient_data ? (
              <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-bold ${run.is_sufficient_data ? 'text-blue-800' : 'text-amber-800'}`}>
                {run.is_sufficient_data ? '🤖 AI Model Active: ' : '⚠️ Baseline Fallback: '}
                {run.model_name}
              </p>
              <p className={`text-xs mt-0.5 ${run.is_sufficient_data ? 'text-blue-600' : 'text-amber-700'}`}>{run.notes}</p>
            </div>
            <div className="text-[10px] text-slate-400 shrink-0">
              {new Date(run.created_at).toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Main Forecast Chart */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{run.product_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Historical actual sales vs {horizonDays}-day AI forecast</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-emerald-500 inline-block rounded-full"></span> Actual</span>
                  <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-violet-500 inline-block rounded-full border-b-2 border-dashed"></span> Forecast</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ left: -20, right: 8 }}>
                  <defs>
                    <linearGradient id="actualGr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.actual} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.actual} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fcGr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="actual" name="Actual Sales" stroke={CHART_COLORS.actual} fill="url(#actualGr)" strokeWidth={2.5} dot={false} connectNulls />
                  <Area type="monotone" dataKey="forecast" name="AI Forecast" stroke={CHART_COLORS.secondary} fill="url(#fcGr)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                  <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls />
                  <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics + Recommendation */}
            <div className="space-y-4">
              {/* Model Evaluation Metrics */}
              {run.is_sufficient_data && metrics.mae !== null && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                  <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" /> Evaluation Metrics
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'MAE (Mean Abs. Error)', value: metrics.mae?.toFixed(2), good: metrics.mae < 3, hint: 'Lower is better' },
                      { label: 'RMSE', value: metrics.rmse?.toFixed(2), good: metrics.rmse < 5, hint: 'Lower is better' },
                      { label: 'MAPE (%)', value: metrics.mape?.toFixed(1) + '%', good: metrics.mape < 20, hint: 'Lower is better' },
                      { label: 'R² Score', value: metrics.r2?.toFixed(3), good: metrics.r2 > 0.7, hint: 'Closer to 1.0 is better' },
                    ].map(m => (
                      <div key={m.label} className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-slate-600">{m.label}</div>
                          <div className="text-[10px] text-slate-400">{m.hint}</div>
                        </div>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${m.good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {m.value ?? 'N/A'}
                        </span>
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      {metrics.evaluation_split}
                    </div>
                  </div>
                </div>
              )}

              {/* Reorder Recommendation */}
              {rec && (
                <div className={`rounded-2xl border p-5 ${
                  rec.priority === 'CRITICAL' ? 'bg-rose-50 border-rose-300' :
                  rec.priority === 'HIGH' ? 'bg-amber-50 border-amber-300' :
                  rec.priority === 'OPTIMAL' ? 'bg-emerald-50 border-emerald-300' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-800">Reorder Recommendation</h4>
                    <PriorityBadge priority={rec.priority} />
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Current Stock</span>
                      <span className="font-bold text-slate-900">{rec.current_stock} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Lead Time Demand</span>
                      <span className="font-bold text-slate-900">{rec.forecasted_demand_lead_time} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Safety Stock</span>
                      <span className="font-bold text-slate-900">{rec.safety_stock} units</span>
                    </div>
                    {rec.estimated_stockout_date && (
                      <div className="flex justify-between text-rose-700">
                        <span>Est. Stockout Date</span>
                        <span className="font-bold">{rec.estimated_stockout_date}</span>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-200/80">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700 font-semibold">Reorder Quantity</span>
                        <span className="text-2xl font-black text-slate-900">{rec.recommended_reorder_qty}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-2 p-2 bg-white/70 rounded-lg border border-slate-200/60">
                        {rec.reasoning}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Forecast Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Detailed {horizonDays}-Day Forecast</h3>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wide">Lower</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wide">Predicted</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wide">Upper</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(run.results || []).map((result, i) => (
                    <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{result.date}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{result.lower_bound?.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-700">{result.predicted_quantity?.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{result.upper_bound?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No forecast yet */}
      {!forecastData && !error && (
        <EmptyState
          icon={BrainCircuit}
          title="No forecast generated yet"
          description="Select a product, choose a forecast horizon, and click 'Generate AI Forecast' to see demand predictions powered by Random Forest ML."
          actionLabel="Generate Forecast Now"
          onAction={handleGenerateForecast}
        />
      )}

      {/* Pending Reorder Recommendations */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Pending Reorder Recommendations</h3>
          {recommendations.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
              {recommendations.filter(r => r.status === 'PENDING').length} pending
            </span>
          )}
        </div>
        {recLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={PackageCheck} title="No pending recommendations" description="All reorder recommendations have been reviewed" />
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recommendations.slice(0, 10).map((rec) => (
              <div key={rec.id} className="flex items-start justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <PriorityBadge priority={rec.priority} />
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{rec.product_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">SKU: {rec.product_sku} · Stock: {rec.current_stock} · Reorder: <strong>{rec.recommended_reorder_qty} units</strong></div>
                    {rec.estimated_stockout_date && (
                      <div className="text-xs text-rose-600 mt-0.5">⚠ Stockout est. {rec.estimated_stockout_date}</div>
                    )}
                  </div>
                </div>
                {rec.status === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleMarkReviewed(rec.id)}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      Reviewed
                    </button>
                    <button
                      onClick={() => handleDismissRecommendation(rec.id)}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {rec.status === 'REVIEWED' && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">Reviewed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

