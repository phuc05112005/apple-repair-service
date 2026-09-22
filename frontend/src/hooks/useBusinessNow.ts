import { useEffect, useState } from 'react'
/** Client-only countdown clock. Does not fetch or persist. */
export function useBusinessNow() {
 const [now, setNow] = useState(() => Date.now())
 useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer) }, [])
 return now
}
