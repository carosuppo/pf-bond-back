import { CurrentUser } from './user.decorator';

describe('CurrentUser decorator', () => {
  it('es una funcion decoradora', () => {
    const decorator = CurrentUser();

    expect(typeof decorator).toBe('function');
  });
});
