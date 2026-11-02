import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects unknown accounts without issuing a token', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const auth = new AuthService(prisma as never);
    await expect(auth.login('missing@example.test', 'a-very-long-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
