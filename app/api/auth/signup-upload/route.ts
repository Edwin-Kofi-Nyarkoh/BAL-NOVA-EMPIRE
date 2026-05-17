import { getClientIp, rateLimit } from "@/lib/server/rate-limit"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limiter = rateLimit(`signup_upload:${ip}`, 20, 10 * 60 * 1000)
  if (!limiter.ok) {
    return Response.json({ error: "Too many uploads. Try again later." }, { status: 429 })
  }

  const form = await req.formData()
  const file = form.get("file")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 })
  }

  const maxSize = 7 * 1024 * 1024
  if (file.size > maxSize) {
    return Response.json({ error: "File too large (max 7MB)" }, { status: 400 })
  }

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
  if (!allowedTypes.has(file.type)) {
    return Response.json({ error: "Only JPG, PNG, WEBP, or PDF files are allowed." }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const ext = path.extname(safeName) || (file.type === "application/pdf" ? ".pdf" : ".png")
  const base = path.basename(safeName, ext).slice(0, 80) || "signup-file"
  const filename = `${base}-${randomUUID()}${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads", "signup")
  const filePath = path.join(uploadDir, filename)

  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  return Response.json({ url: `/uploads/signup/${filename}` })
}
