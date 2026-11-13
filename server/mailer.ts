import nodemailer, { type Transporter } from "nodemailer";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
};

/** Boîte d'envoi en mémoire, utilisée par les tests (MAIL_TRANSPORT=memory). */
export const memoryOutbox: MailMessage[] = [];

let transporter: Transporter | null = null;
function smtpTransport() {
  if (!transporter)
    transporter = nodemailer.createTransport(process.env.SMTP_URL!);
  return transporter;
}

export function mailerConfigured() {
  return (
    Boolean(process.env.SMTP_URL) || process.env.MAIL_TRANSPORT === "memory"
  );
}

/**
 * Envoie un e-mail par SMTP (SMTP_URL, ex. smtps://utilisateur:motdepasse@smtp.exemple.com:465).
 * Sans configuration, le message est écrit dans les journaux (développement) et
 * l'envoi est signalé comme non distribué.
 */
export async function sendMail(
  message: MailMessage
): Promise<{ delivered: boolean }> {
  if (process.env.MAIL_TRANSPORT === "memory") {
    memoryOutbox.push(message);
    return { delivered: true };
  }
  if (!process.env.SMTP_URL) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "mail_not_sent",
        reason: "SMTP_URL non configuré",
        to: message.to,
        subject: message.subject,
        text: message.text,
      })
    );
    return { delivered: false };
  }
  await smtpTransport().sendMail({
    from: process.env.MAIL_FROM || "StockPilot <no-reply@stockpilot.local>",
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });
  return { delivered: true };
}

/** URL publique de l'application pour les liens envoyés par e-mail. */
export function appUrl(req?: {
  protocol?: string;
  get?: (name: string) => string | undefined;
}) {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = req?.get?.("host");
  return host
    ? `${req?.protocol ?? "https"}://${host}`
    : "http://localhost:3000";
}
