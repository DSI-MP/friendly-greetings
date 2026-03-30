export type Role = 'ADMIN' | 'HOD' | 'HR' | 'TRANSPORT_AUTHORITY' | 'EMP' | 'PLANNING' | 'SUPER_ADMIN';

export interface AuthUser {
  id?: number;
  sub?: number;
  email: string;
  role: Role;
  departmentId?: number | null;
  employeeId?: number | null;
  fullName: string;
  phone?: string;
  f2a_enabled?: boolean;
  emp_no?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
  message?: string;
}

export interface SelfRegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  departmentId: number;
  registerAs: 'EMP' | 'HOD';
  empNo?: string;
  password: string;
  confirmPassword: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}
