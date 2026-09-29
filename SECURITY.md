# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through
[GitHub Security Advisories](https://github.com/sebsti5/orar-smart/security/advisories/new).
Include the affected version or commit, steps to reproduce, and the impact you observed.

You can expect an acknowledgement within 3 working days and a status update within 10.
Once a fix is released, you will be credited in the advisory unless you prefer otherwise.

## Deployment checklist

- Set a long random `ORAR_SECRET` and `ORAR_ENV=production` (the app refuses to start without the secret).
- Serve over HTTPS and set `ORAR_COOKIE_SECURE=1`.
- Keep the container bound to `127.0.0.1` behind a reverse proxy or tunnel.
- Use `ORAR_SITE_PASSWORD` for deployments that should not be public.
