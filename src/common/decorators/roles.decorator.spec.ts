import 'reflect-metadata';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('setea metadata de roles', () => {
    @Roles('A', 'B')
    class TestClass {}

    const roles = Reflect.getMetadata(ROLES_KEY, TestClass);

    expect(roles).toEqual(['A', 'B']);
  });
});
