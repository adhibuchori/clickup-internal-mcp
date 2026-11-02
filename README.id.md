# clickup-internal-mcp

Baca workspace ClickUp Anda dari asisten AI memakai **token personal Anda sendiri**, ketika ClickUp
MCP resmi tidak tersedia untuk Anda. Bisa dipakai di client MCP apa pun yang menjalankan server lokal:
Claude Desktop, Claude Code, Cursor, Windsurf, VS Code (Copilot), Gemini CLI, Codex CLI, dan lainnya.
Dibuat terutama untuk **mengumpulkan requirement** dari ClickUp Docs dan task, dan cukup umum untuk
pencarian ClickUp apa pun.

[English](README.md)

- **Hanya membaca dari ClickUp, sejak desain.** Satu-satunya kode yang memanggil ClickUp hanya
  mengirim request GET. Tidak ada yang bisa membuat, mengubah, atau menghapus apa pun di ClickUp.
- **Cepat.** Yang Anda *track* disimpan lokal dengan indeks full-text: satu page dari cache terbaca
  dalam beberapa milidetik, pencarian atas 10.000 page sekitar 50 ms ([pengukuran](docs/benchmarks.md)).
- **Tenang.** Default-nya maksimal 8 request bersamaan dan 300 per menit, jauh di bawah limit
  ClickUp.
- **Data di disk seminimal mungkin.** Hanya yang Anda track yang disimpan. Sisanya dibaca langsung
  dan hanya disimpan di memori beberapa menit.
- **Gambar ditangani.** Mockup di dokumen di-download sekali. Asisten melihat tiap gambar sekali dan
  menyimpan deskripsinya, sehingga pembacaan berikutnya cukup teks.

## Setup

Kebutuhan: [Bun](https://bun.sh) 1.3+ (atau Node 22.18+), dan akun ClickUp.

1. **Buat token.** ClickUp → Settings → Apps → API tokens → **Create token**. Beri nama
   `clickup-mcp`, supaya Anda tahu token mana yang harus dicabut.
2. **Install dan konfigurasi.**

   ```bash
   bun install
   cp .env.example .env    # lalu isi token dan workspace id di .env
   ```

   Workspace id adalah angka tepat setelah host di URL ClickUp mana pun
   (`https://app.clickup.com/<workspace id>/...`). Jangan pernah paste token ke chat.

3. **Cek.** `bun run doctor` memastikan token, workspace, dan folder cache, tanpa mencetak token.
4. **Hubungkan client MCP Anda.** `bun run setup` mencetak snippet yang persis untuk Claude Desktop,
   Claude Code, Cursor, Windsurf, VS Code, Gemini CLI, dan Codex CLI (`--client <id>` untuk satu
   client). Lihat [docs/clients.md](docs/clients.md).

### Untuk Rekan Tim yang Tidak Menulis Kode

`bun run build` membuat executable satu file di `dist/` (macOS arm64/x64, Windows x64, Linux x64)
yang tidak butuh Bun maupun Node. Rekan menaruh executable di satu folder bersama file pengaturan
`clickup-internal-mcp.env` berisi **token miliknya sendiri**, menjalankan `<executable> doctor`, lalu
`<executable> setup --client <aplikasinya>` dan menempel snippet-nya. Langkah demi langkah (dalam
bahasa Inggris): [docs/clients.md](docs/clients.md#for-a-teammate-who-does-not-write-code). Token
tidak pernah dibagikan.

## Tools

| Tool | Fungsi |
| ---- | ------ |
| `browse` | Space → folder → list, dan docs di masing-masing. |
| `read_doc` | Outline doc, satu page, atau semua page, dalam Markdown. Gambar muncul sebagai referensi `img:` beserta catatannya; link Figma dan whiteboard didaftar. |
| `read_task` | Task lengkap: status, orang, tanggal, deskripsi, custom field, subtask, lampiran, komentar. |
| `list_tasks` | Task di list, folder, atau space, difilter status, assignee (`me`), tag, tanggal update dan due. |
| `search` | Pencarian full-text atas semua yang Anda track. API ClickUp tidak punya pencarian teks, jadi ini lokal. |
| `track` | Pilih apa yang disimpan di cache: tambah, hapus, lihat daftar, sync doc, list, folder, atau space. |
| `changes` | Apa yang berubah di konten yang di-track sejak terakhir dicek atau sejak tanggal tertentu: diff page dan event task. |
| `view_image` | Menampilkan satu gambar ke asisten (di client yang bisa menampilkan gambar dari tool). |
| `note_image` | Menyimpan deskripsi gambar dari asisten, dipakai ulang sampai gambarnya berubah. |

Semua tool menerima URL ClickUp (host `*.clickup.com` apa pun) dan referensi yang dicetak tool lain
(`task:86c1abcde`, `task:ABC-123`, `doc:…/page:…`, `list:…`). Detail: [docs/tools.md](docs/tools.md).

## Mengumpulkan Requirement, Langkah Demi Langkah

1. Paste URL doc: *"Baca doc ini dan daftarkan requirement-nya."* Asisten memanggil `read_doc`.
2. Kalau akan dibuka lagi: *"Track doc ini."* Page dan gambarnya di-cache dan bisa dicari.
3. Mockup: *"Deskripsikan gambar yang belum punya catatan."* Asisten membuka tiap gambar sekali dengan
   `view_image` dan menyimpan deskripsinya dengan `note_image` (layar, field, label, aksi, state,
   teks).
4. Minta strukturnya: user story, acceptance criteria, business rule, dependensi, dan **open
   question**, termasuk ketidaksesuaian antara teks dan mockup, masing-masing dengan referensinya.
5. Nanti: *"Apa yang berubah di requirement sejak minggu lalu?"* `changes` menampilkan diff page dan
   event task.

## Data dan Privasi

- **Di mana:** `~/Library/Application Support/clickup-internal-mcp` di macOS,
  `%LOCALAPPDATA%\clickup-internal-mcp` di Windows (bisa diubah dengan `CLICKUP_DATA_DIR`). Dibuat
  dengan izin akses hanya untuk pemilik. Enkripsi di disk mengandalkan FileVault atau BitLocker.
- **Apa:** hanya scope yang di-track (page, task, komentar, gambar, catatan) ditambah nama anggota.
  Revisi dan event task yang lebih tua dari `CLICKUP_CACHE_TTL_DAYS` (30) dihapus.
- **Menghapus:** `track` dengan `remove` menghapus satu scope; `bun run purge -- --yes` menghapus
  semuanya.
- **Dikirim ke mana:** hanya ke `api.clickup.com` dan host lampiran ClickUp. Tanpa telemetri. Yang
  dibaca asisten terkirim ke penyedia AI-nya sebagai bagian dari percakapan Anda, sama seperti hal lain
  yang Anda bagikan.
- **Redaksi:** token, key, dan password yang di-paste orang ke doc atau komentar disensor di setiap
  jawaban.
- **Mirror opsional:** `CLICKUP_MIRROR_DIR` juga menulis doc yang di-track sebagai file Markdown
  beserta gambarnya, untuk dibaca atau di-`git diff` di luar asisten.

## Konfigurasi

Semua pengaturan ada di `.env` (lihat [.env.example](.env.example)); environment mengalahkan file.

| Pengaturan | Default | Arti |
| ---------- | ------- | ---- |
| `CLICKUP_API_TOKEN` | wajib | Token personal Anda. |
| `CLICKUP_WORKSPACE_ID` | wajib | Angka setelah host di URL ClickUp. |
| `CLICKUP_DATA_DIR` | per OS, di atas | Lokasi cache. |
| `CLICKUP_MIRROR_DIR` | mati | Juga menulis doc yang di-track sebagai file Markdown. |
| `CLICKUP_CACHE_TTL_DAYS` | 30 | Umur saat revisi dan event lama dihapus. |
| `CLICKUP_MAX_CONCURRENCY` | 8 | Request bersamaan (1–16). |
| `CLICKUP_MAX_RPM` | 300 | Request per menit. |
| `CLICKUP_ASSET_HOSTS` | tidak ada | Akhiran host gambar tambahan, dipisah koma. |
| `CLICKUP_TIMEZONE` | sistem | Zona waktu untuk tanggal (due date adalah hari lokal). |
| `LOG_LEVEL` | info | `debug`, `info`, `warn`, atau `error` (stderr). |

## Batasan

- API publik ClickUp **tidak punya pencarian teks**: `search` hanya mencakup konten yang di-track.
- Task yang dihapus di ClickUp tetap ada di cache sampai scope-nya di-untrack.
- `read_task` menampilkan komentar yang dikembalikan ClickUp dalam satu request (yang terbaru).
- Whiteboard dan file Figma didaftar sebagai link, tidak dibaca.
- Aplikasi web (claude.ai di browser, ChatGPT, ClickUp Brain) butuh server remote; server ini
  berjalan lokal. Lihat [docs/clients.md](docs/clients.md#not-supported-yet-web-apps).
- Markdown doc berasal dari konversi ClickUp sendiri; sebagian embed tidak ikut terkonversi.

## Pengembangan

Lihat [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md). `bash scripts/check/gates.sh` menjalankan
format, lint, type-check, dead code, bentuk folder, secret, dan test suite dengan coverage 100%. Test
tidak pernah menyentuh jaringan: ClickUp diganti fake dengan path dan bentuk respons yang sama.
`bun run spike -- --doc <doc id>` mengecek bentuk respons API asli (hanya mencetak bentuk, tidak
pernah isi).
