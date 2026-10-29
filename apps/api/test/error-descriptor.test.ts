import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AppError } from '../src/common/errors/app-error';
import { toErrorDescriptor } from '../src/common/filters/all-exceptions.filter';

describe('toErrorDescriptor', () => {
  it('keeps AppError code, status and details', () => {
    const descriptor = toErrorDescriptor(new AppError('insufficient_stock', 'Not enough', 409, {}));

    expect(descriptor).toEqual({
      status: 409,
      code: 'insufficient_stock',
      message: 'Not enough',
      details: {},
    });
  });

  it('maps an HttpException to a stable code', () => {
    const descriptor = toErrorDescriptor(new HttpException('Nope', HttpStatus.FORBIDDEN));

    expect(descriptor.status).toBe(403);
    expect(descriptor.code).toBe('forbidden');
  });

  it('hides unexpected errors behind a generic 500', () => {
    const descriptor = toErrorDescriptor(new Error('database password is hunter2'));

    expect(descriptor).toEqual({
      status: 500,
      code: 'internal_error',
      message: 'Internal server error',
    });
  });
});
