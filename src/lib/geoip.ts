export type GeoIp = {
  city?: string
  region?: string
  country?: string
  countryCode?: string
  timezone?: string
}

export async function lookupGeoIp(ip?: string): Promise<GeoIp | null> {
  if (!ip) return null

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return null

    const data = await response.json() as {
      success?: boolean
      city?: string
      region?: string
      country?: string
      country_code?: string
      timezone?: { id?: string }
    }
    if (data.success === false) return null

    return {
      city: data.city,
      region: data.region,
      country: data.country,
      countryCode: data.country_code,
      timezone: data.timezone?.id,
    }
  } catch {
    return null
  }
}
