import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '../src/common/errors/app-error';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';

const schema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value for valid input', () => {
    const parsed = pipe.transform({ name: 'Camera', quantity: 2 });

    expect(parsed).toEqual({ name: 'Camera', quantity: 2 });
  });

  it('throws a validation AppError with field details', () => {
    try {
      pipe.transform({ name: '', quantity: -1 });
      expect.fail('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('validation_error');
      expect(appError.status).toBe(400);
      expect(appError.details).toEqual([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'quantity' }),
      ]);
    }
  });
});
