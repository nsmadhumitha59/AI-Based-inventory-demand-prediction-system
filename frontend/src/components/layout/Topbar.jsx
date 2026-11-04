import React from 'react';
import { Menu, Bell, Search, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/inventory': { title: 'Inventory Management', breadcrumb: ['Home', 'Inventory'] },
  '/forecast': { title: 'AI Demand Forecast', breadcrumb: ['Home', 'AI Forecast'] },
  '/sales': { title: 'Sales Analytics', breadcrumb: ['Home', 'Sales Analytics'] },
  '/suppliers': { title: 'Supplier Management', breadcrumb: ['Home', 'Suppliers'] },
  '/reports': { title: 'Reports & Exports', breadcrumb: ['Home', 'Reports'] },
  '/settings': { title: 'Account Settings', breadcrumb: ['Home', 'Settings'] },
};

export const Topbar = ({ onMenuOpen }) => {
  const { user } = useAuth();
  const location = useLocation();
  const current = PAGE_TITLES[location.pathname] || { title: 'StockWise AI', breadcrumb: ['Home'] };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left: Mobile menu toggle + Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuOpen}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{current.title}</h1>
            <nav className="flex items-center gap-1 text-xs text-slate-400 font-medium">
              {current.breadcrumb.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3 h-3" />}
                  <span className={idx === current.breadcrumb.length - 1 ? 'text-blue-600' : ''}>{crumb}</span>
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>

        {/* Right: Search, Notifications, User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Search */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm text-slate-400 cursor-pointer transition-colors w-44 lg:w-56 group">
            <Search className="w-4 h-4 shrink-0" />
            <span className="text-xs group-hover:text-slate-600 transition-colors">Search products...</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-400 font-mono">⌘K</kbd>
          </div>

          {/* Notifications */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs group-hover:shadow-md transition-shadow">
              {user?.username ? user.username.slice(0, 2) : 'SW'}
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-slate-800">
                {user?.first_name ? `${user.first_name}` : user?.username}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {user?.profile?.role?.replace('_', ' ') || 'Manager'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
