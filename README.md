# 📦 Gudang Stok Barang

Aplikasi web untuk **manajemen stok gudang** dengan fitur login Google, CRUD produk, grafik stok per kategori, export data, pagination, infinite scroll, dan dark mode.  
Dibangun menggunakan **Firebase + Vanilla JS + Chart.js**.

---

## 📂 Struktur Folder
```bash
gudang-stok-barang/
│── index.html       # Halaman utama
│── styles.css       # Styling tampilan (light & dark mode)
│── app.js           # Logic aplikasi (Firebase, CRUD, Chart, Export, Auth)
│── README.md        # Dokumentasi
└── assets/          # Screenshot UI (untuk README)
    ├── preview-login.png
    ├── preview-dashboard.png
    ├── preview-chart.png
    └── preview-darkmode.png
```

---

## 🚀 Fitur Utama
- 🔑 **Login Google** (Firebase Authentication)  
- 🔒 **Role Admin** → hanya admin (`reyhanmuhamadrizki1@gmail.com`) yang bisa menambah/edit/hapus produk  
- 📦 **CRUD Produk** → tambah, edit, hapus, lihat daftar produk  
- 📑 **Pagination + Infinite Scroll** → load produk bertahap  
- 📊 **Grafik Stok per Kategori** (Chart.js)  
- 📤 **Export Data** → CSV & Excel  
- 🌗 **Dark Mode Toggle** (tersimpan di localStorage)  

---

## 🔧 Teknologi yang Digunakan
- **Frontend:** HTML, CSS, JavaScript (Vanilla)  
- **Backend:** Firebase Firestore + Firebase Authentication  
- **Chart:** Chart.js (visualisasi data stok)  

---

## 📜 Lisensi
MIT License © 2025  
