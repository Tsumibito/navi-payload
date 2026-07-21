export const CONTENT_LOCALES = [
  { code: 'ru', label: 'Russian', terminology: 'Russian maritime and yachting terminology' },
  { code: 'uk', label: 'Ukrainian', terminology: 'Ukrainian maritime and yachting terminology; avoid literal Russian calques' },
  { code: 'en', label: 'English', terminology: 'standard international sailing and RYA/ISSA terminology' },
] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]['code']
export const CONTENT_LOCALE_CODES = CONTENT_LOCALES.map(({ code }) => code)

export const YACHTING_GLOSSARY = `
Preserve technically correct yachting vocabulary. Distinguish skipper/captain, helm/rudder/wheel,
tack/gybe, port/starboard, windward/leeward, close-hauled/beam reach/broad reach/run, berth/mooring/
anchorage/marina, sail/headsail/jib/genoa/mainsail, nautical mile and knot. Never translate brand
names, certificate names (ISSA, Inshore Skipper Sail, VHF SRC) or URLs. Prefer terminology used by
professional sailing schools over generic machine-translation wording. In Ukrainian use шкіпер,
вітрило, грот, стаксель, генуя, шкот, фал, стерно, правий/лівий борт, навітряний/підвітряний,
поворот оверштаг/фордевінд, морська миля and вузол; avoid Russian calques. In Russian use шкипер,
парус, грот, стаксель, генуя, шкот, фал, руль, правый/левый борт, наветренный/подветренный,
поворот оверштаг/фордевинд, морская миля and узел. In English prefer standard ISSA/RYA usage.`.trim()
