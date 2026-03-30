import i18n from '@/i18n';

// Map known backend error messages to translation keys
const errorMap: Record<string, string> = {
  // Auth
  'Invalid email or password': 'apiErrors.invalidCredentials',
  'Invalid credentials': 'apiErrors.invalidCredentials',
  'User not found': 'apiErrors.userNotFound',
  'Account is suspended': 'apiErrors.accountSuspended',
  'Account is inactive': 'apiErrors.accountInactive',
  'Token expired': 'apiErrors.tokenExpired',
  'Invalid token': 'apiErrors.invalidToken',
  'Unauthorized': 'apiErrors.unauthorized',

  // Password reset
  'No employee found with this employee number. Please check and try again.': 'apiErrors.noEmployeeWithEmpNo',
  'No employee found with this employee number': 'apiErrors.noEmployeeWithEmpNo',
  'No user found with this email address': 'apiErrors.noUserWithEmail',
  'No user found with this email address. Please check and try again.': 'apiErrors.noUserWithEmail',
  'Invalid or expired OTP': 'apiErrors.invalidOtp',
  'Invalid OTP': 'apiErrors.invalidOtp',
  'OTP expired': 'apiErrors.otpExpired',
  'OTP has expired. Please request a new one.': 'apiErrors.otpExpired',
  'Password reset limit reached. You can only request 2 resets per day.': 'apiErrors.resetLimitReached',
  'Daily password reset limit reached': 'apiErrors.resetLimitReached',
  'Too many reset requests. Please try again later.': 'apiErrors.resetLimitReached',
  'Passwords do not match': 'apiErrors.passwordsNotMatch',
  'Password must be at least 6 characters': 'apiErrors.passwordTooShort',

  // Registration
  'Email already exists': 'apiErrors.emailExists',
  'Email already in use': 'apiErrors.emailExists',
  'Employee number already exists': 'apiErrors.empNoExists',
  'A user with this email already exists': 'apiErrors.emailExists',
  'Registration is pending approval': 'apiErrors.registrationPending',

  // Transport
  'Request not found': 'apiErrors.requestNotFound',
  'Request already approved': 'apiErrors.requestAlreadyApproved',
  'Request already rejected': 'apiErrors.requestAlreadyRejected',
  'Cannot modify a locked request': 'apiErrors.requestLocked',
  'Daily run is locked': 'apiErrors.dailyRunLocked',
  'Vehicle not available': 'apiErrors.vehicleNotAvailable',
  'Driver not available': 'apiErrors.driverNotAvailable',
  'No available capacity': 'apiErrors.noCapacity',
  'Insufficient capacity': 'apiErrors.noCapacity',

  // CRUD
  'Record not found': 'apiErrors.recordNotFound',
  'Cannot delete: record is in use': 'apiErrors.cannotDeleteInUse',
  'Duplicate entry': 'apiErrors.duplicateEntry',
  'Validation failed': 'apiErrors.validationFailed',

  // General
  'Internal server error': 'apiErrors.serverError',
  'Service unavailable': 'apiErrors.serviceUnavailable',
  'Network Error': 'apiErrors.networkError',
};

/**
 * Translate a backend API error message to the current language.
 * Falls back to the original message if no translation is found.
 */
export function translateApiError(message: string, fallbackKey?: string): string {
  if (!message) return i18n.t(fallbackKey || 'apiErrors.unknownError');

  // Exact match
  const key = errorMap[message];
  if (key) return i18n.t(key);

  // Partial match (backend may append extra details)
  for (const [pattern, tKey] of Object.entries(errorMap)) {
    if (message.includes(pattern) || pattern.includes(message)) {
      return i18n.t(tKey);
    }
  }

  // If it looks like an English backend message but no match, return fallback
  if (fallbackKey) return i18n.t(fallbackKey);

  return message;
}

/**
 * Extract and translate error from an API catch block.
 */
export function getApiErrorMessage(err: unknown, fallbackKey?: string): string {
  const responseData = (err as any)?.response?.data;
  const nestedData = responseData?.data;
  const candidate =
    nestedData?.errors?.[0]?.message ||
    responseData?.errors?.[0]?.message ||
    nestedData?.message ||
    responseData?.message ||
    responseData?.error ||
    (err as any)?.message ||
    '';

  const normalized = Array.isArray(candidate)
    ? candidate.filter(Boolean).join(', ')
    : typeof candidate === 'object' && candidate !== null
      ? (candidate as any).message || JSON.stringify(candidate)
      : String(candidate);

  return translateApiError(normalized, fallbackKey);
}
