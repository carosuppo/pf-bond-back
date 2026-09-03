import 'reflect-metadata';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('setea metadata de roles', () => {
    @Roles('A', 'B')
    class TestClass {}

    // Reflect metadata is typed as any by the upstream API.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const roles = Reflect.getMetadata(ROLES_KEY, TestClass);

    expect(roles).toEqual(['A', 'B']);
  });
});
