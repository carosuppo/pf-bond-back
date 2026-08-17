import { NormalizeInvitationCodePipe } from './normalize-invitation-code.pipe';

describe('NormalizeInvitationCodePipe', () => {
  const pipe = new NormalizeInvitationCodePipe();

  it('normaliza el código a mayúsculas y sin espacios', () => {
    expect(pipe.transform({ invitationCode: '  abc123  ' })).toEqual({
      invitationCode: 'ABC123',
    });
  });

  it('mantiene el código si ya está normalizado', () => {
    expect(pipe.transform({ invitationCode: 'ABC123' })).toEqual({
      invitationCode: 'ABC123',
    });
  });
});
