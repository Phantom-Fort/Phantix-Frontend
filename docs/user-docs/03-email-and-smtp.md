# Email & SMTP setup

Phantix uses email for:

| Use | Who sends |
|-----|-----------|
| Login MFA / setup OTP | **Phantix platform** SMTP (operated by Phantix) |
| Security **alerts** (scan finished, critical risk, …) | **Your organization’s SMTP** (client settings) |

You only configure **client SMTP** if you want alerts from **your** domain (recommended for production).

---

## Where to configure (in app)

**Alerts → Settings → Email / SMTP**

Or API:

```http
GET  /api/v1/alerts/settings
PUT  /api/v1/alerts/settings
```

Example body fragment:

```json
{
  "alerts_enabled": true,
  "smtp": {
    "enabled": true,
    "host": "smtp.example.com",
    "port": 587,
    "username": "alerts@example.com",
    "password": "…",
    "from_email": "alerts@example.com",
    "from_name": "Acme Security",
    "use_tls": true
  },
  "email_recipients": ["security@example.com", "cto@example.com"]
}
```

Then **Send test alert** from the UI (or `POST /api/v1/alerts/test`).

---

## Values you need from any provider

| Field | Typical value |
|-------|----------------|
| Host | `smtp.…` |
| Port | `587` (STARTTLS) or `465` (TLS) |
| Username | Often full email or SMTP user |
| Password | App password or SMTP key (not your login password when 2FA is on) |
| From email | Must be **verified** at the provider |
| From name | Display name |
| TLS | On for 587 |

---

## Provider guides

### Amazon SES

1. Open [AWS SES](https://console.aws.amazon.com/ses/).
2. Verify a **domain** or single **email** (DKIM recommended).
3. Leave sandbox only after requesting production access (otherwise only verified recipients work).
4. Create **SMTP credentials** (SES → SMTP settings → Create SMTP credentials).
5. Note region-specific host, e.g.:
   - `email-smtp.eu-west-1.amazonaws.com`
   - `email-smtp.us-east-1.amazonaws.com`
6. Port **587**, TLS **on**.
7. Username / password = the SMTP credentials (not your AWS root key).
8. Paste into Phantix alert SMTP settings.

### Brevo (Sendinblue)

1. Account at [brevo.com](https://www.brevo.com/).
2. **SMTP & API → SMTP**.
3. Copy:
   - Server: `smtp-relay.brevo.com`
   - Port: `587`
   - Login: your Brevo SMTP login
   - Password: SMTP key
4. Verify sender domain / email.
5. Enter in Phantix; set `from_email` to a verified sender.

### Mailgun

1. [mailgun.com](https://www.mailgun.com/) → Sending → Domain settings.
2. SMTP credentials for your domain.
3. Host often `smtp.mailgun.org` (or region-specific).
4. Port `587`, TLS on.
5. Use verified `from_email` on that domain.

### SendGrid

1. [sendgrid.com](https://sendgrid.com/) → Settings → Sender Authentication.
2. **SMTP Relay** or API key with mail send.
3. Host: `smtp.sendgrid.net`
4. Username: `apikey`
5. Password: your API key
6. Port `587`, TLS on.

### Google Workspace (Gmail SMTP)

1. Prefer a **Google Workspace** user dedicated to alerts.
2. Enable 2FA → create an **App password**.
3. Host: `smtp.gmail.com`
4. Port: `587`
5. Username: full email
6. Password: app password
7. Note: daily send limits apply; SES/Brevo scale better for volume.

### Microsoft 365

1. Ensure SMTP AUTH is allowed for the mailbox (admin may need to enable).
2. Host: `smtp.office365.com`
3. Port: `587`
4. Username: full email
5. Password: account or app password per your tenant policy.
6. From must match the authenticated mailbox (or approved send-as).

### Other (Postmark, SparkPost, Zoho, …)

Use the provider’s **SMTP** page. Map host/port/user/password/from into Phantix fields. Prefer providers that support SPF/DKIM for your domain.

---

## DNS for good deliverability (your domain)

| Record | Purpose |
|--------|---------|
| SPF | Authorize the provider to send for your domain |
| DKIM | Provider-generated keys |
| DMARC | Policy for spoofing protection |

Follow each provider’s “authenticate domain” wizard.

---

## Platform OTP email

Login and setup OTP emails are sent by **Phantix** (platform SMTP). You do not need client SMTP for that.
If OTPs never arrive, check spam and contact Phantix support (platform mail configuration).

---

## Checklist

- [ ] Sender verified at provider
- [ ] SMTP credentials created (not personal password)
- [ ] Phantix alert SMTP enabled
- [ ] Recipients list set
- [ ] Test alert received
- [ ] SPF/DKIM configured

**Next:** [Alert channels (WhatsApp / Telegram) →](./04-alert-channels.md)
