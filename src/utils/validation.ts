export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  return { isValid: true };
};

export const validateBranchCode = (code: string): boolean => {
  return /^[A-Z]{2,5}$/.test(code);
};

export const validateRego = (rego: string): boolean => {
  // Australian registration format (basic validation)
  return /^[A-Z0-9]{3,8}$/.test(rego.toUpperCase());
};

export const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 1000; // Reasonable fuel amount limits
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const validateRefuelForm = (formData: { rego: string; amount: string; refuelledBy: string; reservationNumber: string }): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!formData.rego.trim()) {
    errors.push('Vehicle registration is required');
  } else if (!validateRego(formData.rego)) {
    errors.push('Invalid vehicle registration format');
  }

  if (!formData.amount.trim()) {
    errors.push('Amount is required');
  } else {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || !validateAmount(amount)) {
      errors.push('Amount must be a valid number between 0 and 1000');
    }
  }

  if (!formData.refuelledBy.trim()) {
    errors.push('Refuelled by is required');
  }

  if (!formData.reservationNumber.trim()) {
    errors.push('Reservation number is required');
  }

  return { isValid: errors.length === 0, errors };
};