import type { DefaultSession } from "next-auth";
import type { AdminRoleValue } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AdminRoleValue | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdminRoleValue | null;
  }
}
