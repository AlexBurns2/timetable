# Timetable website

## graphify (use first, saves tokens)
- Code graph lives in `graphify-out/` (graph.json, GRAPH_REPORT.md). Before reading or grepping files to find code, query it:
  - `~/Library/Python/3.14/bin/graphify explain "<symbol>"` — node, file:line, callers/callees
  - `~/Library/Python/3.14/bin/graphify path "A" "B"` — how two things connect
  - `graphify-out/GRAPH_REPORT.md` — god nodes and communities overview
- Then read only the lines it points to.
- After editing code, refresh it (AST only, no LLM, fast): `~/Library/Python/3.14/bin/graphify update .`
- Excludes are in `.graphifyignore` (node_modules, backup, .vercel).
