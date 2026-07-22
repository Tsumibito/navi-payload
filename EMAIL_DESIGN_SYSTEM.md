# Navi.training email system

This is the mandatory standard for transactional and lifecycle email sent by Navi.training.

## Architecture

Public forms post only to `POST /api/public/leads`. Payload stores the record first and then uses Brevo server-side. A mail failure must never discard a lead or subscriber. Browser code must never contain a Brevo key.

Every form must send the locale derived from its page and, for a service enquiry, the service key derived from the page or form. Payload records `locale`, `sourceUrl`, `utm`, IP address and user agent for both Leads and Subscribers. The visitor email always uses the recorded page locale; internal notifications include that locale for routing and reply context.

## Message families

1. **Lead notification to Alex**: operational, compact, reply-to set to the visitor, service in the subject.
2. **Lead acknowledgement**: localized and service-specific, confirms the next step without making unsupported promises.
3. **Subscriber notification to Alex**: identity, email and source page only.
4. **Subscriber welcome**: localized journal welcome. Existing subscribers are synced but do not receive another welcome message.

Supported service keys are `charter`, `yacht-delivery`, `yacht-expertise`, `sailing-school` and the `general` fallback. New public services must add localized copy to the service catalogue before their form is published.

## Visual tokens

- Sea: `#073746`
- Accent: `#d97706`
- Mist background: `#eef4f3`
- Body text: `#294f5a`
- Muted text: `#71858b`
- Card radius: `22px` desktop, `14px` mobile
- Coordinates: `46.1603° N · 1.1511° W`

Email uses table layout, inline styles and one small responsive media query. There are no remote fonts, scripts, animations, background images, SVG icons or decorative emoji. The template includes a hidden preheader and a plain-text alternative.

## Content rules

- Subject starts with the service for internal notifications.
- The visitor receives one clear next step and no marketing opt-in unless they explicitly used the newsletter form.
- Contact leads must never be added to a newsletter list.
- Never expose IP address, user agent or UTM data in the visitor email.
- All user content is HTML-escaped. Brevo credentials remain encrypted in `.env.production` and in the production environment.

## Required environment

`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `LEAD_NOTIFICATION_EMAIL`. `BREVO_SUBSCRIBERS_LIST_ID` is optional; when present, newsletter contacts are added to that Brevo list.

## Release check

- Typecheck and production build pass.
- Brevo account endpoint returns 200 from the production IP.
- Sender is active.
- One notification test reaches `alex@navi.training`.
- Lead and subscriber records remain stored when Brevo is temporarily unavailable.
