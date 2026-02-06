import { requireAdmin } from "@/lib/server/api-auth"
import { mkdir, writeFile } from "fs/promises"
import path from "path"

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const form = await req.formData()
  const file = form.get("file")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 })
  }

  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return Response.json({ error: "File too large (max 5MB)" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are allowed" }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const ext = path.extname(safeName) || ".png"
  const base = path.basename(safeName, ext)
  const filename = `${base}-${Date.now()}${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads")
  const filePath = path.join(uploadDir, filename)

  await mkdir(uploadDir, { recursive: true })
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  return Response.json({ url: `/uploads/${filename}` })
}
