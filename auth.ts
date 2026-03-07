import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureTenantForUser } from "@/lib/db";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-me");

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: authSecret,
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async session({ session, token }) {
      const email = session.user?.email ?? token.email;
      if (email) {
        const { userId, tenantId } = ensureTenantForUser({
          email,
          name: session.user?.name ?? token.name,
          image: session.user?.image ?? (typeof token.picture === "string" ? token.picture : null)
        });
        if (session.user) {
          session.user.id = userId;
          session.user.tenantId = tenantId;
        }
      }
      return session;
    }
  }
});
