// Errores normalizados de la API. El backend real debe responder con este mismo formato:
// { "status": 409, "code": "CONFLICT", "message": "…", "errors": { "campo": "detalle" } }

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'TOO_MANY_REQUESTS'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export interface ApiErrorBody {
  status: number;
  code: ApiErrorCode;
  message: string;
  errors?: Record<string, string>;
  retryAfter?: number;
}

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  BAD_REQUEST: 'La solicitud no es válida.',
  UNAUTHORIZED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  NOT_FOUND: 'El recurso solicitado no existe.',
  CONFLICT: 'La operación entra en conflicto con datos existentes.',
  PAYLOAD_TOO_LARGE: 'El archivo es demasiado grande.',
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Espera un momento.',
  SERVER_ERROR: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible en este momento.',
  NETWORK_ERROR: 'No hay conexión con el servidor. Revisa tu internet.',
  TIMEOUT: 'El servidor tardó demasiado en responder.',
};

export class ApiError extends Error implements ApiErrorBody {
  status: number;
  code: ApiErrorCode;
  errors?: Record<string, string>;
  retryAfter?: number;

  constructor(status: number, message?: string, extra?: { code?: ApiErrorCode; errors?: Record<string, string>; retryAfter?: number }) {
    const code = extra?.code || CODE_BY_STATUS[status] || (status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST');
    super(message || DEFAULT_MESSAGE[code]);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = extra?.errors;
    this.retryAfter = extra?.retryAfter;
  }

  toJSON(): ApiErrorBody {
    return { status: this.status, code: this.code, message: this.message, errors: this.errors, retryAfter: this.retryAfter };
  }

  static from(body: Partial<ApiErrorBody> & { status: number }) {
    return new ApiError(body.status, body.message, { code: body.code, errors: body.errors, retryAfter: body.retryAfter });
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Mensaje amigable para mostrar al usuario. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.errors && Object.keys(e.errors).length) return `${e.message} ${Object.values(e.errors)[0]}`;
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return DEFAULT_MESSAGE.SERVER_ERROR;
}
