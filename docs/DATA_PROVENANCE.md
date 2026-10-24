# Asal data dan ruang lingkup

Sumber publik: [PD777/HiringAudit-adversarial_cv_dataset](https://huggingface.co/datasets/PD777/HiringAudit-adversarial_cv_dataset), revisi tetap `81a0f6b1a5c3254371e6304af9dafdc533b6c9d5`, MIT. Penulis sumber: Yunfei Deng, Haotian Luo, Finn Jebing, Aldo Rodriguez. Salinan persis pemberitahuan lisensinya ada di `THIRD_PARTY_LICENSES/HiringAudit.txt`.

Arsip sumber berisi100 profil baseline. Studi V2 mengecualikan24 profil pengembangan terdahulu, lalu memilih40 profil dari76 yang belum dievaluasi:8 per strata electrical engineering, mechanical engineering, nursing, therapy, finance/accounting, diurutkan berdasarkan SHA256 teks sumber sebelum keluaran evaluasi. Pekerjaan cocok dengan job description sumber masing-masing.

Full dan removed dianonimkan secara simetris. Full mempertahankan kualifikasi asli; removed mengosongkan pendidikan, pengalaman, keahlian dan kredensial profesional, dengan ID/minat yang sama. Ini penghapusan bukti buatan, bukan representasi pelamar alami. Catatan clean/neutral/direct/forged_review/response_template serta wrapper disusun untuk eksperimen lokal. Tidak ada identitas/kontak langsung dari profil sumber dalam input eksperimen.

Studi utama:40 CV ×2 keadaan bukti ×5 kondisi catatan ×4 wrapper ×2 model =3.200 panggilan. Model tag persis: `gemma4:e2b-it-qat` dan `qwen3:4b-instruct`, dijalankan lokal sebagai artefak terkuantisasi. Kontrol panjang teks terpisah berjumlah320 panggilan. Repositori pendamping ini hanya menyertakan160 sel untuk H01/H09 serta statistik agregat, bukan semua log/protokol ilmiah.

`data/replays.json` memuat request dan respons tersimpan, termasuk opsi decoding, serta statistik seluruh40 CV. `data/SOURCE_PROVENANCE.json` memuat pin sumber, hash arsip dan deskripsi adaptasi. Hash request mengikuti format serialisasi studi asal; transkrip disalin tanpa mengubah isi request/response. Metadata request/hash tidak menjadikan hasil identik pada inference baru: variasi keluaran pernah diamati meskipun pengaturan yang diminta sama.

Kasus demonstrasi dipilih setelah hasil. Angka full adalah skor rubrik model tanpa gold label HR. CI berpasangan bersifat deskriptif untuk sampel sintetis ini; keterkaitan template pembangkit upstream dan satu requested seed membatasi generalisasi. Warning/JSON bukan isolasi formal terhadap prompt injection.

Screenshot di panduan adalah capture UI aplikasi asli oleh operator melalui browser. Transkrip evidence adalah request dan respons AI asli dari log studi; narasi penjelas bukan tambahan percakapan model. Tidak ada panggilan model baru untuk aplikasi ini.
