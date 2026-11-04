import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Home } from 'lucide-react';

export const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="text-center max-w-md">
      <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4">404</div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-slate-500 mb-8">The page you're looking for doesn't exist or has been moved. Use the navigation to find your way back.</p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
      >
        <Home className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  </div>
);

