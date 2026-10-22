# Third-party notices

The following Claude Code components were vendored (copied, with a short project note added) from
**claude-code-templates** by Daniel (San) Ávila — https://github.com/davila7/claude-code-templates
(browsable at https://www.aitmpl.com), licensed under the MIT License:

| Component | Upstream path |
| --- | --- |
| `.claude/agents/typescript-pro.md` | cli-tool/components/agents/programming-languages/typescript-pro.md |
| `.claude/agents/test-automator.md` | cli-tool/components/agents/development-tools/test-automator.md |
| `.claude/agents/code-reviewer.md` | cli-tool/components/agents/development-tools/code-reviewer.md |
| `.claude/agents/accessibility-tester.md` | cli-tool/components/agents/development-tools/accessibility-tester.md |
| `.claude/agents/github-actions-expert.md` | cli-tool/components/agents/security/github-actions-expert.md |
| `.claude/skills/verification-before-completion/` | cli-tool/components/skills/development/verification-before-completion |
| `.claude/skills/test-driven-development/` | cli-tool/components/skills/development/test-driven-development |
| `.claude/skills/systematic-debugging/` (SKILL.md, root-cause-tracing.md, defense-in-depth.md) | cli-tool/components/skills/development/systematic-debugging |

Modifications: a "Project note" paragraph after the frontmatter; `tools:` lines adjusted for Claude
Code tool names on `github-actions-expert` and `code-reviewer`; references to files that were not
vendored removed from `systematic-debugging`.

MIT License — Copyright (c) 2025 Daniel (San) Ávila. Permission is hereby granted, free of charge, to
any person obtaining a copy of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions: The above
copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The ESP32 GPIO reference in `.claude/skills/esp32-gpio-reference/references/` is a transcription of
facts from Espressif's ESP32 Technical Reference Manual v5.8 (tables 6.10-1, 6.11-1, register 6.13),
included as a research lead; consult Espressif's official documents for authoritative values.
