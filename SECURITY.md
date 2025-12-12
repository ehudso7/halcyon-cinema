# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.5.x   | :white_check_mark: |
| 1.4.x   | :white_check_mark: |
| < 1.4   | :x:                |

## Reporting a Vulnerability

We take the security of HALCYON-Cinema seriously. If you discover a security vulnerability, please follow these steps:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Share vulnerability details publicly before they're fixed
- Exploit the vulnerability beyond what's needed to demonstrate it

### Do

1. **Email us** at security@halcyon-cinema.dev with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

2. **Allow time for response** - We aim to respond within 48 hours

3. **Work with us** to understand and resolve the issue

### What to Expect

| Timeline | Action |
|----------|--------|
| 48 hours | Initial response and acknowledgment |
| 7 days | Assessment and severity determination |
| 30 days | Fix development and testing |
| 45 days | Public disclosure (coordinated) |

### Rewards

We don't currently offer a bug bounty program, but we will:
- Credit you in our security acknowledgments (if desired)
- Provide a reference letter for significant findings
- Send HALCYON swag for critical vulnerabilities

## Security Measures

### Authentication
- Passwords hashed with bcrypt (cost factor 10)
- JWT sessions with 30-day expiry
- HTTP-only secure cookies
- CSRF protection via NextAuth.js

### API Security
- Rate limiting on all endpoints
- Input validation on all requests
- Parameterized SQL queries
- CORS restrictions

### Data Protection
- All data transmitted over HTTPS
- Database connections encrypted
- Environment variables secured
- No sensitive data in logs

### AI Safety
- Content filtering on AI outputs
- Rate limiting to prevent abuse
- URL validation for generated content

## Security Headers

HALCYON-Cinema sets the following security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
```

## Responsible Disclosure

We support responsible disclosure. If you've found a vulnerability:

1. Report it privately
2. Give us reasonable time to fix it
3. Don't exploit it maliciously
4. We'll publicly credit you (with permission)

## Contact

- Security issues: security@halcyon-cinema.dev
- General questions: [GitHub Discussions](https://github.com/ehudso7/halcyon-cinema/discussions)

Thank you for helping keep HALCYON-Cinema secure!
