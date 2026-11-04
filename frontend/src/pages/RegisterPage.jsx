import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, ArrowRight, UserPlus } from 'lucide-react';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', confirm_password: '', company_name: 'StockWise Retail',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/login');
    } catch {
      // errors handled by toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <span className="font-bold text-slate-900 text-xl">StockWise <span className="text-blue-600">AI</span></span>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h2>
        <p className="text-slate-500 text-sm mb-6">Start managing inventory with AI-powered insights</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'First Name', name: 'first_name', type: 'text', placeholder: 'Sarah' },
              { label: 'Last Name', name: 'last_name', type: 'text', placeholder: 'Connor' },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={form[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            ))}
          </div>

          {[
            { label: 'Username *', name: 'username', type: 'text', placeholder: 'sarah_conner', required: true },
            { label: 'Email Address', name: 'email', type: 'email', placeholder: 'sarah@company.com' },
            { label: 'Company Name', name: 'company_name', type: 'text', placeholder: 'StockWise Retail' },
          ].map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{field.label}</label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required={field.required}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Password *', name: 'password' },
              { label: 'Confirm Password *', name: 'confirm_password' },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{field.label}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder="••••••"
                    required
                    minLength={6}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {field.name === 'password' && (
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/25 transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating Account…</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Create Account</>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

