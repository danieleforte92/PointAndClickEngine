# Security

## Supported Version

Creator Alpha is pre-1.0. Security fixes are handled on the default branch.

## Reporting

Please open a private security advisory on GitHub if available. If not, open an
issue with minimal reproduction details and avoid posting secrets, tokens, or
private project data.

## Scope

Relevant reports include:

- unsafe Electron IPC or browser sandbox escapes;
- project path traversal;
- untrusted project files loading external code;
- credential leakage in future provider integrations.
