type RiderTaskRow = {
  id: string
  type: string
  status: string
  revenue: number
  sequence: number
}

export function computeRiderVolume(tasks: RiderTaskRow[]) {
  const pickups = tasks.filter((t) => t.type === "pickup" && t.status !== "done").length
  return Math.min(100, pickups * 15)
}

export function pickActiveTaskId(tasks: RiderTaskRow[]) {
  const pending = [...tasks].sort((a, b) => a.sequence - b.sequence).find((t) => t.status !== "done")
  return pending?.id || null
}

export function rankForXp(xp: number) {
  if (xp >= 1500) return "ELITE"
  if (xp >= 750) return "ACE"
  if (xp >= 250) return "SCOUT"
  return "NOVICE"
}

export function clampReputation(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}
