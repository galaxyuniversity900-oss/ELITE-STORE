import { ServiceUnavailableException } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { AccountService } from './account.service';

describe('AccountService consent preferences', () => {
  const originalPolicyVersion = process.env.CONSENT_POLICY_VERSION;

  afterEach(() => {
    if (originalPolicyVersion === undefined) delete process.env.CONSENT_POLICY_VERSION;
    else process.env.CONSENT_POLICY_VERSION = originalPolicyVersion;
    jest.restoreAllMocks();
  });

  it('persists a versioned customer decision and keeps revocation as an explicit false value', async () => {
    process.env.CONSENT_POLICY_VERSION = 'policy-2026-11';
    const saved = { consentType: ConsentType.MARKETING_EMAIL, granted: false, policyVersion: 'policy-2026-11' };
    const prisma = { consentPreference: { upsert: jest.fn().mockResolvedValue(saved) } };
    const service = new AccountService(prisma as never);

    const result = await service.setConsent('user-1', {
      consentType: ConsentType.MARKETING_EMAIL,
      granted: false,
    });

    expect(result).toEqual(saved);
    expect(prisma.consentPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_consentType: { userId: 'user-1', consentType: ConsentType.MARKETING_EMAIL } },
      create: expect.objectContaining({ userId: 'user-1', granted: false, policyVersion: 'policy-2026-11' }),
      update: expect.objectContaining({ granted: false, policyVersion: 'policy-2026-11' }),
    }));
  });

  it('fails closed when the published policy version is not configured', async () => {
    delete process.env.CONSENT_POLICY_VERSION;
    const service = new AccountService({} as never);

    await expect(service.setConsent('user-2', {
      consentType: ConsentType.ANALYTICS,
      granted: true,
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
