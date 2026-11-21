import { apiClient, normalizeApiError } from '../api/api-client';
import {
  authControllerLogin,
  authControllerLogout,
  authControllerMe,
  authControllerRegister,
} from '../api/generated/auth/sdk.gen';
import type {
  AuthProvider,
  AuthTokenResponseDto,
  LoginDto,
  RegisterLocalDto,
  UserProfileResponseDto,
} from '../api/generated/auth/types.gen';
import { tokenStorage } from './token-storage.service';

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  provider: AuthProvider;
  avatarUrl: string | null;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  accessToken: string;
  user: UserProfile;
}

export type LoginCredentials = LoginDto;
export type RegisterPayload = RegisterLocalDto;

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeUserProfile(dto: UserProfileResponseDto): UserProfile {
  return {
    id: dto.id,
    email: dto.email,
    username: toNullableString(dto.username),
    provider: dto.provider,
    avatarUrl: toNullableString(dto.avatarUrl),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function extractAccessToken(
  payload: AuthTokenResponseDto & { access_token?: string },
): string {
  const token = payload.accessToken || payload.access_token;
  if (!token) {
    throw new Error('Authentication response did not include an access token');
  }
  return token;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const response = await authControllerLogin({
        client: apiClient,
        body: credentials,
        throwOnError: true,
      });
      const data = response.data as AuthTokenResponseDto & {
        access_token?: string;
      };
      const accessToken = extractAccessToken(data);
      tokenStorage.setAccessToken(accessToken);
      return {
        accessToken,
        user: normalizeUserProfile(data.user),
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async register(payload: RegisterPayload): Promise<AuthSession | null> {
    try {
      const response = await authControllerRegister({
        client: apiClient,
        body: payload,
        throwOnError: true,
      });
      const data = response.data as
        (AuthTokenResponseDto & { access_token?: string }) | undefined;

      if (data && (data.accessToken || data.access_token)) {
        const accessToken = extractAccessToken(data);
        tokenStorage.setAccessToken(accessToken);
        return {
          accessToken,
          user: normalizeUserProfile(data.user),
        };
      }

      return null;
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async getProfile(): Promise<UserProfile> {
    try {
      const response = await authControllerMe({
        client: apiClient,
        throwOnError: true,
      });
      return normalizeUserProfile(response.data);
    } catch (error) {
      throw normalizeApiError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      if (tokenStorage.getAccessToken()) {
        await authControllerLogout({
          client: apiClient,
          throwOnError: true,
        });
      }
    } catch {
      // Ignore server logout errors (e.g., expired token or network failure)
    } finally {
      tokenStorage.clearTokens();
    }
  },
};
