import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const handler = NextAuth(authConfig)

export const GET = handler
export const POST = handler
