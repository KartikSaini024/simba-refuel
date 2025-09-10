import React from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import Index from './Index';

const AdminBranchOperations = () => {
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch');
  
  if (!branchId) {
    return <Navigate to="/admin" replace />;
  }
  
  return <Index />;
};

export default AdminBranchOperations;