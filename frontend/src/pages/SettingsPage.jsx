import React, { useState } from 'react';
import { User, Building, Phone, Mail, Save, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';

export const SettingsPage = () => {
  const { user, setUser } = useAuth();
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    company_name: user?.profile?.company_name || '',
    phone: user?.profile?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authApi.updateProfile(profileForm);
      setUser(updated);
      localStorage.setItem('stockwise_user', JSON.stringify(updated));
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4.5 h-4.5 text-blue-600" /> Profile Information
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Update your personal account details</p>
        </div>
        <form onSubmit={handleProfileSave} className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xl flex items-center justify-center uppercase shadow-md">
              {user?.username ? user.username.slice(0, 2) : 'SW'}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">{user?.username}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Role: <span className="text-blue-600 font-semibold capitalize">{user?.profile?.role?.replace('_', ' ') || 'Manager'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name</label>
              <input type="text" value={profileForm.first_name} onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))} className={fieldCls} placeholder="Sarah" />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" value={profileForm.last_name} onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))} className={fieldCls} placeholder="Connor" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} className={fieldCls} placeholder="sarah@company.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company Name</label>
              <input type="text" value={profileForm.company_name} onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value }))} className={fieldCls} placeholder="StockWise Retail" />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="text" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} className={fieldCls} placeholder="+1 (555) 123-4567" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* About section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">About StockWise AI</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between"><span className="font-medium text-slate-700">Application</span><span>StockWise AI – Inventory Intelligence Platform</span></div>
            <div className="flex justify-between"><span className="font-medium text-slate-700">Backend</span><span>Django 5.2 + Django REST Framework</span></div>
            <div className="flex justify-between"><span className="font-medium text-slate-700">Frontend</span><span>React 19 + Vite + TailwindCSS v4</span></div>
            <div className="flex justify-between"><span className="font-medium text-slate-700">ML Engine</span><span>scikit-learn Random Forest Regressor</span></div>
            <div className="flex justify-between"><span className="font-medium text-slate-700">Authentication</span><span>JWT (djangorestframework-simplejwt)</span></div>
            <div className="flex justify-between"><span className="font-medium text-slate-700">Database</span><span>SQLite (PostgreSQL compatible)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

