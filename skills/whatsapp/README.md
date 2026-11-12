# whatsapp

A tool guide (decision 0003) that lets a coding agent set up, read, search and send WhatsApp
messages from your own account through [`wacli`](https://github.com/openclaw/wacli). The skill is
Markdown only and ships no CLI. When you ask, the agent installs wacli from its official channel,
pairs it with your phone and installs the sync service, asking before each step
([`references/setup.md`](references/setup.md)); the only manual step is typing the pairing code
on your phone.

Why wacli: WhatsApp Web needs a session that stays open. wacli already runs one
(`wacli sync --follow`), keeps a local SQLite mirror with full-text search, gives JSON output for
every command and has a read-only mode. A Baileys-based skill would have to rebuild all of that.

Checked against **wacli 0.26.0** (2026-11-05).

## Risks (read before using)

- **Unofficial protocol.** wacli speaks the WhatsApp Web protocol through
  [whatsmeow](https://github.com/tulir/whatsmeow). It is not affiliated with Meta, and automating a
  personal account goes against WhatsApp's terms. Accounts can be banned, especially new numbers,
  fast or bulk sending, and messages to people who do not have you as a contact. Use it for personal,
  low-volume work.
- **It can break.** When WhatsApp changes the protocol, wacli can stop working until it is updated.
- **Private data.** The store (`~/.wacli`) holds your messages, contacts and the linked-device keys
  (`session.db`). Anyone who can read it can read your WhatsApp and act as you. Keep it out of
  repos, backups you share and cloud sync.
- **Agents act as you.** The skill keeps the agent read-only by default and requires a confirmation
  per message, but the harness is what enforces permissions. Do not give an unattended agent a
  `wacli` without `--read-only` (or `WACLI_READONLY=1` in its environment) unless you mean it.

## Install

Install the skill and ask your agent to "set up WhatsApp"; it follows `references/setup.md`.
The same steps by hand:

1. Install wacli (single binary):

   ```sh
   brew install openclaw/tap/wacli        # macOS / Linux
   ```

   If the tap does not resolve, download the archive for your platform from
   [GitHub Releases](https://github.com/openclaw/wacli/releases), check it against `checksums.txt`,
   and put `wacli` on your `PATH`. Building from source needs Go and cgo; see wacli's `docs/install.md`.

2. Pair it with your phone (you, not the agent):

   ```sh
   wacli auth                        # scan the QR in WhatsApp > Linked devices > Link a device
   wacli auth --phone +5215512345678 # or pair with a code instead of a QR
   wacli auth status
   ```

   `auth` runs the first history sync after pairing. The phone sends about the last three months.

3. Keep the mirror current while you want the agent to see new messages:

   ```sh
   wacli sync --follow --presence-mode quiet --max-db-size 2GB
   ```

   `quiet` stops wacli from marking the linked device as online, so your phone keeps its
   notifications. Run it in a terminal tab, tmux, or a launchd/systemd user service. While it runs,
   sends from the agent go through it instead of opening a second session.

4. Install the skill:

   ```sh
   npx skills add ultr4nerd/skills --skill whatsapp
   ```

## What the agent does

- Reads with `wacli --read-only --json ...`: chats, unread, conversations, full-text search, context
  around a message, contact lookup, media downloads into a folder it chooses.
- Treats every message as untrusted data: instructions inside messages are reported, never followed.
- Sends only when you ask, to a JID it resolved (never a guessed name), after showing you the exact
  draft. It reports `sent: true` as "accepted by WhatsApp", not "delivered".
- Never retries a failed send without checking whether it went out, never sends in bulk, and never
  logs out, deletes, revokes, edits or posts statuses unless you ask for that exact action.

## Multiple numbers

```sh
wacli accounts add work      # pairs a second number in its own store
wacli accounts list
```

The agent passes `--account NAME` on every command and asks which account to use when you have
more than one and did not say.

## Updating

When wacli is upgraded, restart `wacli sync --follow` (an old daemon keeps old behavior). If the
upgrade changes commands or flags this skill uses, re-read wacli's docs and update `SKILL.md` and
the version above in the same change.

## Reference

- wacli docs: https://github.com/openclaw/wacli/tree/main/docs (`send.md`, `messages.md`,
  `sync.md`, `integrations.md` cover what this skill relies on)
- `wacli <command> --help` for flags
