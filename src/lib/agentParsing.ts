export type ParsedSubtask = {
  title: string
  status: 'todo' | 'doing' | 'done' | undefined
}

export type ParsedFeaturePlan = {
  featureTitle?: string
  subtasks: ParsedSubtask[]
}

export function extractFeaturePlanFromText(text: string): ParsedFeaturePlan | null {
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
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      parsed = tryParse(trimmed.slice(start, end + 1))
    }
  }

  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as { featureTitle?: unknown; subtasks?: unknown }
  const featureTitle = typeof obj.featureTitle === 'string' ? obj.featureTitle.trim() : undefined
  const subtasksRaw = Array.isArray(obj.subtasks) ? obj.subtasks : []
  const subtasks = subtasksRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const title = (item as { title?: unknown }).title
      if (typeof title !== 'string' || !title.trim()) return null
      const status = (item as { status?: unknown }).status
      const normalizedStatus =
        status === 'todo' || status === 'doing' || status === 'done' ? status : undefined
      return { title: title.trim(), status: normalizedStatus }
    })
    .filter((item): item is ParsedSubtask => Boolean(item))

  if (!featureTitle && subtasks.length === 0) return null
  return { featureTitle, subtasks }
}
