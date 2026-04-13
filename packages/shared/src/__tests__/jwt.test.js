import { describe, it, expect } from '@jest/globals';
import { parseBearer } from '../jwt.js';

describe('parseBearer', () => {
  it('extracts token from valid Bearer header', () => {
    expect(parseBearer('Bearer mytoken123')).toBe('mytoken123');
  });

  it('returns null when header is missing', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
  });

  it('returns null when header is empty string', () => {
    expect(parseBearer('')).toBeNull();
  });

  it('returns null when scheme is not Bearer', () => {
    expect(parseBearer('Basic sometoken')).toBeNull();
  });

  it('returns null when token part is missing', () => {
    expect(parseBearer('Bearer')).toBeNull();
  });

  it('returns null when header has wrong format', () => {
    expect(parseBearer('justoneword')).toBeNull();
  });
});
