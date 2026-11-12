import { createRequire } from "node:module";

export type MailAttachment = { filename: string; content: Buffer; contentType: "application/pdf" };
export type MailMessage = { to: string; subject: string; text: string; replyTo?: string; attachments?: MailAttachment[] };
export const memoryOutbox: MailMessage[] = [];
type SmtpClient = { sendMail(message: Record<string, unknown>): Promise<unknown> };
let transporter: SmtpClient | null = null;
let injectedTransportFactory: (() => SmtpClient) | null = null;

function getTransporter(): SmtpClient {
  if (!transporter) {
    if (injectedTransportFactory) {
      transporter = injectedTransportFactory();
      return transporter;
    }
    const nodemailer = createRequire(import.meta.url)("nodemailer") as {
      createTransport(url: string): SmtpClient;
    };
    transporter = nodemailer.createTransport(process.env.SMTP_URL!);
  }
  return transporter;
}

/** Test seam; application requests cannot configure the transport factory. */
export function setMailTransportFactoryForTests(factory: (() => SmtpClient) | null) {
  injectedTransportFactory = factory;
  transporter = null;
}

export function mailerConfigured(): boolean {
  return (process.env.NODE_ENV === "test" && process.env.MAIL_TRANSPORT === "memory") || Boolean(process.env.SMTP_URL && process.env.MAIL_FROM);
}

export function accountMailerConfigured(): boolean {
  if (!mailerConfigured()) return false;
  try { appUrl(); return true; } catch { return false; }
}

export function appUrl(req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("PUBLIC_APP_URL doit être une URL HTTPS de confiance.");
    return url.origin;
  }
  if (process.env.NODE_ENV === "test") return "http://localhost:3000";
  throw new Error("PUBLIC_APP_URL doit être configurée avant les e-mails de compte.");
}

/** Aucun contenu, destinataire ou jeton n’est écrit dans les logs. */
export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  if (process.env.NODE_ENV === "test" && process.env.MAIL_TRANSPORT === "memory") {
    memoryOutbox.push(message);
    return { delivered: true };
  }
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) return { delivered: false };
  try {
    await getTransporter().sendMail({ from: process.env.MAIL_FROM, to: message.to, subject: message.subject, text: message.text, ...(message.replyTo ? { replyTo: message.replyTo } : {}), ...(message.attachments?.length ? { attachments: message.attachments.map(attachment => ({ filename: attachment.filename, content: attachment.content, contentType: attachment.contentType })) } : {}) });
    return { delivered: true };
  } catch {
    // Les erreurs SMTP peuvent contenir des données sensibles ; ne pas les journaliser.
    return { delivered: false };
  }
}
