/**
 * Sealed base for all domain errors.
 * Concrete error types extend this with a discriminating `kind` field.
 * Transport adapters map these to exit codes, HTTP status, etc. — domain never knows about transport.
 */
export interface DomainError {
  readonly kind: string;
  readonly message: string;
}
