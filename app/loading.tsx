export default function Loading() {
  return (
    <div className="min-h-screen bg-mydark text-white flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded-full bg-myamber animate-pulse" />
        <div className="h-4 w-4 rounded-full bg-myamber/60 animate-pulse [animation-delay:150ms]" />
        <div className="h-4 w-4 rounded-full bg-myamber/30 animate-pulse [animation-delay:300ms]" />
        <span className="text-sm text-gray-300">Loading systems...</span>
      </div>
    </div>
  )
}
