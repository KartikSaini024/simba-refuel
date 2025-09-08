import { toast } from '@/hooks/use-toast';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

export const createAppError = (message: string, code?: string, details?: any): AppError => ({
  message,
  code,
  details
});

export const handleError = (error: unknown, fallbackMessage = 'An unexpected error occurred') => {
  console.error('Application error:', error);
  
  let message = fallbackMessage;
  let details = null;
  
  if (error instanceof Error) {
    message = error.message;
    details = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = (error as any).message || fallbackMessage;
  }

  toast({
    variant: 'destructive',
    title: 'Error',
    description: message,
  });

  return createAppError(message, undefined, details);
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch') ||
           error.message.toLowerCase().includes('connection');
  }
  return false;
};

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};