import axios, { type AxiosError } from 'axios';
import { tokenStorage } from '../services/token-storage.service';
import { client } from './generated/auth/client.gen';

export interface ApiErrorDetails {
  statusCode: number;
  message: string;
  errors?: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errors?: unknown;

  constructor({ statusCode, message, errors }: ApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string | string[];
      statusCode?: number;
      errors?: unknown;
    }>;
    const statusCode =
      axiosError.response?.data?.statusCode ??
      axiosError.response?.status ??
      500;
    const rawMessage = axiosError.response?.data?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : rawMessage || axiosError.message || 'An unexpected error occurred';

    return new ApiError({
      statusCode,
      message,
      errors: axiosError.response?.data?.errors,
    });
  }

  if (error instanceof Error) {
    return new ApiError({ statusCode: 500, message: error.message });
  }

  return new ApiError({
    statusCode: 500,
    message: 'An unexpected error occurred',
  });
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

client.setConfig({
  baseURL: API_BASE_URL,
});

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

let interceptorsRegistered = false;

if (!interceptorsRegistered) {
  interceptorsRegistered = true;

  client.instance.interceptors.request.use((config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const normalized = normalizeApiError(error);
      if (normalized.statusCode === 401) {
        tokenStorage.clearTokens();
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          if (pathname !== '/login' && pathname !== '/register') {
            unauthorizedHandler?.();
          }
        }
      }
      return Promise.reject(normalized);
    },
  );
}

export const apiClient = client;
