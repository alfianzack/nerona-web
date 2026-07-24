import { Resend } from "resend";
import { baseUrl } from "./base-url";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Nerona <onboarding@resend.dev>";

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${baseUrl()}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your Nerona account",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${baseUrl()}/reset-password/${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your Nerona password",
    html: `<p>Click the link below to reset your password (expires in 1 hour):</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function sendLicenseEmail(email: string, licenseKey: string): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Nerona Pro license key",
    html: `<p>Thanks for subscribing to Nerona Pro! Your license key is:</p><p><code>${licenseKey}</code></p><p>Paste it into the extension popup to activate it. You can view it any time from your <a href="${baseUrl()}/account">account page</a>.</p>`,
  });
}

export async function sendRenewalInvoiceEmail(
  email: string,
  params: {
    tenantName: string;
    productLabel: string;
    planName: string;
    priceLabel: string;
    invoiceNumber: string;
    pdf: Buffer;
  }
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Perpanjangan paket Anda jatuh tempo — invoice terlampir",
    html: `
      <p>Halo ${params.tenantName},</p>
      <p>Paket <b>${params.productLabel} — ${params.planName}</b> (${params.priceLabel}) Anda akan segera berakhir.
      Invoice <b>${params.invoiceNumber}</b> terlampir pada email ini.</p>
      <p>Silakan lakukan transfer sesuai invoice, lalu unggah bukti transfer di
      <a href="${baseUrl()}/finance">dashboard Nerona</a> agar paket diperpanjang.</p>
      <p>Terima kasih.</p>
    `,
    attachments: [{ filename: `invoice-${params.invoiceNumber}.pdf`, content: params.pdf }],
  });
}
