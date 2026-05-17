import Link from "next/link"

const partnerLanes = [
  {
    title: "For vendors",
    body: "List products, manage pickups, and get a storefront link you can share with your own customers."
  },
  {
    title: "For riders",
    body: "Receive jobs faster, stay visible to dispatch, and work from clear coverage zones instead of vague routing."
  },
  {
    title: "For resellers",
    body: "Pull from the wider market, build your own shop, and track profit, withdrawals, and performance from one place."
  },
  {
    title: "For artisans",
    body: "Show your portfolio, publish your skills, and turn direct requests into repeat work across the ecosystem."
  }
]

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Partner with Bal Nova</p>
        <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
          We help real businesses sell, move, and get paid with less friction.
        </h1>
        <p className="mt-5 max-w-3xl text-base text-slate-300">
          Bal Nova is built for people doing the actual work: shops, logistics teams, resellers, riders, and artisans.
          Instead of juggling separate tools, you get one place to manage products, jobs, payouts, and customer activity.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {partnerLanes.map((lane) => (
            <div key={lane.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold text-white">{lane.title}</h2>
              <p className="mt-3 text-sm text-slate-400">{lane.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6">
          <h2 className="text-xl font-bold text-white">What happens next</h2>
          <p className="mt-3 text-sm text-amber-100">
            Create your account, choose your role, and our team will review partner applications before activation so the
            ecosystem stays trusted and operationally ready.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950">
              Apply now
            </Link>
            <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white">
              Back to landing page
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
