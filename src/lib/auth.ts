import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { hit, RATE_LIMITS } from "./rate-limit";

export type AdminRoleValue = "owner_admin" | "support";

export async function getAdminRole(userId: string): Promise<AdminRoleValue | null> {
  const record = await prisma.adminRole.findUnique({ where: { userId } });
  return (record?.role as AdminRoleValue | undefined) ?? null;
}

export async function authorizeCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.password) {
    return null;
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return null;
  }
  return { id: user.id, email: user.email, name: user.name };
}

export async function jwtCallback({
  token,
  user,
}: {
  token: JWT;
  user?: { id: string };
}): Promise<JWT> {
  if (user) {
    token.id = user.id;
    token.role = await getAdminRole(user.id);
  }
  return token;
}

export function sessionCallback({ session, token }: { session: Session; token: JWT }): Session {
  if (session.user) {
    session.user.id = token.id as string;
    session.user.role = (token.role as AdminRoleValue | null) ?? null;
  }
  return session;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Do NOT auto-link a Google login to an existing password account by email
      // alone — that would let anyone controlling a Google address take over a
      // pre-existing password account with the same email.
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        // Throttle brute-force by IP. `req.headers` is a plain object in NextAuth v4.
        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined) ?? "";
        const ip = forwarded.split(",")[0]?.trim() || "unknown";
        const { limit, windowMs } = RATE_LIMITS.login;
        if (!hit(`login:${ip}`, limit, windowMs).ok) {
          throw new Error("too_many_requests");
        }
        return authorizeCredentials(credentials.email, credentials.password);
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
};
