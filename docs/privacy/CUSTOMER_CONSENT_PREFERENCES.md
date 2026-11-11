# Customer consent preferences

Authenticated customer API:
- `GET /account/consents`
- `POST /account/consents` with `{ "consentType": "MARKETING_EMAIL", "granted": false }`

Supported purposes: `MARKETING_EMAIL`, `MARKETING_WHATSAPP`, `ANALYTICS`, and `PERSONALIZATION`.

Each decision is stored per user and purpose, with the current policy version, source and decision timestamp. Revocation is recorded as `granted: false`; records are not deleted when consent is withdrawn. The API uses the authenticated user ID and cannot write another customer's preferences.

Set `CONSENT_POLICY_VERSION` in the API environment to the identifier of the currently published privacy/consent policy. The API fails closed when this value is missing. Marketing and analytics systems must check the relevant consent before processing; this endpoint alone does not automatically enforce consent in every downstream integration.
