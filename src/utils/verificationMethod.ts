export type VerificationMethodKey = 'webauthn' | 'totp' | 'email' | 'recovery_key';

export interface VerificationMethodOption {
  key: VerificationMethodKey;
  title: string;
  emergency?: boolean;
  disabled?: boolean;
}

export function getPreferredVerificationMethod(
  methods: VerificationMethodKey[]
): VerificationMethodKey | null {
  const priority: VerificationMethodKey[] = ['webauthn', 'totp', 'email', 'recovery_key'];
  return priority.find((method) => methods.includes(method)) ?? null;
}
