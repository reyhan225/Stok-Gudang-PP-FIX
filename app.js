// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCk_9zFTS5CRgmIcuswG_gvpLVWx2PcF58",
  authDomain: "stok-gudang-divisi-pp.firebaseapp.com",
  projectId: "stok-gudang-divisi-pp",
  storageBucket: "stok-gudang-divisi-pp.firebasestorage.app",
  messagingSenderId: "838303987838",
  appId: "1:838303987838:web:e16829f449925469ae002f",
  measurementId: "G-QYH5LD18NT"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// DOM
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const addProductForm = document.getElementById("productForm");
const productTableBody = document.getElementById("productList");
const darkModeToggle = document.getElementById("darkModeToggle");
const exportCSV = document.getElementById("exportCSV");
const exportExcel = document.getElementById("exportExcel");
const productCategorySelect = document.getElementById("productCategory");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const newCategoryName = document.getElementById("newCategoryName");
const filterCategory = document.getElementById("filterCategory");
const searchInput = document.getElementById("searchInput");
const historyList = document.getElementById("historyList");
const historyQuickRange = document.getElementById("historyQuickRange");
const historyStart = document.getElementById("historyStart");
const historyEnd = document.getElementById("historyEnd");
const applyHistoryFilter = document.getElementById("applyHistoryFilter");
const historySearch = document.getElementById("historySearch");
const chartCanvas = document.getElementById("stockChart");

// State
let isAdmin = false;
let currentUser = null;
let products = [];          // semua produk (realtime)
let filteredProducts = [];  // hasil filter + search
let categories = [];        // kategori (realtime)
let chart;                  // Chart.js instance
let unsubProducts = null;
let unsubHistory = null;
let historyRows = [];       // cache riwayat untuk pencarian text

// ===== Auth =====
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Login gagal: " + err.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (user) {
    userEmail.textContent = user.email;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    // Admin check (sesuaikan email admin)
    isAdmin = user.email === "reyhanmuhamadrizki1@gmail.com";
    document.getElementById("adminSection").style.display = isAdmin ? "block" : "none";

    // Subscribe realtime data
    subscribeCategories();
    subscribeProducts();
    applyHistoryQuickRange(); // set default (7 hari)
  } else {
    userEmail.textContent = "Belum login";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    isAdmin = false;
    document.getElementById("adminSection").style.display = "none";

    // clear UI
    products = [];
    filteredProducts = [];
    categories = [];
    renderProductsTable();
    renderChart();

    // Unsubscribe listeners
    if (unsubProducts) { unsubProducts(); unsubProducts = null; }
    if (unsubHistory) { unsubHistory(); unsubHistory = null; }
  }
});

// ===== Kategori (Firestore collection: "categories") =====
function subscribeCategories() {
  const qCat = query(collection(db, "categories"), orderBy("name"));
  onSnapshot(qCat, (snap) => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategorySelects();
  });
}

function renderCategorySelects() {
  // Reset & isi select kategori di form tambah
  productCategorySelect.innerHTML = `<option value="" disabled selected>Pilih Kategori</option>`;
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    productCategorySelect.appendChild(opt);
  });
  // Reset & isi select filter kategori
  const currVal = filterCategory.value;
  filterCategory.innerHTML = `<option value="">Semua Kategori</option>`;
  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    filterCategory.appendChild(opt);
  });
  // keep existing selection when possible
  if ([...filterCategory.options].some(o => o.value === currVal)) {
    filterCategory.value = currVal;
  }
}

addCategoryBtn.addEventListener("click", async () => {
  if (!isAdmin) return alert("Hanya admin yang dapat menambah kategori!");
  const name = (newCategoryName.value || "").trim();
  if (!name) return alert("Nama kategori tidak boleh kosong.");
  // Cek jika sudah ada
  const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    alert("Kategori sudah ada.");
    return;
  }
  try {
    await addDoc(collection(db, "categories"), { name });
    newCategoryName.value = "";
  } catch (e) {
    alert("Gagal menambah kategori: " + e.message);
  }
});

// ===== Produk (Firestore collection: "products") realtime =====
function subscribeProducts() {
  if (unsubProducts) { unsubProducts(); }
  const qProd = query(collection(db, "products"), orderBy("name"));
  unsubProducts = onSnapshot(qProd, (snap) => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyProductFilters(); // refresh table + chart
  });
}

// Tambah produk
if (addProductForm) {
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert("Hanya admin yang bisa menambah produk!");

    const name = e.target.productName.value.trim();
    const category = e.target.productCategory.value;
    const stock = parseInt(e.target.productQty.value, 10);

    if (!name || !category || isNaN(stock)) {
      alert("Lengkapi nama, kategori, dan jumlah.");
      return;
    }

    try {
      await addDoc(collection(db, "products"), {
        name,
        category,
        stock,
        createdAt: serverTimestamp(),
        createdBy: currentUser ? (currentUser.displayName || currentUser.email) : "unknown"
      });

      await logHistory({
        action: "create",
        name,
        change: `+${stock}`,
        by: currentUser ? (currentUser.displayName || currentUser.email) : "unknown"
      });

      e.target.reset();
      alert("Produk berhasil ditambahkan!");
    } catch (err) {
      alert("Gagal menambah produk: " + err.message);
    }
  });
}

// Edit produk
window.editProduct = async (id, currentName, currentStock) => {
  if (!isAdmin) return;
  const newStockStr = prompt(`Masukkan stok baru untuk "${currentName}" (stok saat ini: ${currentStock})`);
  if (newStockStr === null) return;
  const newStock = parseInt(newStockStr, 10);
  if (isNaN(newStock)) {
    alert("Input stok tidak valid.");
    return;
  }
  try {
    await updateDoc(doc(db, "products", id), { stock: newStock });
    const delta = newStock - (parseInt(currentStock, 10) || 0);
    await logHistory({
      action: "update",
      name: currentName,
      change: delta > 0 ? `+${delta}` : `${delta}`,
      by: currentUser ? (currentUser.displayName || currentUser.email) : "unknown"
    });
    alert("Produk berhasil diperbarui!");
  } catch (err) {
    alert("Gagal update: " + err.message);
  }
};

// Hapus produk
window.deleteProduct = async (id, currentName, currentStock) => {
  if (!isAdmin) return;
  if (!confirm(`Yakin hapus produk "${currentName}"?`)) return;
  try {
    await deleteDoc(doc(db, "products", id));
    await logHistory({
      action: "delete",
      name: currentName,
      change: `-${currentStock}`,
      by: currentUser ? (currentUser.displayName || currentUser.email) : "unknown"
    });
    alert("Produk berhasil dihapus!");
  } catch (err) {
    alert("Gagal hapus: " + err.message);
  }
};

// Render tabel produk
function renderProductsTable() {
  productTableBody.innerHTML = "";
  filteredProducts.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${p.stock ?? 0}</td>
      <td>${escapeHtml(p.category || "-")}</td>
      <td>${escapeHtml(p.createdBy || "-")}</td>
      <td class="actions">
        ${
          isAdmin
            ? `
              <button class="icon-btn" title="Edit" onclick="editProduct('${p.id}', '${escapeAttr(p.name)}', '${p.stock ?? 0}')">✏️</button>
              <button class="icon-btn danger" title="Hapus" onclick="deleteProduct('${p.id}', '${escapeAttr(p.name)}', '${p.stock ?? 0}')">🗑️</button>
            `
            : `-`
        }
      </td>
    `;
    productTableBody.appendChild(tr);
  });
}

// ===== Filter & Search Produk =====
function applyProductFilters() {
  const q = (searchInput.value || "").toLowerCase();
  const cat = filterCategory.value || "";

  filteredProducts = products.filter(p => {
    const matchName = (p.name || "").toLowerCase().includes(q);
    const matchCat = cat ? (p.category === cat) : true;
    return matchName && matchCat;
  });

  renderProductsTable();
  renderChart();
}

searchInput.addEventListener("input", applyProductFilters);
filterCategory.addEventListener("change", applyProductFilters);

// ===== Chart =====
function renderChart() {
  const grouped = {};
  filteredProducts.forEach(p => {
    const key = p.category || "Tanpa Kategori";
    grouped[key] = (grouped[key] || 0) + (p.stock || 0);
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  if (chart) { chart.destroy(); }
  chart = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Stok per Kategori",
          data
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ===== Riwayat (Firestore collection: "history") =====
async function logHistory({ action, name, change, by }) {
  try {
    await addDoc(collection(db, "history"), {
      action,            // create | update | delete
      name,
      change,            // misal: +10, -3
      by,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Gagal menulis riwayat:", e);
  }
}

function subscribeHistoryByRange(startDate, endDate) {
  // Unsub lama
  if (unsubHistory) { unsubHistory(); unsubHistory = null; }
  // Build query waktu
  let qHist;
  if (startDate && endDate) {
    qHist = query(
      collection(db, "history"),
      where("createdAt", ">=", startDate),
      where("createdAt", "<=", endDate),
      orderBy("createdAt", "desc")
    );
  } else {
    qHist = query(collection(db, "history"), orderBy("createdAt", "desc"));
  }

  unsubHistory = onSnapshot(qHist, (snap) => {
    historyRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistoryTable(); // akan terkena filter teks juga
  });
}

function renderHistoryTable() {
  const term = (historySearch.value || "").toLowerCase();
  historyList.innerHTML = "";

  historyRows
    .filter(r => {
      const text = `${r.action || ""} ${r.name || ""} ${r.change || ""} ${r.by || ""}`.toLowerCase();
      return text.includes(term);
    })
    .forEach(r => {
      const tr = document.createElement("tr");
      const timeStr = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : "-";
      tr.innerHTML = `
        <td>${escapeHtml(timeStr)}</td>
        <td>${escapeHtml(r.action || "-")}</td>
        <td>${escapeHtml(r.name || "-")}</td>
        <td>${escapeHtml(r.change || "-")}</td>
        <td>${escapeHtml(r.by || "-")}</td>
      `;
      historyList.appendChild(tr);
    });
}

// Quick range handler
function applyHistoryQuickRange() {
  const val = historyQuickRange.value;
  if (val === "custom") {
    historyStart.disabled = false;
    historyEnd.disabled = false;
    // Jangan subscribe dulu sampai user klik "Terapkan"
    return;
  }
  historyStart.disabled = true;
  historyEnd.disabled = true;
  const now = new Date();
  const end = now;
  const days = parseInt(val, 10) || 7;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  subscribeHistoryByRange(start, end);
}

historyQuickRange.addEventListener("change", applyHistoryQuickRange);

applyHistoryFilter.addEventListener("click", () => {
  if (historyQuickRange.value !== "custom") {
    applyHistoryQuickRange();
    return;
  }
  const s = historyStart.value ? new Date(historyStart.value + "T00:00:00") : null;
  const e = historyEnd.value ? new Date(historyEnd.value + "T23:59:59") : null;
  if (!s || !e) {
    alert("Pilih tanggal mulai & akhir.");
    return;
  }
  subscribeHistoryByRange(s, e);
});

historySearch.addEventListener("input", renderHistoryTable);

// ===== Export =====
exportCSV.addEventListener("click", () => {
  const header = ["Name", "Category", "Stock", "Created By"];
  const rows = filteredProducts.map(p => [p.name, p.category, p.stock, p.createdBy || ""]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), "products.csv");
});

exportExcel.addEventListener("click", () => {
  // XLS sederhana via CSV (bisa dibuka Excel)
  const header = ["Name", "Category", "Stock", "Created By"];
  const rows = filteredProducts.map(p => [p.name, p.category, p.stock, p.createdBy || ""]);
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "application/vnd.ms-excel" }), "products.xls");
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = (value ?? "").toString();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ===== Dark Mode =====
darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}

// ===== Helpers =====
function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
