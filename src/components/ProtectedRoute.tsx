import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { PageLoader } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireApproved?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireApproved = true 
}) => {
  const { user, profile, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return <PageLoader text="Authenticating..." />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireApproved && profile?.status !== 'approved') {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;