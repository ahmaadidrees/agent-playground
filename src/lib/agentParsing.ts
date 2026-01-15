export type ParsedTask = {
  title: string
}

export function extractTasksFromText(text: string): ParsedTask[] {
  const trimmed = text.trim()
  const tryParse = (value: string) => {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  let parsed = tryParse(trimmed)
  if (!parsed) {
    const start = trimmed.indexOf('[')
    const end = trimmed.lastIndexOf(']')
    if (start >= 0 && end > start) {
      parsed = tryParse(trimmed.slice(start, end + 1))
    }
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null
      const title = (item as { title?: string }).title
      if (typeof title !== 'string' || title.trim().length === 0) return null
      return { title: title.trim() }
    })
    .filter((item): item is ParsedTask => Boolean(item))
}
