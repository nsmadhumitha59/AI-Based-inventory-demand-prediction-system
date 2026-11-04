import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Mail, Phone, Truck, Users, MapPin } from 'lucide-react';
import { suppliersApi } from '../api/suppliers';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import toast from 'react-hot-toast';

const SupplierForm = ({ supplier, onSave, onClose, isSaving }) => {
  const [form, setForm] = useState(supplier || {
    name: '', contact_person: '', email: '', phone: '', address: '', lead_time_days: 7, status: 'ACTIVE'
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className={labelCls}>Supplier Name *</label>
        <input name="name" value={form.name} onChange={handleChange} required className={fieldCls} placeholder="Apex Global Electronics Ltd" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contact Person</label>
          <input name="contact_person" value={form.contact_person} onChange={handleChange} className={fieldCls} placeholder="Michael Chang" />
        </div>
        <div>
          <label className={labelCls}>Lead Time (Days)</label>
          <input name="lead_time_days" type="number" min="1" value={form.lead_time_days} onChange={handleChange} className={fieldCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} className={fieldCls} placeholder="contact@supplier.com" />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} className={fieldCls} placeholder="+1 (555) 234-5678" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Address</label>
        <textarea name="address" value={form.address} onChange={handleChange} rows={2} className={fieldCls} placeholder="450 Industrial Parkway, Fremont, CA" />
      </div>
      <div>
        <label className={labelCls}>Status</label>
        <select name="status" value={form.status} onChange={handleChange} className={fieldCls}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-60">
          {isSaving ? 'Saving...' : (supplier ? 'Update Supplier' : 'Add Supplier')}
        </button>
      </div>
    </form>
  );
};

export const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState({ open: false, supplier: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { search, status: statusFilter };
      const data = await suppliersApi.getSuppliers(params);
      setSuppliers(data.results || data);
    } catch (err) {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [search, statusFilter]);

  const handleSave = async (formData) => {
    setIsSaving(true);
    try {
      if (modal.supplier) {
        await suppliersApi.updateSupplier(modal.supplier.id, formData);
        toast.success('Supplier updated');
      } else {
        await suppliersApi.createSupplier(formData);
        toast.success('Supplier added');
      }
      setModal({ open: false, supplier: null });
      fetchSuppliers();
    } catch (err) {
      const errData = err.response?.data;
      const msg = typeof errData === 'object' ? Object.values(errData).flat()[0] : 'Save failed';
      toast.error(String(msg));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await suppliersApi.deleteSupplier(deleteDialog.id);
      toast.success(`"${deleteDialog.name}" deleted`);
      setDeleteDialog({ open: false, id: null, name: '' });
      fetchSuppliers();
    } catch { toast.error('Delete failed'); } finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-500">{suppliers.length} registered suppliers</p>
        <button
          onClick={() => setModal({ open: true, supplier: null })}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all"
        >
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm text-slate-900 placeholder-slate-400 flex-1 outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Suppliers List */}
        <div className="lg:col-span-2">
          {loading ? <TableSkeleton rows={5} cols={4} /> : error ? <ErrorState message={error} onRetry={fetchSuppliers} /> : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              {suppliers.length === 0 ? (
                <div className="p-12"><EmptyState icon={Truck} title="No suppliers found" description="Add your first supplier to get started" actionLabel="Add Supplier" onAction={() => setModal({ open: true, supplier: null })} /></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {suppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      className={`flex items-start justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group ${selectedSupplier?.id === supplier.id ? 'bg-blue-50/70 border-l-4 border-l-blue-500' : ''}`}
                      onClick={() => setSelectedSupplier(supplier)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 flex items-center justify-center text-base font-black shrink-0">
                          {supplier.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{supplier.name}</div>
                          {supplier.contact_person && <div className="text-xs text-slate-500 mt-0.5">{supplier.contact_person}</div>}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {supplier.email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{supplier.email}</span>}
                            {supplier.phone && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{supplier.phone}</span>}
                            <span className="text-xs text-slate-400 flex items-center gap-1"><Truck className="w-3 h-3" />{supplier.lead_time_days}d lead time</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${supplier.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>{supplier.status}</span>
                        <button onClick={e => { e.stopPropagation(); setModal({ open: true, supplier }); }} className="w-8 h-8 rounded-lg text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={e => { e.stopPropagation(); setDeleteDialog({ open: true, id: supplier.id, name: supplier.name }); }} className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supplier Detail Card */}
        <div>
          {selectedSupplier ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sticky top-20">
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xl flex items-center justify-center">
                  {selectedSupplier.name.slice(0, 2).toUpperCase()}
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${selectedSupplier.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                  {selectedSupplier.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{selectedSupplier.name}</h3>
              {selectedSupplier.contact_person && <p className="text-sm text-slate-500 mb-4">{selectedSupplier.contact_person}</p>}
              <div className="space-y-3">
                {selectedSupplier.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-600">{selectedSupplier.email}</span>
                  </div>
                )}
                {selectedSupplier.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-600">{selectedSupplier.phone}</span>
                  </div>
                )}
                {selectedSupplier.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600">{selectedSupplier.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-600">Lead time: <strong>{selectedSupplier.lead_time_days} days</strong></span>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Supplied Products</div>
                {selectedSupplier.supplied_products?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedSupplier.supplied_products.slice(0, 5).map(sp => (
                      <div key={sp.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{sp.product_name}</span>
                        <span className="text-slate-400">${sp.supply_price}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No products linked yet</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Click a supplier to view details</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, supplier: null })} title={modal.supplier ? 'Edit Supplier' : 'Add New Supplier'} maxWidth="max-w-lg">
        <SupplierForm supplier={modal.supplier} onSave={handleSave} onClose={() => setModal({ open: false, supplier: null })} isSaving={isSaving} />
      </Modal>
      <ConfirmDialog isOpen={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, name: '' })} onConfirm={handleDelete} title="Delete Supplier" message={`Delete "${deleteDialog.name}"?`} confirmText="Delete" isLoading={isSaving} />
    </div>
  );
};

