// Gateway API Response Types

export interface GatewayApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// Gateway error codes
export const GatewayErrorCode = {
  Success: 0,
  InternalError: 10005,
  BadRequest: 10007,
  TokenInvalid: 10102,
  ServiceDegraded: 10010,
} as const;

// Pagination types
export interface PageParams {
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface PageResult<T> {
  list: T[];
  total: number;
}
