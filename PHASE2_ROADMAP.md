# JS Learn — Phase 2 Roadmap

Fitur-fitur berikut sengaja ditunda dari rilis v0.1.0. Setiap fitur telah memiliki fondasi arsitektur yang mendukung — implementasi penuh direncanakan untuk rilis mendatang.

## Fitur yang Ditunda

### 1. AI-Powered Exercise Generation

**Deskripsi:** Menggunakan LLM API untuk menghasilkan latihan JavaScript secara otomatis berdasarkan topik dan tingkat kesulitan yang dipilih pengguna.

**Fondasi:** Antarmuka `ExerciseProvider` di `src/types/` sudah dirancang secara *decoupled* — provider latihan baru dapat di-*register* tanpa mengubah kode inti TreeView atau panel. Provider AI akan menjadi implementasi ketiga (setelah `FileExerciseProvider` dan provider internal).

**Cakupan kerja:**
- Integrasi dengan LLM API (OpenAI, Anthropic, atau lokal via Ollama)
- Prompt engineering untuk menghasilkan latihan dalam Bahasa Indonesia
- Validasi otomatis: memastikan kode solusi yang dihasilkan LLM benar-benar berjalan dan menghasilkan output yang diharapkan
- UI untuk memilih topik + tingkat kesulitan sebelum generasi
- Caching hasil generasi agar latihan yang sama tidak perlu di-generate ulang

### 2. Gamification

**Deskripsi:** Menambahkan elemen permainan untuk meningkatkan motivasi dan retensi pembelajar.

**Cakupan kerja:**
- **Badge:** Lencana pencapaian untuk milestone tertentu (menyelesaikan 5 latihan, menyelesaikan semua latihan dalam satu topik, *streak* harian)
- **Streaks:** Penghitung hari berturut-turut menyelesaikan minimal satu latihan
- **Points:** Sistem poin berdasarkan tingkat kesulitan latihan (mudah=10, sedang=25, sulit=50)
- **Leaderboard opsional:** Papan peringkat lokal atau antar pengguna dalam organisasi yang sama

### 3. Adaptive Difficulty

**Deskripsi:** Tingkat kesulitan latihan menyesuaikan secara dinamis berdasarkan performa pembelajar.

**Fondasi:** Data `difficulty` sudah ada di setiap file latihan (`"mudah"`, `"sedang"`, `"sulit"`). `ProgressStore` sudah melacak status setiap latihan (selesai/dilewati/gagal) — data ini dapat digunakan sebagai sinyal performa.

**Cakupan kerja:**
- Algoritma pemeringkatan performa: menganalisis rasio keberhasilan, jumlah percobaan, dan waktu penyelesaian
- Pool latihan tambahan per topik dengan berbagai tingkat kesulitan (perlu konten baru)
- Rekomendasi otomatis: menyarankan latihan yang lebih sulit jika performa tinggi, atau latihan penguatan jika performa rendah
- Opsi *override* manual agar pengguna tetap bisa memilih latihan sendiri

### 4. Custom Exercise Authoring UI

**Deskripsi:** Editor berbasis web untuk pengajar yang ingin membuat latihan kustom tanpa mengedit file JSON secara manual.

**Cakupan kerja:**
- Web UI untuk membuat dan mengedit latihan (judul, deskripsi, template, solusi, expected output, tingkat kesulitan)
- Pratinjau langsung: eksekusi kode solusi di browser untuk memvalidasi output
- Ekspor latihan sebagai file JSON yang kompatibel dengan struktur `src/exercises/`
- Impor latihan dari file atau URL
- *Syntax highlighting* dan *autocomplete* di editor kode

### 5. Cloud Sync

**Deskripsi:** Opsi sinkronisasi progres latihan ke cloud agar pembelajar dapat melanjutkan di perangkat lain.

**Cakupan kerja:**
- Backend penyimpanan (Firebase, Supabase, atau solusi self-hosted)
- Autentikasi opsional (email/password atau OAuth)
- Konflik resolusi: strategi *last-write-wins* dengan timestamp
- Enkripsi data progres sebelum dikirim ke server
- UI untuk mengaktifkan/menonaktifkan sinkronisasi cloud

### 6. Multi-Language Support

**Deskripsi:** Menambahkan dukungan bahasa selain Bahasa Indonesia.

**Fondasi:** Modul `src/i18n/messages.ts` sudah memusatkan semua string antarmuka dalam satu katalog. Menambahkan bahasa baru berarti membuat file katalog tambahan (contoh: `messages.en.ts`) dan mekanisme *switching*.

**Cakupan kerja:**
- Katalog Bahasa Inggris (`messages.en.ts`)
- Katalog Bahasa Jepang (`messages.ja.ts`)
- Deteksi bahasa otomatis berdasarkan locale VS Code
- Pengalih bahasa manual di panel pengaturan

### 7. More Exercise Topics

**Deskripsi:** Memperluas kurikulum ke topik JavaScript dan ekosistem yang lebih luas.

**Cakupan kerja:**
- **TypeScript:** Tipe dasar, interface, generics, utility types
- **Testing:** Unit test dengan framework populer, mocking, TDD
- **Node.js APIs:** File system, streams, HTTP server, child processes
- **Modern JS:** ES modules, destructuring, spread/rest, optional chaining, nullish coalescing
- **Web APIs:** LocalStorage, Fetch API lanjutan, Web Workers, Service Workers

---

## Prioritas yang Disarankan

| Prioritas | Fitur | Alasan |
|:---:|---|---|
| 1 | More Exercise Topics | Memperluas nilai langsung untuk pembelajar |
| 2 | AI-Powered Generation | Memanfaatkan fondasi `ExerciseProvider` yang sudah ada |
| 3 | Gamification | Meningkatkan retensi pengguna |
| 4 | Adaptive Difficulty | Bergantung pada pool latihan yang lebih besar (#1) |
| 5 | Custom Authoring UI | Membuka kontribusi dari pengajar |
| 6 | Cloud Sync | Infrastruktur eksternal diperlukan |
| 7 | Multi-Language | Nilai terbatas sampai basis pengguna bertumbuh |
