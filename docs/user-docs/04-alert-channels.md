# Alert channels (WhatsApp & Telegram)

Security alerts can also go to messaging apps. Configure under **Alerts → Settings**.

API: `GET/PUT /api/v1/alerts/settings` · test via `POST /api/v1/alerts/test`.

---

## What you can turn on

| Event type (examples) | Toggle in settings |
|----------------------|--------------------|
| Scan completed / failed | `notify.scan_*` |
| Risk created / critical | `notify.risk_*` |
| Treatment events | `notify.treatment_events` |

Channels: **Email (client SMTP)** · **WhatsApp** · **Telegram**.

---

## Telegram

### Option A — Your bot (recommended for client branding)

1. In Telegram, open **@BotFather**.
2. `/newbot` → choose name and username.
3. Copy the **bot token**.
4. Create a group or channel for security alerts; add the bot as admin if required.
5. Get the chat id (group/channel id, often like `-100…`).
6. In Phantix alerts settings:

```json
"telegram": {
  "enabled": true,
  "bot_token": "123456:ABC-DEF…",
  "recipients": ["-1001234567890"],
  "provider": "auto"
}
```

7. Send a **test alert**.

### Option B — Platform bot

If Phantix has configured a platform Telegram bot, you may only need chat ids. Check `capabilities.telegram` on `GET /alerts/settings`.

---

## WhatsApp (Meta Cloud API)

1. Create a Meta (Facebook) developer app with **WhatsApp**.
2. Complete business verification as required by Meta.
3. Note **Phone number ID** and a long-lived access token.
4. Recipients must be E.164 numbers allowed by your WhatsApp Business setup (e.g. `+2348012345678`).
5. In Phantix, enable WhatsApp and add recipients.
6. Platform may require Meta credentials on the Phantix side (`capabilities.whatsapp.platform_meta_configured`). If delivery is not live, contact Phantix ops or use email/Telegram first.

---

## Tips

- Start with **email** reliability, then add chat channels.
- Use a dedicated security channel/group — not a noisy company chat.
- Dual-control users should still approve high-risk actions in the app; chat is for **notification**, not authorization.

**Next:** [GitHub connection →](./05-github-connection.md)
