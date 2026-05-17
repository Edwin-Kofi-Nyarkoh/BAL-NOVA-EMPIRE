// app/signup/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ModeToggle } from "@/components/ui/mode-toggle"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")
  const [artisanTrack, setArtisanTrack] = useState<"individual" | "corporate">("individual")
  const [phone, setPhone] = useState("")
  const [primaryTrade, setPrimaryTrade] = useState("")
  const [operationalBase, setOperationalBase] = useState("")
  const [momoNumber, setMomoNumber] = useState("")
  const [payoutAccountName, setPayoutAccountName] = useState("")
  const [diagnosticFee, setDiagnosticFee] = useState("50")
  const [bio, setBio] = useState("")
  const [ghanaCardNumber, setGhanaCardNumber] = useState("")
  const [guarantorName, setGuarantorName] = useState("")
  const [guarantorPhone, setGuarantorPhone] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [corporateTin, setCorporateTin] = useState("")
  const [technicianCount, setTechnicianCount] = useState("1")
  const [ghanaCardFront, setGhanaCardFront] = useState<File | null>(null)
  const [ghanaCardBack, setGhanaCardBack] = useState<File | null>(null)
  const [livenessSelfie, setLivenessSelfie] = useState<File | null>(null)
  const [headshot, setHeadshot] = useState<File | null>(null)
  const [rgdCertificate, setRgdCertificate] = useState<File | null>(null)
  const [directorCard, setDirectorCard] = useState<File | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [workPhotos, setWorkPhotos] = useState<File[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const requestedRole = searchParams.get("role")
    if (!requestedRole) return
    const allowed = new Set(["user", "vendor", "rider", "reseller", "pro"])
    if (allowed.has(requestedRole)) {
      setRole(requestedRole)
    }
  }, [searchParams])

  async function uploadSignupFile(file: File | null) {
    if (!file) return undefined
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/auth/signup-upload", { method: "POST", body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || "Could not upload verification file.")
    }
    return String(data.url)
  }

  async function uploadSignupFiles(files: File[]) {
    const urls: string[] = []
    for (const file of files.slice(0, 10)) {
      const url = await uploadSignupFile(file)
      if (url) urls.push(url)
    }
    return urls
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setPending(false)
    setSubmitBusy(true)
    let uploaded: Record<string, any> = {}
    try {
      if (role === "pro") {
        uploaded = {
          ghanaCardFrontUrl: await uploadSignupFile(ghanaCardFront),
          ghanaCardBackUrl: await uploadSignupFile(ghanaCardBack),
          livenessSelfieUrl: await uploadSignupFile(livenessSelfie),
          headshotUrl: await uploadSignupFile(headshot),
          rgdCertificateUrl: await uploadSignupFile(rgdCertificate),
          directorCardUrl: await uploadSignupFile(directorCard),
          logoUrl: await uploadSignupFile(logo),
          workPhotos: await uploadSignupFiles(workPhotos)
        }
      }
    } catch (uploadError: any) {
      setSubmitBusy(false)
      setError(uploadError?.message || "Could not upload verification files.")
      return
    }

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...(role === "pro"
          ? {
              artisanOnboarding: {
                track: artisanTrack,
                legalName: name,
                phone,
                primaryTrade,
                operationalBase,
                momoNumber,
                payoutAccountName,
                diagnosticFee: Number(diagnosticFee || (artisanTrack === "corporate" ? 150 : 50)),
                bio,
                ghanaCardNumber,
                guarantorName,
                guarantorPhone,
                companyName,
                corporateTin,
                technicianCount: Number(technicianCount || 1),
                tradeCategories: primaryTrade ? [primaryTrade] : [],
                subSpecialties: primaryTrade ? [primaryTrade] : [],
                ...uploaded
              }
            }
          : {})
      })
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const approvalStatus = data?.approvalStatus
      const msg = data?.message || "Account created."
      setPending(approvalStatus === "pending")
      setMessage(msg)
      setName("")
      setEmail("")
      setPassword("")
      setSubmitBusy(false)
      router.push(`/login?signup=1&email=${encodeURIComponent(email)}`)
    } else {
      const data = await res.json().catch(() => ({}))
      setSubmitBusy(false)
      setError(data.error || "Signup failed")
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-mydark flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Bal Nova</p>
            <h1 className="text-2xl font-black text-mynavy dark:text-white">Create Account</h1>
          </div>
          <ModeToggle />
        </div>
        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-mynavy dark:hover:text-white">
          ← Back to Landing
        </Link>
        <p className="text-xs text-gray-500 mb-6">Sign up to access Bal Nova portals.</p>
        <label className="text-xs font-bold text-gray-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-3"
          required
        />
        <label className="text-xs font-bold text-gray-500">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white mb-4"
        >
          <option value="user">Customer</option>
          <option value="vendor">Vendor</option>
          <option value="rider">Rider</option>
          <option value="reseller">Reseller</option>
          <option value="pro">Pro</option>
        </select>
        {role === "pro" ? (
          <div className="mb-4 rounded-xl border border-myamber/30 bg-myamber/5 p-4">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-myamber">Artisan verification</p>
              <p className="text-xs text-gray-500">This packet goes to admin approval before the Pro can receive jobs.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-gray-500">
                Track
                <select
                  value={artisanTrack}
                  onChange={(e) => {
                    const next = e.target.value as "individual" | "corporate"
                    setArtisanTrack(next)
                    setDiagnosticFee(next === "corporate" ? "150" : "50")
                  }}
                  className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="individual">Individual Artisan</option>
                  <option value="corporate">Registered Corporate Entity</option>
                </select>
              </label>
              <label className="text-xs font-bold text-gray-500">
                Phone / OTP number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              <label className="text-xs font-bold text-gray-500">
                Primary trade
                <input value={primaryTrade} onChange={(e) => setPrimaryTrade(e.target.value)} placeholder="Plumber, Electrician..." className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              <label className="text-xs font-bold text-gray-500">
                Operational base
                <input value={operationalBase} onChange={(e) => setOperationalBase(e.target.value)} placeholder="Accra, Spintex..." className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              <label className="text-xs font-bold text-gray-500">
                MoMo wallet
                <input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              <label className="text-xs font-bold text-gray-500">
                Wallet/account name
                <input value={payoutAccountName} onChange={(e) => setPayoutAccountName(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              <label className="text-xs font-bold text-gray-500">
                Diagnostic fee (GHS)
                <input type="number" min="0" value={diagnosticFee} onChange={(e) => setDiagnosticFee(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </label>
              <label className="text-xs font-bold text-gray-500">
                Ghana Card / TIN
                <input value={artisanTrack === "corporate" ? corporateTin : ghanaCardNumber} onChange={(e) => artisanTrack === "corporate" ? setCorporateTin(e.target.value) : setGhanaCardNumber(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
              </label>
              {artisanTrack === "individual" ? (
                <>
                  <label className="text-xs font-bold text-gray-500">
                    Guarantor name
                    <input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Guarantor phone
                    <input value={guarantorPhone} onChange={(e) => setGuarantorPhone(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-xs font-bold text-gray-500">
                    Company name
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Technician capacity
                    <input type="number" min="1" value={technicianCount} onChange={(e) => setTechnicianCount(e.target.value)} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  </label>
                </>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {artisanTrack === "individual" ? (
                <>
                  <label className="text-xs font-bold text-gray-500">
                    Ghana Card front
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setGhanaCardFront(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Ghana Card back
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setGhanaCardBack(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Liveness selfie
                    <input type="file" accept="image/*" onChange={(e) => setLivenessSelfie(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Public headshot
                    <input type="file" accept="image/*" onChange={(e) => setHeadshot(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-xs font-bold text-gray-500">
                    RGD certificate
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setRgdCertificate(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Director Ghana Card
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setDirectorCard(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" required={role === "pro"} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">
                    Company logo
                    <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" />
                  </label>
                </>
              )}
              <label className="text-xs font-bold text-gray-500 sm:col-span-2">
                Portfolio photos
                <input type="file" accept="image/*" multiple onChange={(e) => setWorkPhotos(Array.from(e.target.files || []).slice(0, 10))} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs dark:bg-gray-800 dark:border-gray-700" />
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-gray-500">
              Bio / service promise
              <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, artisanTrack === "corporate" ? 250 : 150))} rows={3} className="mt-1 w-full p-3 rounded-lg border bg-white text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white" placeholder="Short public profile shown after approval." />
            </label>
          </div>
        ) : null}
        {error ? <div className="text-xs text-red-500 mb-3">{error}</div> : null}
        {message ? (
          <div className={`text-xs mb-3 ${pending ? "text-myamber" : "text-green-500"}`}>{message}</div>
        ) : null}
        {pending ? (
          <div className="text-[11px] text-gray-500 mb-3">
            Partner accounts require admin approval before you can sign in.
          </div>
        ) : null}
        <button disabled={submitBusy} className="w-full bg-mynavy text-white py-3 rounded-xl font-bold disabled:opacity-60">
          {submitBusy ? "Submitting..." : "Create Account"}
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Already have an account? <Link href="/login" className="text-myamber font-bold">Login</Link>
        </p>
      </form>
    </div>
  )
}

