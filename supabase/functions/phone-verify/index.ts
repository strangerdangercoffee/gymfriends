/**
 * Phone verification via Twilio Verify.
 *
 * POST body: { action: 'send', phone: '+12025551234' }
 *   → Sends a 6-digit SMS code via Twilio Verify.
 *
 * POST body: { action: 'check', phone: '+12025551234', code: '123456' }
 *   → Verifies the code. Returns { approved: true } on success.
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 */

const VERIFY_SERVICE_SID = 'VA91bacdf3b96df420e717953efb111c64';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    return new Response(
      JSON.stringify({ error: 'Twilio credentials not configured' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`);

  let body: { action?: string; phone?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const { action, phone, code } = body;

  if (!phone) {
    return new Response(
      JSON.stringify({ error: 'phone is required' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const e164 = toE164(phone);

  // ── SEND ─────────────────────────────────────────────────────────────────
  if (action === 'send') {
    const url = `https://verify.twilio.com/v2/Services/${VERIFY_SERVICE_SID}/Verifications`;
    const form = new URLSearchParams({ To: e164, Channel: 'sms' });

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await res.json();

    if (!res.ok) {
      console.error('Twilio Verify send error', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to send verification code' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, status: data.status }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // ── CHECK ─────────────────────────────────────────────────────────────────
  if (action === 'check') {
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'code is required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://verify.twilio.com/v2/Services/${VERIFY_SERVICE_SID}/VerificationChecks`;
    const form = new URLSearchParams({ To: e164, Code: code });

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await res.json();

    if (!res.ok) {
      console.error('Twilio Verify check error', data);
      return new Response(
        JSON.stringify({ error: data.message || 'Failed to check verification code' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const approved = data.status === 'approved';
    return new Response(
      JSON.stringify({ ok: true, approved, status: data.status }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'action must be "send" or "check"' }),
    { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
