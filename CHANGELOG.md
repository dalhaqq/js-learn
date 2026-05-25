# Changelog

Semua perubahan penting pada proyek ini akan dicatat dalam file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/), dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [0.2.1] — 2025-05-26

### Ditingkatkan
- **Penjelasan konsep mendalam** — 18 deskripsi latihan ditulis ulang dengan tiga komponen: (a) APA itu konsepnya, (b) MENGAPA penting di dunia nyata, (c) BAGAIMANA kode memetakan ke konsep
- Dasar JavaScript (7): variabel sebagai kontainer, if/else sebagai percabangan logika, for sebagai anti-duplikasi, fungsi sebagai modularitas, string/array/objek dengan contoh dunia nyata (validasi, e-commerce, pencarian)
- Async & Promise (3): callback sebagai fungsi first-class + setTimeout non-blocking, Promise sebagai placeholder nilai masa depan dengan rantai .then(), async/await sebagai syntactic sugar
- DOM Manipulasi (3): DOM sebagai pohon HTML + selector, events sebagai sinyal browser, createElement/appendChild sebagai konten dinamis
- API & HTTP (2): fetch sebagai HTTP request + Promise chain + response.json(), error handling sebagai jenis network vs HTTP + response.ok
- Algoritma Dasar (3): array sebagai memori kontigu + O(1)/O(n), sort dengan semantik comparator, binary search sebagai divide-and-conquer O(log n)

## [0.2.0] — 2025-05-26

### Perluasan Konten
- 9 latihan baru: 26 latihan total (+53%) mencakup 5 topik
  - Dasar JavaScript: +4 (string, array, objek, template literal — total 8)
  - DOM Manipulasi: +2 (mengubah konten, mengubah gaya — total 5)
  - API & HTTP: +2 (POST request, async/await fetch — total 4)
  - Algoritma Dasar: +3 (map, filter-reduce, rekursi — total 7)
  - Async & Promise: tetap 4

### Peningkatan Kualitas
- Deskripsi latihan diperluas menjadi 300+ karakter untuk penjelasan konsep yang lebih mendalam
- 8 latihan `write` sekarang memiliki kerangka `starterCode` (deklarasi variabel, signature fungsi) untuk mengurangi kebingungan pemula
- 2 latihan `debug` diperbaiki: `async-await-003` dan `dom-events-002` kini memiliki 3 bug nyata (sebelumnya hanya 2)

## [0.1.1] — 2025-05-26

### Diperbaiki
- **Tombol Jalankan tidak berfungsi** — `CM.StateEffect` tidak diekspor oleh CodeMirrorBundle, menyebabkan TypeError yang menghentikan semua event listener. Fix: updateListener dipindahkan ke dalam array `extensions` constructor EditorView.
- **Latihan fill-blank** — webview mengirim nilai kosong sebagai array JSON, tapi `runVerification()` meneruskannya mentah ke Node.js. Fix: kode direkonstruksi dari `starterCode` dengan substitusi marker `___BLANK___` sebelum eksekusi.
- **`&lt;` di CodeMirror** — `_escapeHtml()` di `<script type="text/plain">` mengkorupsi `starterCode` (entitas HTML tidak di-decode oleh `textContent`). Fix: hapus `_escapeHtml()`, hanya guard terhadap `</script>`.
- **State bocor antar latihan** — Singleton ExercisePanel membuat `vscode.getState()` mengembalikan kode latihan sebelumnya. Fix: tracking `exerciseId` di state, hapus kode/blanks/choice jika ID berbeda.

### Ditambahkan
- Penyorotan sintaks **CodeMirror 6** di kedua panel latihan (ExercisePanel + DomExercisePanel)
- Section **output kode** (terminal-style) di bawah editor untuk menampilkan stdout
- `VerificationResult.output` — field baru untuk meneruskan output eksekusi ke webview

## [0.1.0] — 2025-05-26

### Rilis Perdana

Rilis awal JS Learn, ekstensi VS Code untuk belajar JavaScript interaktif dalam Bahasa Indonesia.

#### Latihan
- 17 latihan JavaScript berbahasa Indonesia dalam 5 topik
  - Dasar JavaScript (4): variabel, kondisi, perulangan, fungsi
  - Async & Promise (4): callback, Promise, async/await, konsep asinkron
  - DOM Manipulasi (3): selector, events, pembuatan elemen
  - API & HTTP (2): Fetch API, penanganan error
  - Algoritma Dasar (4): array, sorting, searching, objek

#### Jenis Latihan
- **write** — Menulis kode dari awal (8 latihan)
- **debug** — Memperbaiki kode yang salah (5 latihan)
- **fill-blank** — Melengkapi bagian kode yang kosong (2 latihan)
- **multiple-choice** — Memilih jawaban yang tepat (2 latihan)

#### Verifikasi
- Verifikasi hybrid: perbandingan output (`OutputVerifier`) + asersi pengujian (`TestVerifier`)
- Normalisasi output: penanganan whitespace, CRLF→LF, dan *blank-line collapse*
- Pesan kesalahan terperinci dalam Bahasa Indonesia
- `ErrorHandler` terpusat dengan routing otomatis berdasarkan jenis error (SyntaxError, TypeError, ReferenceError, RangeError, timeout)

#### Antarmuka
- Sidebar TreeView di activity bar VS Code dengan struktur topik → latihan
- Progresi kunci/buka: latihan berikutnya terkunci sampai latihan saat ini selesai
- Panel Webview kaya dengan integrasi tema VS Code
- Panel DOM khusus dengan eksekusi sandbox browser nyata
- Tombol aksi: Jalankan Kode, Lewati Latihan, Minta Petunjuk
- Antarmuka sepenuhnya dalam Bahasa Indonesia

#### Progres
- Pelacakan progres lokal dalam file JSON
- Status latihan: terkunci, selesai, dilewati
- Penanganan file progres rusak dengan reset otomatis

#### Arsitektur
- Antarmuka `ExerciseProvider` yang dapat diperluas untuk menambah sumber latihan baru
- Katalog i18n terpusat di `src/i18n/messages.ts`
- Verifier yang dapat ditukar (output vs test) per latihan
- CodeRunner berbasis child process Node.js
- Test suite Mocha dengan >50 pengujian (unit + integrasi + packaging)
