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
   to import (default: what the phone sends, about three months; `--history-days N` for less).
2. Start pairing in the background and capture stderr:
   ```sh
   log=$(mktemp -t wacli-auth)
   wacli --events auth --phone '+525512345678' 2> "$log"
   ```
   Run it as a background command (it keeps running while the phone confirms and while the first
   history sync arrives).
3. Read the code from the NDJSON on stderr: the line `{"event":"pair_code","data":{"phone":"...","code":"ABCD-EFGH"},...}`.
   Without `--events` the same code is printed as `Pairing code for +<phone>: <code>`.
4. Give the user the code and these steps: WhatsApp on the phone → **Settings → Linked devices →
   Link a device → Link with phone number instead**, then type the code. Codes expire in a few
   minutes; if it expires, stop the command and start again for a new one.
5. Wait for the command to finish (it exits after `--idle-exit`, 30 s by default, once the first
   sync goes quiet). Then confirm: `wacli --read-only --json auth status` shows
   `authenticated: true` and the linked `phone`. Delete `$log`: it has the code.

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

Stop or remove (only when asked): `launchctl bootout gui/$(id -u)/sh.wacli.sync`, then delete the
plist.

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

## 4. Verify

```sh
wacli --read-only --json doctor            # authenticated: true, lock_held: true, fts_enabled
wacli --read-only --json chats list --limit 5
```

`fts_enabled: false` only makes search slower. Report what was set up: the binary path and
version, the linked number, whether the service is installed and where its log is.

## Undo (only when the user asks)

1. Stop the service (launchd `bootout` / `systemctl --user disable --now wacli-sync`).
2. `wacli auth logout` unlinks the device (it also disappears from the phone's Linked devices).
3. Deleting `~/.wacli` removes every stored message and the keys. Confirm twice; it cannot be undone.
