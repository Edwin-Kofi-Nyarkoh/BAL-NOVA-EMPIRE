"use client"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-mydark text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-4xl font-extrabold text-red-400">System Error</div>
        <p className="mt-3 text-sm text-gray-300">{error.message || "Something went wrong."}</p>
        <button
          onClick={() => reset()}
          className="inline-flex mt-6 px-4 py-2 rounded-full bg-myamber text-black text-sm font-bold"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
