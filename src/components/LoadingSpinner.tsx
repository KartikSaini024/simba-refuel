import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div 
        className={cn(
          "animate-spin rounded-full border-2 border-muted border-t-primary",
          sizeClasses[size]
        )}
      />
      {text && (
        <p className="text-muted-foreground text-sm animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export const PageLoader: React.FC<{ text?: string }> = ({ text = "Loading..." }) => (
  <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
    <LoadingSpinner size="lg" text={text} />
  </div>
);

export const InlineLoader: React.FC<{ text?: string }> = ({ text }) => (
  <div className="flex items-center justify-center py-8">
    <LoadingSpinner size="md" text={text} />
  </div>
);

export default LoadingSpinner;