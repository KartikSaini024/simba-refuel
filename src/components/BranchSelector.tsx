import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserBranches, Branch } from '@/hooks/useUserBranches';

interface BranchSelectorProps {
  selectedBranchId: string | null;
  onBranchChange: (branchId: string) => void;
  className?: string;
}

const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  selectedBranchId, 
  onBranchChange, 
  className 
}) => {
  const { accessibleBranches, loading } = useUserBranches();

  // Auto-select first branch if not already selected and user has access to only one
  React.useEffect(() => {
    if (accessibleBranches.length === 1 && !selectedBranchId) {
      onBranchChange(accessibleBranches[0].id);
    }
  }, [accessibleBranches, selectedBranchId, onBranchChange]);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading branches..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (accessibleBranches.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="No branches available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={selectedBranchId || ''} onValueChange={onBranchChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {accessibleBranches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.code} - {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default BranchSelector;