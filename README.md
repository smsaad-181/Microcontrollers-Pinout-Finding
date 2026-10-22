# Universal Pinout Finder — Claude Code project kit

This folder is a ready-to-run **Claude Code** workspace. It contains the approved plan, a phased build
script, specialised subagents (builders + validators), project skills, slash commands, hooks and MCP
server config. Unzip it, open it in Claude Code, and say **go**.

## What gets built

A static web app on **GitHub Pages**: pick an exact board, add sensors/modules, and get a conflict-free,
electrically checked pin allocation with interface choice, warnings, wiring table, citations to
official datasheets, and example code. See `docs/PLAN.md`.

## Prerequisites (on your machine)

| Tool | Why | Check |
| --- | --- | --- |
| Claude Code (latest) | Runs the agents | `claude --version` |
| Node.js LTS (≥ 20) + pnpm | Build and tests | `node -v`, `pnpm -v` (`corepack enable` installs pnpm) |
| Git | Version control | `git --version` |
| GitHub CLI, logged in | Repo, PRs, Pages, branch protection | `gh auth status` |
| uv (optional) | Runs the `fetch` MCP server for verbatim page reads | `uv --version` |
| Python 3 | Electrical calculation checks | `python3 --version` |

Optional: a free Context7 API key in `CONTEXT7_API_KEY` (higher rate limits for library docs).

## Start

```bash
unzip pinout-finder-kit.zip
cd pinout-finder
git init -b main && git add -A && git commit -m "chore: import Claude Code project kit"
claude          # first run: approve the project MCP servers when asked
```

Then type:

```
/go
```

Claude reads `CLAUDE.md` and `docs/STATE.md`, starts at Phase 0, and works phase by phase. After every
phase, three validator agents check the work (gate commands, independent re-verification of hardware
facts against official sources, and independent recalculation of the electrical math). Only a full
PASS moves the build forward.

Useful commands inside Claude Code:

| Command | Does |
| --- | --- |
| `/go` | Continue from the current phase until a gate needs you or everything is done |
| `/status` | Show progress, open blockers and decisions needed |
| `/phase 2a` | Run one specific phase |
| `/validate 2a` | Re-run the validators for a phase |
| `/add-board <name>` | Research and add a new board with the two-key process |
| `/add-module <name>` | Same for a sensor/breakout module |
| `/verify-fact <id>` | Re-check one catalog fact against its source |

## When Claude will stop and ask you

1. **Phase 0:** create/confirm the GitHub repo name, and approve enabling GitHub Pages (Claude can do it
   with `gh` if you are logged in).
2. **Manual downloads:** some vendors block automated downloads (for example the Microchip ATmega328P
   datasheet and the Sitronix ST7735S datasheet). Claude lists them in `sources/manual/README.md`;
   download them into `sources/manual/` and say "continue".
3. **Decisions needed:** anything that would change scope is written in `docs/STATE.md`.
4. **Three failed fix rounds** on a phase gate.

## Running unattended

For long runs, start Claude with edits auto-accepted:

```bash
claude --permission-mode acceptEdits
```

`.claude/settings.json` pre-approves the common safe commands (pnpm, node, git, gh, curl, python3) and
blocks destructive ones. Review it before use.

## What is inside

```
CLAUDE.md                 orchestrator instructions (read automatically)
.mcp.json                 MCP servers: context7, fetch, playwright
.claude/agents/           9 custom + 5 vendored subagents (aitmpl.com)
.claude/skills/           11 custom + 3 vendored skills
.claude/commands/         slash commands
.claude/hooks/            session-start status, catalog validation on edit
.claude/settings.json     permissions, hooks
docs/PLAN.md              approved final plan
docs/STATE.md             progress tracker (Claude updates it)
docs/phases/              phase-by-phase tasks and gates
docs/research/            verified leads from planning + golden worked example
docs/templates/           evidence, board, module, validation report templates
sources/manual/           place for hand-downloaded datasheets (not committed)
THIRD_PARTY_NOTICES.md    attribution for vendored aitmpl.com components (MIT)
```
