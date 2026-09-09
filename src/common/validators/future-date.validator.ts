import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!(value instanceof Date)) {
            return false;
          }

          return value.getTime() > Date.now();
        },

        defaultMessage() {
          return 'La fecha debe ser posterior a la fecha actual.';
        },
      },
    });
  };
}
