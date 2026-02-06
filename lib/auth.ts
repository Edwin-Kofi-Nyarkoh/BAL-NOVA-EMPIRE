import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/server/prisma"
import bcrypt from "bcryptjs"

export const authConfig: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim()
        const password = String(credentials?.password || "")
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        if (user.approvalStatus && user.approvalStatus !== "approved") return null

        const ok = await bcrypt.compare(password, user.password)
        if (!ok) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || "user",
          approvalStatus: user.approvalStatus || "approved"
        } as any
      }
    })
  ],
  pages: {
    signIn: "/login"
  },
  session: { strategy: "jwt", maxAge: 2 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "user"
        token.id = (user as any).id
        token.approvalStatus = (user as any).approvalStatus || "approved"
      } else if (token?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { id: true, role: true, approvalStatus: true }
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role || "user"
          token.approvalStatus = dbUser.approvalStatus || "approved"
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = (token as any).role || "user"
        ;(session.user as any).id = (token as any).id
        ;(session.user as any).approvalStatus = (token as any).approvalStatus || "approved"
      }
      return session
    }
  }
}
