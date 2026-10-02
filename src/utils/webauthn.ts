function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer.slice(0);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toRequestOptions(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const challenge = options.challenge;
  if (typeof challenge !== 'string') {
    throw new Error('Invalid WebAuthn challenge');
  }

  const allowCredentials = Array.isArray(options.allowCredentials)
    ? options.allowCredentials.map((credential) => {
      const record = credential as Record<string, unknown>;
      if (typeof record.id !== 'string') {
        throw new Error('Invalid WebAuthn credential descriptor');
      }

      return {
        transports: Array.isArray(record.transports)
          ? record.transports as AuthenticatorTransport[]
          : undefined,
        type: record.type === 'public-key' ? 'public-key' : 'public-key',
        id: base64UrlToArrayBuffer(record.id),
      } satisfies PublicKeyCredentialDescriptor;
    })
    : undefined;

  return {
    ...options,
    challenge: base64UrlToArrayBuffer(challenge),
    allowCredentials,
  } as PublicKeyCredentialRequestOptions;
}

function toCreationOptions(options: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const challenge = options.challenge;
  const user = options.user as Record<string, unknown> | undefined;

  if (typeof challenge !== 'string') {
    throw new Error('Invalid WebAuthn challenge');
  }

  if (!user || typeof user.id !== 'string') {
    throw new Error('Invalid WebAuthn user');
  }

  const excludeCredentials = Array.isArray(options.excludeCredentials)
    ? options.excludeCredentials.map((credential) => {
      const record = credential as Record<string, unknown>;
      if (typeof record.id !== 'string') {
        throw new Error('Invalid WebAuthn credential descriptor');
      }

      return {
        transports: Array.isArray(record.transports)
          ? record.transports as AuthenticatorTransport[]
          : undefined,
        type: record.type === 'public-key' ? 'public-key' : 'public-key',
        id: base64UrlToArrayBuffer(record.id),
      } satisfies PublicKeyCredentialDescriptor;
    })
    : undefined;

  return {
    ...options,
    challenge: base64UrlToArrayBuffer(challenge),
    user: {
      ...user,
      id: base64UrlToArrayBuffer(user.id),
    },
    excludeCredentials,
  } as PublicKeyCredentialCreationOptions;
}

function serializeAuthenticationCredential(credential: PublicKeyCredential) {
  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse)) {
    throw new Error('Unexpected WebAuthn response type');
  }

  return {
    id: credential.id,
    type: credential.type,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
  };
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse)) {
    throw new Error('Unexpected WebAuthn response type');
  }

  return {
    id: credential.id,
    type: credential.type,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function'
        ? response.getTransports()
        : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
  };
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && 'credentials' in navigator
    && 'PublicKeyCredential' in window;
}

export async function authenticateWithWebAuthn(options: Record<string, unknown>) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(options),
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('No WebAuthn credential was returned');
  }

  return serializeAuthenticationCredential(credential);
}

export async function registerWithWebAuthn(options: Record<string, unknown>) {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const credential = await navigator.credentials.create({
    publicKey: toCreationOptions(options),
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('No WebAuthn credential was returned');
  }

  return serializeRegistrationCredential(credential);
}
