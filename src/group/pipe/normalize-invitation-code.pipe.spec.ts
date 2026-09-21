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

  it('removes the dash from the display format', () => {
    expect(pipe.transform({ invitationCode: ' ABC-123 ' })).toEqual({
      invitationCode: 'ABC123',
    });
  });

  it('normalizes lowercase input containing a dash', () => {
    expect(pipe.transform({ invitationCode: 'abc-123' })).toEqual({
      invitationCode: 'ABC123',
    });
  });
});
