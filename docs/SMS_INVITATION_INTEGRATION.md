# SMS invitation integration

The app invites friends by phone: the UI and `friend_invitations` table are in place; actual SMS is sent by a **server-side** integration (API keys must not live in the client).

## Recommended service: **Twilio**

- **Best fit** for “your friend X invited you to join…” style transactional SMS.
- **Pricing**: ~\$0.0079/SMS (US); pay-as-you-go; [free trial credit](https://www.twilio.com/try-twilio).
- **Docs and DX**: Very strong; quick to integrate.
- **Compliance**: Use for invited-user, one-to-one messages; avoid marketing blasts from the same number without consent.

**Alternatives**

- **AWS SNS**: Cheapest at scale (~\$0.006/SMS); good if you’re already on AWS; requires 10DLC/campaign setup for US.
- **Vonage (Nexmo)**: Slightly cheaper than Twilio at volume; less documentation.
- **Plivo**: Lower cost; fewer features.

For a mobile app with moderate volume and a single “invite friend” flow, **Twilio** is the best default.

## Architecture

1. **Client** (React Native): User submits phone → `invitationService.createInvitation()` inserts into `friend_invitations` and then calls the **send-invitation-sms** Edge Function with the new invitation id.
2. **Edge Function** (Supabase): Loads the invitation by id (service role), builds the message, and sends it via Twilio’s API. Credentials live in Supabase secrets.

SMS is never sent from the app; the Edge Function is the only place that uses Twilio.

## Setup

### 1. Twilio

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio).
2. Get a **phone number** (Messaging → Phone numbers → Buy a number); note the number in E.164 (e.g. `+15551234567`).
3. In Console, note **Account SID** and **Auth Token**.

### 2. Supabase secrets (Edge Function)

Set these for the function (Dashboard → Project Settings → Edge Functions → Secrets, or CLI):

- `TWILIO_ACCOUNT_SID` – Twilio Account SID  
- `TWILIO_AUTH_TOKEN` – Twilio Auth Token  
- `TWILIO_PHONE_NUMBER` – Your Twilio number in E.164 (e.g. `+15551234567`)  
- `APP_INVITE_LINK` – Optional; deep link or web signup URL (e.g. `https://yourapp.com/invite` or your App Store link). Used in the SMS body.

### 3. Deploy the Edge Function

From the project root:

```bash
# If first time: supabase link --project-ref <your-project-ref>
supabase functions deploy send-invitation-sms
```

### 4. Client

The client already invokes `send-invitation-sms` after creating an invitation (see `src/services/invitations.ts`). No API keys are stored in the app.

## Message content

The Edge Function sends a single SMS, for example:

> [InviterName] invited you to join Gym Friends. Sign up: [APP_INVITE_LINK]

Keep the body short so it stays in one segment (≤160 chars) when possible.

## Cost (Twilio, US)

- Roughly \$0.0079 per SMS.
- Example: 500 invites/month ≈ \$4.
- Free trial credit is enough to test.

## Compliance (TCPA / best practice)

- Sending to a number the **inviter** provided (friend invite) is generally acceptable as a transactional, relationship-based message.
- Do not use the same number for promotional blasts without prior consent.
- Twilio’s [guidelines](https://www.twilio.com/docs/usage/guidelines) and [acceptable use](https://www.twilio.com/legal/aup) apply.
