import { JwtAuthGuard } from './jwt.guard';

describe('JwtAuthGuard', () => {
  it('se instancia', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
  });
});
