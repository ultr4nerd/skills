# Setting up wacli (agent-driven)

Run this when the user asks to set up WhatsApp/wacli, or when the first-use checks in `SKILL.md`
fail and the user agrees to fix it. Each step that changes the machine needs the user's yes first;
say what you will run and why. Stop at the first step that is already done.

## 1. Install

Check: `wacli --version` (0.26.0 or newer).

Ask before installing. Prefer the official channels, in this order:

```sh
brew install openclaw/tap/wacli
```

If the tap does not resolve, use the release archive and verify it (macOS arm64 shown; pick the
asset for `uname -s`/`uname -m`: `darwin_arm64`, `darwin_amd64`, `linux_amd64`, `linux_arm64`):

```sh
tmp=$(mktemp -d) && cd "$tmp"
gh release download -R openclaw/wacli -p 'wacli_*_darwin_arm64.tar.gz' -p checksums.txt
grep darwin_arm64 checksums.txt | shasum -a 256 -c -     # must print OK; stop if not
tar xzf wacli_*_darwin_arm64.tar.gz
install -m 755 wacli ~/.local/bin/wacli                  # or another dir on PATH
wacli --version
```

Without `gh`: download the same two files from https://github.com/openclaw/wacli/releases/latest
with `curl -fsSLO`. Never install from a fork, a mirror or a script piped to a shell.

## 2. Pair with the phone

Check: `wacli --read-only --json auth status` → `data.authenticated`. If several numbers are wanted,
pair each with `wacli accounts add NAME` instead (same flow, add `--account NAME` below).

Use the phone-number code, not the QR: the user cannot reliably see a QR printed in your terminal.

1. Ask for the WhatsApp number in international format (`+52 55 1234 5678`) and how much history
   to import (default: what the phone sends, about three months; `--history-days N` for less). The
   phone decides what it sends and may send more than asked; say so.
2. Start pairing as a **background command** (one the harness tracks and reports when it exits),
   capturing stderr to a file whose absolute path you note for later calls:
   ```sh
   wacli --events auth --phone '+525512345678' 2> /abs/path/wacli-auth.ndjson
   ```
   It keeps running while the user enters the code and while the first history sync arrives.
3. Wait a few seconds for the code (bounded loop, not a monitor), then read it:
   ```sh
   f=/abs/path/wacli-auth.ndjson
   for i in $(seq 1 60); do grep -qE '"event":"(pair_code|error)"' "$f" && break; sleep 1; done
   grep -E '"event":"(pair_code|error)"' "$f"
   ```
   The line is `{"event":"pair_code","data":{"phone":"...","code":"ABCD-EFGH"},"ts":<unix ms>}`.
   An `error` event instead (invalid number, passkey required) ends the flow: report it.
4. **Show the code as the last thing in your turn, then end the turn.** Some harnesses only surface
   the final message of a turn, so text written before another tool call can be invisible. The
   final message carries, in this order:
   - the code, large and on its own line;
   - the deadline: `ts` + 160 s as a local clock time, and "about 2 and a half minutes";
   - the phone steps: WhatsApp → **Settings → Linked devices → Link a device → Link with phone
     number instead** (below the QR camera), then type the code.

   Do not start monitors, polls or any other tool call after showing it in that turn.
   Why 160 s: wacli asks for the code on WhatsApp's first QR ref, and the QR channel holds 6 refs
   (60 s, then 5 × 20 s). When they run out, wacli exits with `QR code timed out`. The window is
   WhatsApp's, so treat it as approximate.
5. **Outcome.** The background command exiting is the signal (the harness notifies you), or the
   user's next reply, whichever comes first:
   - `wacli --read-only --json auth status` shows `authenticated: true` and the linked `phone`:
     paired. The command exits by itself after `--idle-exit` (30 s by default) once the first
     history sync goes quiet; let it finish so the history is stored.
   - It exited with `QR code timed out` (or an `error` event) and `authenticated` is false: the code
     expired. Tell the user and offer a new one; on a yes, start again from step 2. Never start a
     new pairing while the old command still runs.
   - The user says they typed it but `authenticated` is still false and the command still runs: the
     phone may still be confirming; check again in a few seconds before calling it failed.

   Delete the capture file afterwards: it holds the code.

If WhatsApp asks for a passkey, wacli stops with an error: tell the user, there is no workaround.

## 3. Keep sync running

Check: `wacli --read-only --json doctor` → `lock_held: true` means a sync process already owns
the store. Otherwise ask whether to install a user service so new messages keep arriving. Explain
the trade-off: the linked device stays connected while the machine is on.

Flags used below: `--presence-mode quiet` keeps phone notifications audible; `--max-db-size 2GB`
bounds the store; `--max-reconnect 0` keeps retrying through network drops. Ask before changing
the cap. Use the absolute path from `command -v wacli`.

### macOS (launchd)

Write `~/Library/LaunchAgents/sh.wacli.sync.plist` (replace `WACLI` and `HOME_DIR`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>sh.wacli.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>WACLI</string><string>sync</string><string>--follow</string>
    <string>--presence-mode</string><string>quiet</string>
    <string>--max-db-size</string><string>2GB</string>
    <string>--max-reconnect</string><string>0</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardErrorPath</key><string>HOME_DIR/.wacli/sync.log</string>
  <key>StandardOutPath</key><string>HOME_DIR/.wacli/sync.log</string>
</dict>
</plist>
```

```sh
plutil -lint ~/Library/LaunchAgents/sh.wacli.sync.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/sh.wacli.sync.plist
launchctl print gui/$(id -u)/sh.wacli.sync | grep -E 'state|last exit'
```

How it behaves:

- **Reboot / login:** the plist lives in `~/Library/LaunchAgents`, so launchd starts sync at every
  login (`RunAtLoad`). It is a per-user agent: it runs while the user is logged in, not before.
- **Sleep / offline:** the connection drops while the Mac sleeps or has no network and reconnects
  by itself (`--max-reconnect 0`); messages from that gap arrive as an offline backlog on reconnect.
- **Login Items:** macOS lists the agent under System Settings → General → Login Items &
  Extensions (it may show a "background item added" notice). Turning it off there disables it.
- **Phone inactive for a long time:** WhatsApp logs out linked devices when the phone itself has not
  been used for a while (about 14 days). Sync then exits with `logged_out` and is not restarted;
  re-pair with step 2.

Control (only when asked; say which one you run):

| Goal | Command |
|---|---|
| Status and last exit | `launchctl print gui/$(id -u)/sh.wacli.sync \| grep -E 'state\|last exit'` |
| Restart (after upgrading wacli) | `launchctl kickstart -k gui/$(id -u)/sh.wacli.sync` |
| Pause until next login | `launchctl bootout gui/$(id -u)/sh.wacli.sync` (resume: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/sh.wacli.sync.plist`) |
| Disable across reboots | `launchctl bootout ...` then `launchctl disable gui/$(id -u)/sh.wacli.sync` (undo: `launchctl enable ...` then `bootstrap`) |
| Remove | `bootout`, then delete the plist |

`bootout` alone does not survive a reboot: the plist is still there, so sync comes back at the next
login. Use disable or remove when the user wants it off for good.

### Linux (systemd user unit)

Write `~/.config/systemd/user/wacli-sync.service`:

```ini
[Unit]
Description=wacli WhatsApp sync
After=network-online.target

[Service]
ExecStart=WACLI sync --follow --presence-mode quiet --max-db-size 2GB --max-reconnect 0
Restart=on-failure
RestartSec=60

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now wacli-sync
systemctl --user status wacli-sync --no-pager
loginctl enable-linger "$USER"   # optional, ask first: keeps it running after logout
```

Why restart only on failure: when the phone unlinks the device, sync exits cleanly with
`logged_out`; restarting it would loop. Re-pairing (step 2) is the fix.

Control: `systemctl --user stop wacli-sync` pauses until the next login or boot;
`systemctl --user disable --now wacli-sync` keeps it off; `systemctl --user restart wacli-sync`
after upgrading wacli. Without linger the unit stops when the user logs out.

## 4. Verify

```sh
wacli --read-only --json doctor            # authenticated: true, lock_held: true, fts_enabled
wacli --read-only --json chats list --limit 5
```

`fts_enabled: false` only makes search slower. Report what was set up: the binary path and
version, the linked number, whether the service is installed and where its log is.

## Undo (only when the user asks)

1. Remove the service: launchd `bootout`, then delete `~/Library/LaunchAgents/sh.wacli.sync.plist`
   (a `bootout` alone comes back at the next login); systemd `systemctl --user disable --now wacli-sync`,
   then delete the unit file.
2. `wacli auth logout` unlinks the device (it also disappears from the phone's Linked devices).
3. Deleting `~/.wacli` removes every stored message and the keys. Confirm twice; it cannot be undone.
