---
name: node-envfile-gotchas
description: Node --env-file silently skips vars after blank-with-space lines or a BOM
metadata:
  type: reference
---

The server (`server/`) loads config via Node's native `--env-file=.env` (no
dotenv). Node's `--env-file` parser is fragile in two non-obvious ways that both
cause variables to be silently dropped (showing up as `undefined`):

1. **A "blank" line containing a space** (`" "` not `""`) makes the parser stop
   loading subsequent variables. The original `.env` had space-padded separator
   lines, which silently dropped `SMTP_HOST` → server fell back to `localhost`
   and SMTP connected to 127.0.0.1:465.
2. **A UTF-8 BOM** at the start of the file breaks parsing of the first var.

Fix: keep `.env` plain ASCII, no BOM, truly empty blank lines. Diagnose with
`node --env-file=.env -e "console.log(process.env.SMTP_HOST)"`.
