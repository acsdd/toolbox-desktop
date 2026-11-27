interface SearchTool { id: string; name: string; description?: string }
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
export function rankTools<T extends SearchTool>(query: string, tools: readonly T[]): T[] {
  const needle = normalize(query)
  if (!needle) return [...tools]
  return tools.map((tool, index) => {
    const name = normalize(tool.name)
    const rank = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : normalize(tool.description ?? '').includes(needle) ? 3 : 4
    return { tool, rank, index }
  }).filter(item => item.rank < 4).sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.tool)
}
