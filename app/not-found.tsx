import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-mydark text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-5xl font-extrabold text-myamber">404</div>
        <h1 className="mt-2 text-xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-sm text-gray-300">
          The route you requested doesn&apos;t exist. Use the sidebar to navigate back.
        </p>
        <Link
          href="/"
          className="inline-flex mt-6 px-4 py-2 rounded-full bg-myamber text-black text-sm font-bold"
        >
          Back to Command Center
        </Link>
      </div>
    </div>
  )
}
