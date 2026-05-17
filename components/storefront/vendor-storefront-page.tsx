"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { StorefrontShell } from "@/components/storefront/storefront-shell"

type VendorReview = {
  id: string
  rating: number
  title?: string | null
  comment?: string | null
  createdAt: string
  reviewerName: string
}

type VendorDetails = {
  id: string
  name: string
  initials: string
  tier: number
  bio?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  businessAddress?: string | null
  region?: string | null
  hubs: { id: string; name: string }[]
  productCount: number
  reviewCount: number
  averageRating: number
  reviews: VendorReview[]
}

export function VendorStorefrontPage({ vendorId }: { vendorId: string }) {
  const [vendor, setVendor] = useState<VendorDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState("")
  const [comment, setComment] = useState("")
  const [reviewMessage, setReviewMessage] = useState("")

  useEffect(() => {
    void loadVendor()
    void checkAuth()
  }, [vendorId])

  async function checkAuth() {
    try {
      const res = await fetch("/api/me")
      setIsAuthed(res.ok)
    } catch {
      setIsAuthed(false)
    }
  }

  async function loadVendor() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(vendorId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not load vendor storefront")
      setVendor(data.vendor || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vendor storefront")
    } finally {
      setLoading(false)
    }
  }

  const ratingLabel = useMemo(() => {
    if (!vendor || vendor.reviewCount === 0) return "No reviews yet"
    return `${vendor.averageRating}/5 from ${vendor.reviewCount} review${vendor.reviewCount === 1 ? "" : "s"}`
  }, [vendor])

  async function submitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!isAuthed) {
      setReviewMessage("Please log in to leave a review.")
      return
    }
    setSubmitting(true)
    setReviewMessage("")
    try {
      const res = await fetch(`/api/vendors/${encodeURIComponent(vendorId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title, comment })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not save your review.")
      setTitle("")
      setComment("")
      setReviewMessage("Thanks — your review has been saved.")
      await loadVendor()
    } catch (err) {
      setReviewMessage(err instanceof Error ? err.message : "Could not save your review.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-white p-6 text-sm text-gray-500 dark:bg-gray-900">Loading vendor storefront...</div>
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-white p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || "Vendor not found"}
          <div className="mt-4">
            <Link href="/" className="font-bold underline">
              Return to storefront
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      <section className="border-b border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="text-xs font-bold text-myamber">
            Back to marketplace
          </Link>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-3xl bg-gradient-to-r from-[#09162d] via-[#0e2446] to-[#19355f] p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-300 text-xl font-black text-mynavy">
                  {vendor.initials}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Vendor Storefront</div>
                  <h1 className="mt-2 text-3xl font-black">{vendor.name}</h1>
                  <p className="mt-2 text-sm text-slate-200">{vendor.bio || "This vendor has not added a public bio yet."}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 font-bold text-amber-200">Tier {vendor.tier}</span>
                {vendor.region ? <span className="rounded-full bg-white/10 px-3 py-1">Region: {vendor.region}</span> : null}
                <span className="rounded-full bg-white/10 px-3 py-1">Products: {vendor.productCount}</span>
                <span className="rounded-full bg-white/10 px-3 py-1">Rating: {ratingLabel}</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Contact</div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-[11px] font-bold text-gray-500">Email</div>
                  <div>{vendor.contactEmail || "Not shared"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-500">Phone</div>
                  <div>{vendor.contactPhone || "Not shared"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-500">Address</div>
                  <div>{vendor.businessAddress || "Not shared"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-500">Hubs</div>
                  <div>{vendor.hubs.length ? vendor.hubs.map((hub) => hub.name).join(", ") : "No hubs listed"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Vendor Reviews</div>
                  <div className="mt-1 text-sm text-gray-500">{ratingLabel}</div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {vendor.reviews.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-gray-500 dark:border-gray-700">
                    No customer reviews yet.
                  </div>
                ) : (
                  vendor.reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 p-4 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-4">
                        <div className="font-bold">{review.title || "Vendor review"}</div>
                        <div className="text-xs font-bold text-myamber">{review.rating}/5</div>
                      </div>
                      {review.comment ? <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{review.comment}</p> : null}
                      <div className="mt-2 text-[11px] text-gray-400">
                        {review.reviewerName} · {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={submitReview} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Leave a Review</div>
              <div className="mt-4">
                <label className="text-[11px] font-bold text-gray-500">Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="text-[11px] font-bold text-gray-500">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  placeholder="Short summary"
                />
              </div>
              <div className="mt-3">
                <label className="text-[11px] font-bold text-gray-500">Comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  rows={5}
                  placeholder="What was good about this vendor?"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full rounded-xl bg-mynavy py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "Saving Review..." : "Submit Review"}
              </button>
              {reviewMessage ? <div className="mt-3 text-xs text-gray-500">{reviewMessage}</div> : null}
              {!isAuthed ? (
                <div className="mt-3 text-xs text-gray-500">
                  You need to <Link href="/login" className="font-bold text-myamber">log in</Link> before posting a review.
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </section>

      <StorefrontShell forcedVendorId={vendorId} hideHero />
    </div>
  )
}
