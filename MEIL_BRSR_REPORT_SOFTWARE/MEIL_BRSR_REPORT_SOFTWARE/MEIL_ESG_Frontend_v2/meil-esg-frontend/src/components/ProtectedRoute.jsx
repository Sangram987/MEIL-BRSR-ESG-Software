import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/AppStore';
import { ROLE_META } from '../data/brsr';

export default function ProtectedRoute({ roles, children }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname, roles }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_META[user.role].home} replace />;
  return children;
}
