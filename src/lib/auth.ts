import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export type AdminRoleValue = "owner_admin" | "support";

export async function getAdminRole(userId: string): Promise<AdminRoleValue | null> {
  const record = await prisma.adminRole.findUnique({ where: { userId } });
  return (record?.role as AdminRoleValue | undefined) ?? null;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = await getAdminRole(user.id);
      }
      return session;
    },
  },
};
