import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, Download, Upload, RefreshCw, Edit2, Trash2,
  Package, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRightLeft
} from 'lucide-react';
import { inventoryApi } from '../api/inventory';
import { StockStatusBadge } from '../components/common/Badge';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';

const ProductForm = ({ product, categories, onSave, onClose, isSaving }) => {
  const [form, setForm] = useState(
    product || {
      name: '', sku: '', category: '', unit_price: '', cost_price: '0.00',
      current_stock: 0, reorder_level: 15, safety_stock: 5, lead_time_days: 7,
      description: '', image_url: ''
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
  const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Product Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required className={fieldCls} placeholder="UltraComfort ANC Headphones" />
        </div>
        <div>
          <label className={labelCls}>SKU *</label>
          <input name="sku" value={form.sku} onChange={handleChange} required className={fieldCls} placeholder="TECH-ANC-001" />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select name="category" value={form.category || ''} onChange={handleChange} className={fieldCls}>
            <option value="">-- No Category --</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Unit Price ($) *</label>
          <input name="unit_price" type="number" step="0.01" min="0" value={form.unit_price} onChange={handleChange} required className={fieldCls} placeholder="149.99" />
        </div>
        <div>
          <label className={labelCls}>Cost Price ($)</label>
          <input name="cost_price" type="number" step="0.01" min="0" value={form.cost_price} onChange={handleChange} className={fieldCls} placeholder="85.00" />
        </div>
        <div>
          <label className={labelCls}>Current Stock *</label>
          <input name="current_stock" type="number" min="0" value={form.current_stock} onChange={handleChange} required className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Reorder Level</label>
          <input name="reorder_level" type="number" min="0" value={form.reorder_level} onChange={handleChange} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Safety Stock</label>
          <input name="safety_stock" type="number" min="0" value={form.safety_stock} onChange={handleChange} className={fieldCls} />
        </div>
        <div>
          <label className={labelCls}>Lead Time (Days)</label>
          <input name="lead_time_days" type="number" min="1" value={form.lead_time_days} onChange={handleChange} className={fieldCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={fieldCls} placeholder="Brief product description..." />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-60">
          {isSaving ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
        </button>
      </div>
    </form>
  );
};

const StockAdjustForm = ({ product, onSave, onClose, isSaving }) => {
  const [form, setForm] = useState({ movement_type: 'IN', quantity: 1, reason: '', reference: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
        <div className="font-semibold text-slate-800">{product.name}</div>
        <div className="text-slate-500 mt-0.5">SKU: {product.sku} · Current stock: <strong className="text-slate-700">{product.current_stock} units</strong></div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Movement Type *</label>
        <select value={form.movement_type} onChange={(e) => setForm({ ...form, movement_type: e.target.value })} className={fieldCls}>
          <option value="IN">Stock In (Restock / Purchase)</option>
          <option value="OUT">Stock Out (Damage / Waste)</option>
          <option value="ADJUSTMENT">Manual Adjustment (Set exact quantity)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          {form.movement_type === 'ADJUSTMENT' ? 'New Stock Quantity *' : 'Quantity *'}
        </label>
        <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} required className={fieldCls} />
        {form.movement_type === 'ADJUSTMENT' && (
          <p className="text-xs text-slate-500 mt-1">Stock will be set to this exact value</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Reason *</label>
        <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={3} placeholder="e.g. Supplier delivery #PO-2024-001" className={fieldCls} />
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-60">
          {isSaving ? 'Applying...' : 'Apply Adjustment'}
        </button>
      </div>
    </form>
  );
};

export const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  // Modals
  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [adjustModal, setAdjustModal] = useState({ open: false, product: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, productId: null, productName: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, search, page_size: pageSize };
      if (selectedCategory) params.category = selectedCategory;
      if (statusFilter) params.status = statusFilter;
      const data = await inventoryApi.getProducts(params);
      setProducts(data.results || data);
      setTotalCount(data.count || (data.results?.length ?? 0));
      setTotalPages(Math.ceil((data.count || 0) / pageSize) || 1);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, statusFilter, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    inventoryApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSaveProduct = async (formData) => {
    setIsSaving(true);
    try {
      if (productModal.product) {
        await inventoryApi.updateProduct(productModal.product.id, formData);
        toast.success('Product updated successfully');
      } else {
        await inventoryApi.createProduct(formData);
        toast.success('Product created successfully');
      }
      setProductModal({ open: false, product: null });
      fetchProducts();
    } catch (err) {
      const errData = err.response?.data;
      if (typeof errData === 'object') {
        const msgs = Object.entries(errData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`);
        toast.error(msgs[0]);
      } else {
        toast.error('Failed to save product');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await inventoryApi.deleteProduct(deleteDialog.productId);
      toast.success(`"${deleteDialog.productName}" deleted`);
      setDeleteDialog({ open: false, productId: null, productName: '' });
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStockAdjust = async (formData) => {
    setIsSaving(true);
    try {
      await inventoryApi.adjustStock(adjustModal.product.id, formData);
      toast.success('Stock adjusted successfully');
      setAdjustModal({ open: false, product: null });
      fetchProducts();
    } catch (err) {
      const msg = err.response?.data?.quantity?.[0] || err.response?.data?.error || 'Stock adjustment failed';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so the same file can be re-imported later
    e.target.value = '';
    try {
      const result = await inventoryApi.importCsv(file);
      const { created_count, updated_count, skipped_count, error_count, errors } = result;

      if (created_count === 0 && updated_count === 0) {
        // Nothing was imported – show a warning with any row errors
        toast.error(
          `Import finished with 0 changes.${errors && errors.length ? ' Check errors below.' : ''}`,
          { duration: 6000 }
        );
      } else {
        const parts = [];
        if (created_count) parts.push(`${created_count} new`);
        if (updated_count) parts.push(`${updated_count} updated`);
        toast.success(`Imported: ${parts.join(', ')}`, { duration: 5000 });
      }

      // Show first few row-level errors as separate toasts
      if (errors && errors.length > 0) {
        const preview = errors.slice(0, 3);
        preview.forEach(msg => toast.error(msg, { duration: 8000 }));
        if (errors.length > 3) {
          toast.error(`…and ${errors.length - 3} more error(s). Check Django logs for details.`, { duration: 8000 });
        }
      }

      fetchProducts();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || 'CSV import failed. Check the file format.';
      toast.error(msg, { duration: 6000 });
      // Show detailed row-level errors from pre-flight / validation failures
      if (data?.errors && data.errors.length > 0) {
        const preview = data.errors.slice(0, 3);
        preview.forEach(e => toast.error(e, { duration: 8000 }));
        if (data.errors.length > 3) {
          toast.error(`…and ${data.errors.length - 3} more error(s).`, { duration: 8000 });
        }
      }
    }
  };


  const handleCsvExport = () => {
    const token = localStorage.getItem('stockwise_access_token');
    const url = inventoryApi.getExportCsvUrl();
    const a = document.createElement('a');
    a.href = url + (token ? `?auth=${token}` : '');
    a.download = 'inventory.csv';
    // Use axios instead via direct fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'stockwise_inventory.csv';
        link.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{totalCount.toLocaleString()} products in your catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs cursor-pointer transition-all">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          </label>
          <button onClick={handleCsvExport} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-all">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setProductModal({ open: true, product: null })}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-slate-900 placeholder-slate-400 flex-1 outline-none"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
          <option value="OVERSTOCKED">Overstocked</option>
        </select>
        <button onClick={() => { setSearch(''); setSelectedCategory(''); setStatusFilter(''); setPage(1); }}
          className="px-3.5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton rows={10} cols={7} /> : error ? <ErrorState message={error} onRetry={fetchProducts} /> : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Product', 'SKU', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16">
                      <EmptyState
                        icon={Package}
                        title="No products found"
                        description="Try adjusting your search or filters, or add your first product."
                        actionLabel="Add Product"
                        onAction={() => setProductModal({ open: true, product: null })}
                      />
                    </td>
                  </tr>
                ) : products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 max-w-[180px] truncate">{product.name}</div>
                          <div className="text-xs text-slate-400">{product.total_units_sold?.toLocaleString() || 0} sold</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-mono">{product.sku}</code>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-xs">{product.category_name || '—'}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">${Number(product.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{product.current_stock.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-400">reorder: {product.reorder_level}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StockStatusBadge status={product.stock_status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setAdjustModal({ open: true, product })}
                          title="Adjust Stock"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setProductModal({ open: true, product })}
                          title="Edit Product"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ open: true, productId: product.id, productName: product.name })}
                          title="Delete Product"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>
                  Showing <strong className="text-slate-700 font-semibold">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong className="text-slate-700 font-semibold">{Math.min(page * pageSize, totalCount)}</strong> of <strong className="text-slate-700 font-semibold">{totalCount.toLocaleString()}</strong> products
                </span>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                  <span className="text-slate-400 font-medium">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-2 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* First Page */}
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    title="First Page"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  {/* Previous Page */}
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    title="Previous Page"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Numbered Page Buttons */}
                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 font-semibold select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                          page === p
                            ? 'bg-blue-600 text-white shadow-xs pointer-events-none'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  {/* Next Page */}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    title="Next Page"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {/* Last Page */}
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    title="Last Page"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        title={productModal.product ? 'Edit Product' : 'Add New Product'}
        subtitle={productModal.product ? `Editing: ${productModal.product.name}` : 'Fill in product details below'}
        maxWidth="max-w-2xl"
      >
        <ProductForm
          product={productModal.product}
          categories={categories}
          onSave={handleSaveProduct}
          onClose={() => setProductModal({ open: false, product: null })}
          isSaving={isSaving}
        />
      </Modal>

      <Modal
        isOpen={adjustModal.open}
        onClose={() => setAdjustModal({ open: false, product: null })}
        title="Adjust Stock"
        subtitle="Record a stock movement for audit trail"
        maxWidth="max-w-md"
      >
        {adjustModal.product && (
          <StockAdjustForm
            product={adjustModal.product}
            onSave={handleStockAdjust}
            onClose={() => setAdjustModal({ open: false, product: null })}
            isSaving={isSaving}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, productId: null, productName: '' })}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${deleteDialog.productName}"? All associated stock movements and sales records will be affected.`}
        confirmText="Delete Permanently"
        isLoading={isSaving}
      />
    </div>
  );
};

