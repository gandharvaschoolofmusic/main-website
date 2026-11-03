<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI & Styling Guidelines (Permanent Memory)
- **NO WHITE LINE BORDERS:** Never use visible white borders (`border-white`, `border-white/20`, `border-white/30`, `border-white/40`, or any white outline) on buttons, badges, user profile pills, avatars, or navbar elements. Use soft borderless backgrounds (e.g. `bg-white/15 hover:bg-white/25`), backdrop blur, or tonal color accents instead.

