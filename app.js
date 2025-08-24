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
  limit,
  startAfter
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

// Elemen DOM
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const addProductForm = document.getElementById("productForm"); // ✅ diperbaiki
const productTable = document.getElementById("productList");   // ✅ diperbaiki
const chartCanvas = document.getElementById("stockChart");
const darkModeToggle = document.getElementById("darkModeToggle");
const exportCSV = document.getElementById("exportCSV");
const exportExcel = document.getElementById("exportExcel");

// State
let lastVisible = null;
let isAdmin = false;
let productData = [];
let chart;

// 🔑 Login Google
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Login gagal: " + err.message);
  }
});

// 🔒 Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// 👤 Cek user login
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userEmail.textContent = user.email;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    // Hanya admin yang bisa tambah/edit/hapus
    isAdmin = user.email === "reyhanmuhamadrizki1@gmail.com";
    document.getElementById("adminSection").style.display = isAdmin ? "block" : "none"; // ✅ diperbaiki

    loadProducts(true);
  } else {
    userEmail.textContent = "Belum login";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    productTable.innerHTML = "";
  }
});

// 📦 Tambah Produk
if (addProductForm) {
  addProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert("Hanya admin yang bisa menambah produk!");

    const name = e.target.productName.value;
    const category = e.target.productCategory.value;
    const stock = parseInt(e.target.productQty.value); // ✅ diperbaiki

    try {
      await addDoc(collection(db, "products"), { name, category, stock });
      e.target.reset();
      alert("Produk berhasil ditambahkan!");
      loadProducts(true);
    } catch (err) {
      alert("Gagal menambah produk: " + err.message);
    }
  });
}

// 📑 Load Produk (Pagination + Infinite Scroll)
async function loadProducts(reset = false) {
  let q;
  if (reset) {
    q = query(collection(db, "products"), orderBy("name"), limit(5));
    productData = [];
    productTable.innerHTML = "";
    lastVisible = null;
  } else {
    if (!lastVisible) return;
    q = query(
      collection(db, "products"),
      orderBy("name"),
      startAfter(lastVisible),
      limit(5)
    );
  }

  const snapshot = await getDocs(q);
  if (snapshot.docs.length === 0) return;

  lastVisible = snapshot.docs[snapshot.docs.length - 1];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    productData.push({ id: docSnap.id, ...data });
    renderRow(docSnap.id, data);
  });

  renderChart();
}

// 📝 Render Row
function renderRow(id, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${data.name}</td>
    <td>${data.stock}</td>      <!-- ✅ urutan benar -->
    <td>${data.category}</td>
    ${
      isAdmin
        ? `<td>
          <button onclick="editProduct('${id}')">✏️</button>
          <button onclick="deleteProduct('${id}')">🗑️</button>
        </td>`
        : "<td>-</td>"
    }
  `;
  productTable.appendChild(tr);
}

// ✏️ Edit Produk
window.editProduct = async (id) => {
  if (!isAdmin) return;
  const newStock = prompt("Masukkan stok baru:");
  if (!newStock) return;
  try {
    await updateDoc(doc(db, "products", id), { stock: parseInt(newStock) });
    alert("Produk berhasil diperbarui!");
    loadProducts(true);
  } catch (err) {
    alert("Gagal update: " + err.message);
  }
};

// 🗑️ Hapus Produk
window.deleteProduct = async (id) => {
  if (!isAdmin) return;
  if (!confirm("Yakin hapus produk ini?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    alert("Produk berhasil dihapus!");
    loadProducts(true);
  } catch (err) {
    alert("Gagal hapus: " + err.message);
  }
};

// 📊 Grafik stok per kategori
function renderChart() {
  const grouped = {};
  productData.forEach((p) => {
    grouped[p.category] = (grouped[p.category] || 0) + p.stock;
  });

  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  if (chart) chart.destroy();
  chart = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Stok per Kategori",
          data,
          backgroundColor: "rgba(54, 162, 235, 0.6)"
        }
      ]
    }
  });
}

// 📤 Export CSV
exportCSV.addEventListener("click", () => {
  let csv = "Name,Category,Stock\n";
  productData.forEach((p) => {
    csv += `${p.name},${p.category},${p.stock}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products.csv";
  a.click();
});

// 📤 Export Excel
exportExcel.addEventListener("click", () => {
  let table = [["Name", "Category", "Stock"]];
  productData.forEach((p) => {
    table.push([p.name, p.category, p.stock]);
  });
  let csv = table.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products.xls";
  a.click();
});

// 🌗 Dark Mode Toggle
darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});

// Set Theme saat load
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}
