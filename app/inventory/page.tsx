"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdminShell } from "@/components/dashboard/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { useDialog } from "@/components/ui/dialog-service"

type Product = {
  id: string
  name: string
  price: number
  brand: string | null
  desc: string | null
  imageUrl: string | null
  baseStock: number
  createdAt?: string
}

const emptyForm = { name: "", price: "", brand: "", desc: "", imageUrl: "", baseStock: "" }

export default function InventoryPage() {
  const dialog = useDialog()
  const [items, setItems] = useState<Product[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const editImageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadItems()
  }, [])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreview(null)
      return
    }
    const url = URL.createObjectURL(editImageFile)
    setEditImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editImageFile])

  async function loadItems() {
    setStatus("loading")
    setMessage("")
    try {
      const res = await fetch("/api/inventory")
      if (!res.ok) throw new Error("Unable to load inventory")
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setMessage(err instanceof Error ? err.message : "Unable to load inventory")
    }
  }

  const canSubmit = useMemo(() => {
    return form.name.trim() && Number(form.price) > 0
  }, [form])

  async function createProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setMessage("")
    try {
      if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        setMessage("Image is too large (max 5MB)")
        return
      }
      let imageUrl = form.imageUrl.trim() || null
      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            name: form.name.trim(),
            price: Number(form.price),
            brand: form.brand.trim() || null,
            desc: form.desc.trim() || null,
            imageUrl,
            baseStock: Number(form.baseStock) || 0
          }
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Create failed")
      setForm(emptyForm)
      setImageFile(null)
      setImagePreview(null)
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed")
    }
  }

  function startEdit(item: Product) {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      price: String(item.price),
      brand: item.brand || "",
      desc: item.desc || "",
      imageUrl: item.imageUrl || "",
      baseStock: String(item.baseStock ?? 0)
    })
  }

  async function saveEdit() {
    if (!editingId) return
    setMessage("")
    try {
      if (editImageFile && editImageFile.size > 5 * 1024 * 1024) {
        setMessage("Image is too large (max 5MB)")
        return
      }
      let imageUrl = editForm.imageUrl.trim() || null
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile)
      }
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name.trim(),
          price: Number(editForm.price),
          brand: editForm.brand.trim() || null,
          desc: editForm.desc.trim() || null,
          imageUrl,
          baseStock: Number(editForm.baseStock) || 0
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Update failed")
      setEditingId(null)
      setEditImageFile(null)
      setEditImagePreview(null)
      await loadItems()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed")
    }
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Upload failed")
      return String(data.url || "")
    } finally {
      setUploading(false)
    }
  }

  async function deleteItem(id: string) {
    const ok = await dialog.confirm("Delete this product?")
    if (!ok) return
    setMessage("")
    try {
      const res = await fetch("/api/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Delete failed")
      await loadItems()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed")
    }
  }

  return (
    <AdminShell title="Inventory Manager" subtitle="Create and manage storefront products">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-mydark">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mynavy dark:text-white">Add Product</h3>
              <p className="text-xs text-gray-500">Create a new product for the storefront.</p>
            </div>
            <form className="space-y-3" onSubmit={createProduct}>
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Product name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Brand (optional)"
                value={form.brand}
                onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Description (optional)"
                value={form.desc}
                onChange={(e) => setForm((prev) => ({ ...prev, desc: e.target.value }))}
                rows={3}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                >
                  Upload Image
                </button>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full border border-myamber/40 bg-myamber/10 text-myamber">
                  Max 5MB
                </span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setImageFile(file)
                  }}
                />
                <span className="text-[11px] text-gray-500">
                  {imageFile ? imageFile.name : "No image selected"}
                </span>
              </div>
              {imagePreview ? (
                <div className="rounded-lg border border-gray-200 dark:border-white/10 p-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-full object-cover rounded-md"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Price"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Base stock"
                value={form.baseStock}
                onChange={(e) => setForm((prev) => ({ ...prev, baseStock: e.target.value }))}
              />
              <button
                type="submit"
                disabled={!canSubmit || uploading}
                className="w-full rounded-lg bg-myamber text-black text-sm font-bold py-2 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Add Product"}
              </button>
              {message ? <p className="text-xs text-red-500">{message}</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-mydark lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-mynavy dark:text-white">Inventory</h3>
                <p className="text-xs text-gray-500">Manage live storefront products.</p>
              </div>
              <button
                onClick={loadItems}
                className="text-xs font-bold px-3 py-2 rounded-full border border-myamber/40 text-myamber hover:bg-myamber/10 transition-colors"
              >
                Refresh
              </button>
            </div>

            {status === "loading" ? (
              <p className="text-sm text-gray-500">Loading inventory...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500">No products yet.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3"
                  >
                    {editingId === item.id ? (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <input
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                          value={editForm.name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                        <input
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                          value={editForm.brand}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))}
                          placeholder="Brand"
                        />
                        <input
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                          value={editForm.desc}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, desc: e.target.value }))}
                          placeholder="Description"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => editImageInputRef.current?.click()}
                            className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                          >
                            Upload Image
                          </button>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full border border-myamber/40 bg-myamber/10 text-myamber">
                            Max 5MB
                          </span>
                          <input
                            ref={editImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                          />
                          <span className="text-[11px] text-gray-500">
                            {editImageFile ? editImageFile.name : "No image selected"}
                          </span>
                        </div>
                        {(editImagePreview || editForm.imageUrl) ? (
                          <div className="rounded-lg border border-gray-200 dark:border-white/10 p-2">
                            <img
                              src={editImagePreview || editForm.imageUrl || ""}
                              alt="Preview"
                              className="h-20 w-full object-cover rounded-md"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        ) : null}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                          value={editForm.price}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                        />
                        <input
                          type="number"
                          min="0"
                          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
                          value={editForm.baseStock}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, baseStock: e.target.value }))}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEdit}
                            className="text-xs font-bold px-3 py-2 rounded-full border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                          >
                            {uploading ? "Uploading..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-bold px-3 py-2 rounded-full border border-gray-400/40 text-gray-500 hover:bg-gray-200/30"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.brand || "Bal Nova"}</p>
                          {item.desc ? <p className="text-[11px] text-gray-400">{item.desc}</p> : null}
                          {item.imageUrl ? (
                            <div className="mt-2 flex items-center gap-2">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-10 w-10 rounded-md object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                              <button
                                onClick={async () => {
                                  await fetch("/api/inventory", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: item.id, imageUrl: null })
                                  })
                                  await loadItems()
                                }}
                                className="text-[10px] font-bold text-red-500"
                              >
                                Remove Image
                              </button>
                            </div>
                          ) : null}
                          <p className="text-[11px] text-gray-400">
                            Stock base: {item.baseStock ?? 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-myamber">{formatCurrency(item.price)}</span>
                          <button
                            onClick={() => startEdit(item)}
                            className="text-xs font-bold px-3 py-2 rounded-full border border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-xs font-bold px-3 py-2 rounded-full border border-red-500/40 text-red-600 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
