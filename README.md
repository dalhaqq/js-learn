<!-- English summary: JS Learn is a VS Code extension that teaches practical JavaScript through interactive exercises directly inside the editor. It covers 17 exercises across 5 topics, from basic syntax to async programming and DOM manipulation. Built for CS graduates and career-switchers who need hands-on practice without leaving their IDE. -->

# JS Learn

Platform belajar JavaScript interaktif untuk pemula &mdash; langsung di dalam VS Code.

## Deskripsi

JS Learn adalah ekstensi VS Code yang dirancang untuk membantu lulusan ilmu komputer dan *career-switcher* membangun keterampilan JavaScript praktis. Tidak seperti tutorial pasif atau platform *browser-based*, JS Learn membawa latihan langsung ke editor kode Anda. Anda menulis kode sungguhan, mengeksekusinya di terminal bawaan, dan melihat hasilnya dalam hitungan detik, semuanya tanpa meninggalkan VS Code.

Semua antarmuka, petunjuk, dan pesan kesalahan ditampilkan dalam Bahasa Indonesia. Materi kurikulum mencakup fondasi penting: variabel dan fungsi, pemrograman asinkron, manipulasi DOM, komunikasi API, dan algoritma dasar.

## Fitur

- **Sidebar TreeView** &mdash; Telusuri kurikulum langsung dari activity bar VS Code. Topik dan latihan ditampilkan dalam struktur pohon yang rapi.
- **Empat jenis latihan** &mdash; `write` (menulis kode dari awal), `debug` (memperbaiki kode yang salah), `fill-blank` (melengkapi bagian kode yang kosong), dan `multiple-choice` (memilih jawaban yang tepat).
- **Verifikasi hybrid** &mdash; Latihan diverifikasi dengan kombinasi perbandingan output (`output-verifier`) dan asersi pengujian (`test-verifier`), memberikan umpan balik yang akurat dan terperinci.
- **Antarmuka Bahasa Indonesia** &mdash; Semua label, tombol, pesan sukses/gagal, dan teks petunjuk menggunakan Bahasa Indonesia.
- **Pelacakan progres lokal** &mdash; Status setiap latihan (terkunci, selesai, dilewati) disimpan dalam file JSON di mesin Anda, tidak memerlukan akun atau koneksi internet.

## Persyaratan

- **Node.js** versi 18 atau lebih baru
- **VS Code** versi 1.85 atau lebih baru

## Cara Install

Ekstensi ini saat ini didistribusikan sebagai file `.vsix` lokal, bukan melalui VS Code Marketplace.

```bash
code --install-extension js-learn-0.1.0.vsix
```

Setelah instalasi, muat ulang VS Code. Ikon JS Learn akan muncul di activity bar (sebelah kiri).

## Cara Pakai

1. **Buka sidebar JS Learn** &mdash; Klik ikon JS Learn di activity bar. Panel samping akan menampilkan daftar topik kurikulum.

2. **Pilih topik** &mdash; Klik topik seperti "Dasar JavaScript" untuk melihat daftar latihan di dalamnya. Latihan yang terkunci ditandai dengan ikon gembok.

3. **Buka latihan** &mdash; Klik latihan untuk membuka panel *webview* yang berisi instruksi, *template* kode (untuk jenis `write`), atau kode yang perlu diperbaiki (untuk jenis `debug`).

4. **Tulis atau perbaiki kode** &mdash; Ketik kode Anda di editor yang tersedia di dalam panel. Untuk latihan `fill-blank`, isi bagian yang ditandai dengan `______`.

5. **Jalankan kode** &mdash; Klik tombol <kbd>▶ Jalankan Kode</kbd>. Ekstensi akan mengeksekusi kode Anda di terminal Node.js dan membandingkan hasilnya dengan jawaban yang diharapkan.

6. **Lihat hasil** &mdash; Centang hijau (✓) berarti jawaban Anda benar. Silang merah (✗) berarti output tidak sesuai. Pesan kesalahan akan menjelaskan apa yang perlu diperbaiki.

7. **Lanjutkan ke latihan berikutnya** &mdash; Setelah menyelesaikan satu latihan, latihan berikutnya akan terbuka secara otomatis.

## Struktur Kurikulum

| Topik | Jumlah Latihan | Cakupan Materi |
|-------|:---:|-------|
| Dasar JavaScript | 4 | Variabel, kondisi, perulangan, fungsi |
| Async & Promise | 4 | Callback, Promise, async/await, konsep asinkron |
| DOM Manipulasi | 3 | Selector, events, pembuatan elemen |
| API & HTTP | 2 | Fetch API, penanganan error |
| Algoritma Dasar | 4 | Array, sorting, searching, objek |

Total: **17 latihan** dalam 5 topik, mencakup 4 jenis latihan (`write`, `debug`, `fill-blank`, `multiple-choice`).

## Untuk Pengembang

### Menambahkan latihan baru

Latihan didefinisikan sebagai file JSON di direktori `src/exercises/`. Untuk menambahkan latihan:

1. Buat file JSON baru dengan format penamaan `{topik}-{nama}-{nomor}.json`, contoh: `basics-arrays-005.json`.
2. Isi dengan struktur latihan (lihat latihan yang sudah ada sebagai referensi):

```json
{
  "id": "basics-arrays-005",
  "type": "write",
  "title": "Judul Latihan",
  "description": "Instruksi dalam Bahasa Indonesia",
  "difficulty": "mudah",
  "template": "// Kode awal\n",
  "solution": "// Kode jawaban\n",
  "expected": "output yang diharapkan"
}
```

3. Daftarkan ID latihan ke `GROUPS` di `src/exercises/groups.ts` dalam grup topik yang sesuai.
4. Jalankan `npm run compile` untuk membangun ulang ekstensi.

### Struktur direktori

```
js-learn/
├── src/
│   ├── exercises/         # File JSON latihan + groups.ts
│   ├── webview/           # Panel ExercisePanel dan DomExercisePanel
│   ├── verifiers/         # OutputVerifier dan TestVerifier
│   ├── terminal/          # CodeRunner (eksekusi Node.js)
│   ├── providers/         # TreeDataProvider untuk sidebar
│   ├── storage/           # ProgressStore (JSON lokal)
│   ├── i18n/              # Katalog pesan Bahasa Indonesia
│   ├── errors/            # ErrorHandler (routing error → pesan)
│   ├── types/             # Definisi tipe TypeScript
│   └── test/              # Suite pengujian Mocha
├── media/                 # Ikon dan aset statis
├── out/                   # Hasil kompilasi TypeScript
└── package.json           # Metadata ekstensi dan kontribusi VS Code
```

### Skrip npm

| Skrip | Deskripsi |
|-------|-------|
| `npm run compile` | Kompilasi TypeScript dan salin file latihan ke `out/` |
| `npm run watch` | Kompilasi dalam mode pantau (*watch mode*) |
| `npm run lint` | Jalankan ESLint pada kode sumber |
| `npm test` | Jalankan *test suite* Mocha |
| `npm run package` | Buat file `.vsix` menggunakan `vsce` |

### Arsitektur latihan

JS Learn menggunakan antarmuka `ExerciseProvider` yang memungkinkan penambahan *provider* latihan baru tanpa mengubah kode inti. Setiap provider bertanggung jawab untuk memuat data latihan, sedangkan verifikasi ditangani oleh `OutputVerifier` (perbandingan output) atau `TestVerifier` (asersi pengujian di *child process*).
