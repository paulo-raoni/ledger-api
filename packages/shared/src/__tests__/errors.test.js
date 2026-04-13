import { describe, it, expect } from '@jest/globals';
import { AppError, Errors } from '../errors.js';

describe('AppError', () => {
  it('creates an error with message, statusCode, and code', () => {
    const err = new AppError('Something went wrong', 422, 'UNPROCESSABLE');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('UNPROCESSABLE');
  });

  it('uses defaults when statusCode and code are omitted', () => {
    const err = new AppError('Oops');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

describe('Errors factory', () => {
  it('notFound returns 404 NOT_FOUND', () => {
    const err = Errors.notFound();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('notFound accepts custom message', () => {
    const err = Errors.notFound('User not found');
    expect(err.message).toBe('User not found');
  });

  it('conflict returns 409 CONFLICT', () => {
    const err = Errors.conflict();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('unauthorized returns 401 UNAUTHORIZED', () => {
    const err = Errors.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('forbidden returns 403 FORBIDDEN', () => {
    const err = Errors.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('badRequest returns 400 BAD_REQUEST', () => {
    const err = Errors.badRequest();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('internal returns 500 INTERNAL_ERROR', () => {
    const err = Errors.internal();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('all factory errors are instances of AppError', () => {
    const factories = [
      Errors.notFound,
      Errors.conflict,
      Errors.unauthorized,
      Errors.forbidden,
      Errors.badRequest,
      Errors.internal,
    ];
    for (const factory of factories) {
      expect(factory()).toBeInstanceOf(AppError);
    }
  });
});
