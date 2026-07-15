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
