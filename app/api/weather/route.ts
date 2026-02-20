const REGION_COORDS: Record<string, { name: string; lat: number; lon: number }> = {
  GH: { name: "Accra", lat: 5.6037, lon: -0.187 },
  NG: { name: "Lagos", lat: 6.5244, lon: 3.3792 },
  CI: { name: "Abidjan", lat: 5.3599, lon: -4.0083 }
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  95: "Thunderstorm"
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const region = (url.searchParams.get("region") || "GH").toUpperCase()
  const coords = REGION_COORDS[region] || REGION_COORDS.GH

  try {
    const query = new URL("https://api.open-meteo.com/v1/forecast")
    query.searchParams.set("latitude", String(coords.lat))
    query.searchParams.set("longitude", String(coords.lon))
    query.searchParams.set("current", "temperature_2m,weathercode")
    query.searchParams.set("timezone", "auto")

    const res = await fetch(query.toString(), { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    const current = data?.current
    const tempC = Number(current?.temperature_2m)
    const code = Number(current?.weathercode)
    if (!Number.isFinite(tempC)) {
      return Response.json({ error: "Weather unavailable" }, { status: 502 })
    }
    const summary = WEATHER_CODES[code] || "Unknown"
    return Response.json({ tempC: Math.round(tempC), summary, location: coords.name })
  } catch {
    return Response.json({ error: "Weather unavailable" }, { status: 502 })
  }
}
