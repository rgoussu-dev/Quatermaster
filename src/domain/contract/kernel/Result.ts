import type { DomainError } from './DomainError.js';

/** Successful outcome carrying a value. */
export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

/** Failed outcome carrying a domain error. */
export interface Failure {
  readonly ok: false;
  readonly error: DomainError;
}

/** Discriminated union return type for all domain operations. */
export type Result<T> = Success<T> | Failure;

/** Constructs a successful result. */
export function success<T>(value: T): Success<T> {
  return { ok: true, value };
}

/** Constructs a failed result. */
export function failure(error: DomainError): Failure {
  return { ok: false, error };
}
