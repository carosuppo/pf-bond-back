import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,

      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as string[];

          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          if (!(value instanceof Date) || !(relatedValue instanceof Date)) {
            return false;
          }

          return value.getTime() > relatedValue.getTime();
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser posterior a ${args.constraints[0]}.`;
        },
      },
    });
  };
}
