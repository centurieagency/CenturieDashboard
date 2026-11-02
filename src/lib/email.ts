import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

/**
 * Emails transactionnels (Resend), envoyés depuis le sous-domaine vérifié mail.centuriegrowth.com.
 * Pas de boîte de réception sur ce domaine : les réponses partent vers l'adresse de l'agence.
 * Un envoi raté ne bloque jamais le parcours (création de compte, paiement) : il est journalisé.
 */

const FROM = "Centurie Growth <hello@mail.centuriegrowth.com>";
const REPLY_TO = "centurie.agency@gmail.com";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Gabarit commun : fond sombre de la marque, un titre, des paragraphes, un bouton. */
function layout({ title, paragraphs, button, footnote }: { title: string; paragraphs: string[]; button?: { label: string; url: string }; footnote?: string }) {
  const p = paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d2cdc8;">${t}</p>`).join("");
  const btn = button
    ? `<p style="margin:26px 0 22px;"><a href="${escape(button.url)}" style="display:inline-block;padding:14px 26px;border-radius:12px;background:#e6be68;color:#17130b;font-weight:700;font-size:15px;text-decoration:none;">${escape(button.label)}</a></p>
       <p style="margin:0 0 16px;font-size:12.5px;line-height:1.5;color:#8a8580;">If the button doesn't work, copy this link into your browser:<br><span style="color:#c8c3be;word-break:break-all;">${escape(button.url)}</span></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0d0b09;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b09;padding:32px 16px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 4px 20px;font-size:20px;font-weight:700;letter-spacing:.02em;color:#f2eee8;">CENTURIE <span style="font-weight:400;color:#e6be68;">Growth</span></td></tr>
        <tr><td style="background:#181613;border:1px solid #2a2622;border-radius:18px;padding:32px 28px;">
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#f2eee8;">${escape(title)}</h1>
          ${p}${btn}
          ${footnote ? `<p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:#8a8580;">${footnote}</p>` : ""}
        </td></tr>
        <tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:#6f6a64;">Centurie Growth, operated by Centurie Services LLC (Wyoming, USA). Questions? Just reply to this email.</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
  const text = [title, "", ...paragraphs.map((t) => t.replace(/<[^>]+>/g, "")), button ? `\n${button.label}: ${button.url}` : "", footnote ? `\n${footnote.replace(/<[^>]+>/g, "")}` : ""].join("\n");
  return { html, text };
}

async function send(to: string, subject: string, content: { html: string; text: string }, idempotencyKey: string) {
  if (!resend) {
    console.warn(`Email not sent (RESEND_API_KEY missing): ${subject} → ${to}`);
    return false;
  }
  // Le SDK ne lève pas d'exception : l'erreur est dans `error`.
  const { error } = await resend.emails.send(
    { from: FROM, replyTo: REPLY_TO, to, subject, html: content.html, text: content.text },
    { idempotencyKey },
  );
  if (error) {
    console.error(`Email failed: ${subject} → ${to}`, error);
    return false;
  }
  return true;
}

const firstName = (name: string | null | undefined) => (name ? escape(name.trim().split(/\s+/)[0]!) : "there");

/** Après paiement : lien pour créer son espace client (relié au paiement). */
export function sendWelcomeEmail(to: string, name: string | null, claimUrl: string, sessionId: string) {
  return send(
    to,
    "Welcome to Centurie Growth: create your client space",
    layout({
      title: "Your subscription is active",
      paragraphs: [
        `Hi ${firstName(name)}, thank you for joining Centurie Growth.`,
        "Your next step takes two minutes: create your client space, then connect your Instagram account securely. That's also where you'll follow your growth every day.",
      ],
      button: { label: "Create my client space", url: claimUrl },
      footnote: "This link is personal and works for 7 days. We will never ask for your Instagram password by email or message.",
    }),
    `welcome/${sessionId}`,
  );
}

/** Après paiement, pour un client qui a déjà son espace. */
export function sendSubscriptionAddedEmail(to: string, name: string | null, loginUrl: string, sessionId: string) {
  return send(
    to,
    "Your new Centurie Growth subscription is active",
    layout({
      title: "Your new subscription is active",
      paragraphs: [
        `Hi ${firstName(name)}, thank you for your trust.`,
        "Log in to your client space to connect the Instagram account for this subscription.",
      ],
      button: { label: "Open my client space", url: loginUrl },
    }),
    `welcome/${sessionId}`,
  );
}

/** Mot de passe oublié : lien personnel, à usage unique. */
export function sendPasswordResetEmail(to: string, name: string | null, resetUrl: string, linkId: string, hours: number) {
  return send(
    to,
    "Reset your Centurie Growth password",
    layout({
      title: "Reset your password",
      paragraphs: [`Hi ${firstName(name)}, we received a request to reset the password of your Centurie Growth client space.`],
      button: { label: "Choose a new password", url: resetUrl },
      footnote: `This link works once, for ${hours} hours. If you didn't ask for it, you can ignore this email: your password stays the same.`,
    }),
    `reset/${linkId}`,
  );
}
