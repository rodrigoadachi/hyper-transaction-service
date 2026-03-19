import { UnprocessableEntityException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe<{ name: string; age: number }>;

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  it('should return parsed value when input is valid', () => {
    const input = { name: 'Alice', age: 25 };
    const result = pipe.transform(input);
    expect(result).toEqual(input);
  });

  it('should throw UnprocessableEntityException when input is invalid', () => {
    const input = { name: 'Alice', age: -1 };

    expect(() => pipe.transform(input)).toThrow(UnprocessableEntityException);
  });

  it('should throw UnprocessableEntityException when required field is missing', () => {
    expect(() => pipe.transform({ name: 'Alice' })).toThrow(UnprocessableEntityException);
  });

  it('should include validation errors in the thrown exception', () => {
    try {
      pipe.transform({ name: 'Alice', age: 'not-a-number' });
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      const response = (err as UnprocessableEntityException).getResponse() as { errors: unknown[] };
      expect(Array.isArray(response.errors)).toBe(true);
    }
  });
});
