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
- credential leakage in provider integrations;
- unsafe handling of local LM Studio or ComfyUI endpoints;
- accidental exposure of local provider servers outside localhost.

## Local AI Providers

LM Studio and ComfyUI should be bound to `127.0.0.1` or `localhost` for Creator
Alpha workflows. Do not expose these services to a public network without
authentication and firewall rules.
