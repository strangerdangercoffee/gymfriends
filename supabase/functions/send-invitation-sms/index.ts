// Supabase Edge Function: send one friend-invitation SMS via Twilio.
// Invoke with POST body: { "invitationId": "<uuid>" }
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, APP_INVITE_LINK (optional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRow {
  id: string;
  inviter_id: string;
  inviter_name: string;
  invitee_phone: string | null;
  status: string;
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invitationId } = (await req.json()) as { invitationId?: string };
    if (!invitationId) {
      return new Response(
        JSON.stringify({ error: "invitationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const appInviteLink = Deno.env.get("APP_INVITE_LINK") || "https://apps.apple.com"; // replace with your app/store link

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER");
      return new Response(
        JSON.stringify({ error: "SMS not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: row, error: fetchError } = await supabase
      .from("friend_invitations")
      .select("id, inviter_name, invitee_phone, status")
      .eq("id", invitationId)
      .single();

    if (fetchError || !row) {
      return new Response(
        JSON.stringify({ error: "Invitation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inv = row as InvitationRow;
    if (inv.status !== "pending" || !inv.invitee_phone?.trim()) {
      return new Response(
        JSON.stringify({ error: "Invitation not pending or no phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = toE164(inv.invitee_phone);
    const body = `${inv.inviter_name} invited you to join Gym Friends. Sign up: ${appInviteLink}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const form = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    });
    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
      body: form.toString(),
    });

    const twilioJson = await twilioRes.json();
    if (!twilioRes.ok) {
      console.error("Twilio error", twilioJson);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: twilioJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sid: twilioJson.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
