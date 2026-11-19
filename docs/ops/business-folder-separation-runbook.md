# Runbook — separate the business folders from the repository

Status: prepared 2026-07-10, not executed yet.

## Why

The numbered business folders are **gitignored on purpose** — business plan, contracts,
finances and CVs do not belong on GitHub. That is correct, and it means GitHub is *not*
their backup.

Until the repo moved out of `~/Documents`, iCloud was their backup. After the move to
`~/Projekte` they exist exactly once, on one disk:

| Folder | Files | Tracked in git |
|---|---:|---:|
| `01_STRATEGY` | 229 | 0 |
| `02_EMPLOYEE` | 13 | 0 |
| `03_LEGAL` | 13 | 0 |
| `04_MARKETING` | 66 | 0 |
| `06_App` | 1 | 0 |
| `07_SALES` | 32 | 0 |
| `Archiv` | 2 | 0 |
| **Total** | **356** | **0** (≈426 MB) |

`05_Landingpage` stays: 51 of its files **are** tracked, and `05_Landingpage/Online` is the
Netlify deploy root (`netlify.toml` → `base`).

These folders never belonged inside a git repository. Moving them out restores the iCloud
backup and stops them from being one `git add -A` away from a leak.

Why iCloud is safe for them but was not for the repo: the sync problems came from tens of
thousands of `node_modules` files. These 356 documents synced fine for years.

## Before you start

- [ ] **Backup first, move second.** iCloud is redundancy, not a backup. Confirm Time
      Machine (or equivalent) covers `~/Projekte` *and* `~/Documents`, or copy the folders
      to an external disk before touching anything.
- [ ] Quit anything holding the files (Word, Excel, Preview, Finder windows).
- [ ] Confirm nothing versioned would move — every count below must be `0`:

```bash
cd ~/Projekte/sur.plus
for d in 01_STRATEGY 02_EMPLOYEE 03_LEGAL 04_MARKETING 06_App 07_SALES Archiv; do
  printf '%-14s %s\n' "$d" "$(git ls-files "$d" | wc -l)"
done
```

Nothing in the code references these paths. The only mentions in tracked files are prose in
`README.md` and `docs/ops/repo-relocation-runbook.md` — verified 2026-07-10.

## Steps

### 1. Move

```bash
mkdir -p ~/Documents/sur.plus-Business
cd ~/Projekte/sur.plus
mv 01_STRATEGY 02_EMPLOYEE 03_LEGAL 04_MARKETING 07_SALES Archiv \
   ~/Documents/sur.plus-Business/
```

`06_App` holds a single README that duplicates the repo layout now documented in the root
`README.md`. Either move it along or delete it — it carries nothing unique.

### 2. Verify

```bash
cd ~/Projekte/sur.plus
git status --porcelain      # must be empty: nothing versioned moved
pnpm run ci                 # must stay green
ls ~/Documents/sur.plus-Business   # 6 entries
```

`git status` staying empty is the proof: git never knew these folders, so removing them
changes nothing it tracks.

### 3. Let iCloud finish

Watch the Finder sidebar until `sur.plus-Business` shows no upload arrows. Then verify on a
second device (phone: Files → iCloud Drive) that `03_LEGAL` is readable. Only then is the
backup real.

### 4. Update the pointers

- `README.md` — the sentence about the numbered folders living on disk.
- `docs/ops/repo-relocation-runbook.md` — same claim in its rollback section.
- `CLAUDE.md` — add the new path so the assistant knows where business context lives.
- **Cowork** — the business folder is now a *second* folder. Connect it when you want the
  assistant to read contracts or the business plan; leave it disconnected otherwise. That
  separation is a feature: code work no longer exposes legal documents.

## What stays in the repo

```
~/Projekte/sur.plus/
├── apps/ packages/ supabase/ tools/ docs/    code        → GitHub
├── 05_Landingpage/                           deploy root → GitHub (Online/)
├── CLAUDE.md, surplus-outbound.skill         local-only, small
└── .git/
```

`CLAUDE.md` and `surplus-outbound.skill` are untracked and therefore also unbacked by
GitHub. They are small, but they are the reason step 0 (a real backup of `~/Projekte`)
is not optional.

## Rollback

```bash
mv ~/Documents/sur.plus-Business/* ~/Projekte/sur.plus/
```

Nothing else to undo — no git state was touched.

## Afterwards

Keep the split: **code in `~/Projekte` (backup: GitHub + Time Machine), business documents
in iCloud (backup: iCloud + Time Machine).** Never put a git repository or `node_modules`
into the iCloud folder.
