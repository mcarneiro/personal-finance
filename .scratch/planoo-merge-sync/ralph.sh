#!/usr/bin/env bash
# ralph.sh — planoo-merge-sync implementation loop (a "Ralph loop" for OpenCode)
#
# Implements one ticket per fresh `opencode run` session, so every ticket starts
# with clean context. The loop itself is deliberately dumb: it picks the next
# ticket, launches the agent, then re-reads the ticket's Status line. All
# judgment lives in the per-ticket session, guided by the implement skill.
#
# Usage:
#   .scratch/planoo-merge-sync/ralph.sh               # run until no pickable ticket remains
#   DRY_RUN=1 .scratch/planoo-merge-sync/ralph.sh     # print the next pick, change nothing
#   STOP_AFTER=04 .scratch/planoo-merge-sync/ralph.sh # stop before ticket 04 (row-scoped
#                                                     #   writes — its two-client concurrency
#                                                     #   checks are worth watching yourself)
#   MAX_STALLS=1 .scratch/planoo-merge-sync/ralph.sh  # halt after N failed attempts per ticket
#   RALPH_AUTO=0 .scratch/planoo-merge-sync/ralph.sh  # drop --auto (runs will need a tty for
#                                                     #   permission asks — not for unattended use)
#   RALPH_MODEL=opencode-go/deepseek-v4-pro .scratch/planoo-merge-sync/ralph.sh
#                                                     # override the implementing model
#                                                     #   (format provider/model[#variant])
#
# Before starting, leave the dev server running on http://localhost:5173/, signed
# in to the Google account that owns the connected sheet, with Chrome on the
# Windows host exposing its DevTools endpoint on port 9222 (AGENTS.md requires
# browser verification through chrome-mcp for every ticket).
#
# Graceful halt:  touch .scratch/planoo-merge-sync/STOP   (checked before every ticket)
# Logs:           .scratch/planoo-merge-sync/ralph-logs/<NN>-<slug>.log
#
# Ticket contract (what the loop checks):
#   - done      = the ticket's `**Status:**` line reads `done`
#   - pickable  = not done, and every ticket listed in its `**Blocked by:**` line is done
#   - anything else after a run (agent stopped early, chrome-mcp not connected,
#     tests red) leaves the status unchanged → a stall. MAX_STALLS consecutive
#     stalls on the same ticket halt the loop so you can read the log and fix
#     forward instead of burning tokens.
#   - STOP_AFTER is an intentional operator stop: once every remaining open
#     ticket sits at or past it, the loop halts with exit 0 (not an error).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURE_DIR="$REPO_ROOT/.scratch/planoo-merge-sync"
ISSUES_DIR="$FEATURE_DIR/issues"
LOG_DIR="$FEATURE_DIR/ralph-logs"
STOP_FILE="$FEATURE_DIR/STOP"

MODEL="${RALPH_MODEL:-opencode-go/deepseek-v4.1-flash}"
MAX_STALLS="${MAX_STALLS:-2}"
STOP_AFTER="${STOP_AFTER:-}"
DRY_RUN="${DRY_RUN:-0}"
if [[ "${RALPH_AUTO:-1}" == "1" ]]; then AUTO=(--auto); else AUTO=(); fi

status_of() { awk '/^\*\*Status:\*\*/{sub(/^\*\*Status:\*\*[ \t]*/,""); print; exit}' "$1"; }
is_done()   { [[ "$(status_of "$1")" == "done" ]]; }

# Numbers of the tickets this one is blocked by (empty if none / "None").
blockers_of() {
  local line ref num
  line="$(awk '/^\*\*Blocked by:\*\*/{sub(/^\*\*Blocked by:\*\*[ \t]*/,""); print; exit}' "$1")"
  [[ -z "$line" || "$line" == None* ]] && return 0
  IFS=';' read -ra refs <<<"$line"
  for ref in "${refs[@]}"; do
    num="$(grep -oE '[0-9]+' <<<"$ref" | head -n1)"
    [[ -n "$num" ]] && printf '%s\n' "$num"
  done
}

open_tickets() {
  local f
  for f in "$ISSUES_DIR"/[0-9]*.md; do
    [[ -e "$f" ]] || return 0
    is_done "$f" || printf '%s\n' "$f"
  done
}

# Lowest-numbered ticket that is open, under STOP_AFTER, and unblocked.
next_ticket() {
  local f num ref bfile unblocked
  for f in "$ISSUES_DIR"/[0-9]*.md; do
    [[ -e "$f" ]] || return 1
    num="$(basename "$f" | grep -oE '^[0-9]+' || true)"
    [[ -n "$num" ]] || continue
    is_done "$f" && continue
    if [[ -n "$STOP_AFTER" ]] && (("10#${num}" >= "10#${STOP_AFTER}")); then continue; fi
    unblocked=1
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      for bfile in "$ISSUES_DIR"/"${ref}"-*.md; do
        [[ -e "$bfile" ]] || { unblocked=0; break; }
        is_done "$bfile" || { unblocked=0; break; }
      done
      ((unblocked)) || break
    done < <(blockers_of "$f")
    ((unblocked)) && { printf '%s\n' "$f"; return 0; }
  done
  return 1
}

prompt_for() {
  cat <<EOF
You are implementing one ticket of the planoo-merge-sync feature in this repo, unattended.

First load the implement skill (skill id: implement) with the skill tool, then follow it for this ticket:
.scratch/planoo-merge-sync/issues/$(basename "$1")
The feature spec is .scratch/planoo-merge-sync/spec.md; the design decisions and
their rejected alternatives are docs/adr/0007-startup-paints-from-a-cached-working-copy.md
and docs/adr/0008-row-scoped-merge-writes.md, and the domain glossary is CONTEXT.md.

Contract with the loop that launched you:
- Done means: the ticket's **Status:** line reads done, the work is committed with a conventional commit message, and a short ## Comments entry records what changed.
- There is no user available in this run. If you are blocked — for example AGENTS.md requires browser verification through chrome-mcp and it is not usable, or a decision only the user can make — leave **Status:** unchanged and end with a final line "BLOCKED: <reason>". Never mark a ticket done that you could not verify.

Environment, already set up by the user — do not start your own servers:
- The dev server is running at http://localhost:5173/ and is signed in to the Google account that owns the connected sheet. Drive it with chrome-mcp.
- Chrome runs on the Windows host with its DevTools endpoint on 127.0.0.1:9222. The first chrome-mcp connection of a session fails with "Connection closed" and then self-heals: treat that as expected, check liveness with list_pages, retry a failed call once, and only then declare a blocker. Details: docs/agents/chrome-devtools-mcp.md.
- Two-client checks (tickets 04 and 05) need the same sheet open as two independent app instances: use a second Chrome tab as the second client. If that tab is signed out because auth is session-only, enable "keep me signed in" in Settings for the check and restore the setting afterwards.
- Security (AGENTS.md): never commit, log, or paste OAuth tokens, client secrets, or spreadsheet ids into commits, comments, or run notes.
EOF
}

warn_if_dirty() {
  local dirty
  dirty="$(git -C "$REPO_ROOT" diff --name-only 2>/dev/null || true)"
  [[ -z "$dirty" ]] && return 0
  echo "Warning: modified tracked files present — a per-ticket commit may sweep them in:" >&2
  printf '  %s\n' $dirty >&2
  if [[ -t 0 ]]; then
    local reply=""
    read -r -p "Commit or stash them first. Continue anyway? [y/N] " reply || true
    [[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "Aborted."; exit 1; }
  fi
}

main() {
  command -v opencode >/dev/null || { echo "opencode CLI not found on PATH" >&2; exit 1; }
  mkdir -p "$LOG_DIR"
  warn_if_dirty

  local stalls=0 iteration=0 ticket name log remaining t
  trap 'printf "\nInterrupted — re-run the script to resume; done tickets are skipped.\n" >&2; exit 130' INT

  while true; do
    if [[ -e "$STOP_FILE" ]]; then
      echo "STOP file present — halting. (rm '$STOP_FILE' and re-run to resume)"
      exit 0
    fi

    ticket="$(next_ticket)"
    if [[ -z "$ticket" ]]; then
      remaining="$(open_tickets)"
      if [[ -z "$remaining" ]]; then
        echo "All planoo-merge-sync tickets are done — loop complete."
        exit 0
      fi
      if [[ -n "$STOP_AFTER" ]]; then
        echo "Reached STOP_AFTER=$STOP_AFTER — halting. Still open:"
        while IFS= read -r t; do printf '  %s\n' "$t"; done <<<"$remaining"
        exit 0
      fi
      echo "No pickable ticket left. Still open (blocked or parked):" >&2
      while IFS= read -r t; do printf '  %s\n' "$t" >&2; done <<<"$remaining"
      exit 1
    fi

    name="$(basename "$ticket")"
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "DRY_RUN — next ticket: $name"
      exit 0
    fi

    iteration=$((iteration + 1))
    log="$LOG_DIR/${name%.md}.log"
    printf '\n=== %s (iteration %d) — model %s — %s ===\n' "$name" "$iteration" "$MODEL" "$(date -Is)"

    if ! opencode run --title "planoo-merge-sync ${name%.md}" --model "$MODEL" "${AUTO[@]}" "$(prompt_for "$ticket")" 2>&1 | tee "$log"; then
      echo "opencode run exited nonzero for $name (log: $log)"
    fi

    if is_done "$ticket"; then
      stalls=0
      echo "✔ $name is done."
    else
      stalls=$((stalls + 1))
      echo "✘ $name not done (attempt $stalls/$MAX_STALLS) — log: $log"
      if (( stalls >= MAX_STALLS )); then
        echo "Halting: no progress on $name after $MAX_STALLS attempt(s). Read the log, fix forward, re-run the loop."
        exit 1
      fi
    fi
  done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
