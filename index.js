// ============================================================
//  DATA LAYER — simulasi pointer C++ dalam JavaScript
//
//  inventaris = array of objects (mirip Buku inventaris[])
//  Setiap objek punya .addr (simulasi alamat memori)
//  selectedPtr = "pointer" ke elemen yang dipilih
// ============================================================

let inventaris = [];
let idCounter = 1;
let addrBase = 0x8a00;
let selectedPtr = null; // Buku* selectedPtr = nullptr

// Cover sementara (base64) sebelum disimpan ke DB
let pendingCoverBase64 = null;

// Simulasi &variabel → hasilkan alamat hex
function getAddr(i) {
  return "0x" + (addrBase + i * 0x40).toString(16).toUpperCase();
}

function log(html) {
  const el = document.getElementById("ptr-log");
  const entry = document.createElement("span");
  entry.className = "log-entry";
  entry.innerHTML = html;
  el.appendChild(entry);
  el.scrollTop = el.scrollHeight;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

// ── SPLASH SCREEN CONTROL ──
function hideSplash() {
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.classList.add("hide");
      setTimeout(() => splash.classList.add("hide-end"), 1000); // after slide transition
    }
  }, 2500); // 2.5s after animations
}

// ============================================================

//  COVER UPLOAD — konversi file ke base64
// ============================================================
async function resizeImage(file, maxSizeKB = 1024) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Max 400x500, maintain aspect
      const maxW = 400;
      const maxH = 500;
      let { width: w, height: h } = img;

      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w *= ratio;
        h *= ratio;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Compress iteratively
      let quality = 0.9;
      const maxSize = maxSizeKB * 1024;

      const compress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob.size <= maxSize || quality < 0.1) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            } else {
              quality -= 0.1;
              compress();
            }
          },
          "image/jpeg",
          quality,
        );
      };

      compress();
    };

    img.src = URL.createObjectURL(file);
  });
}

function handleCoverChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Max 2MB
  if (file.size > 2 * 1024 * 1024) {
    showToast("Gambar maks 2MB!");
    event.target.value = "";
    return;
  }

  // Image only
  if (!file.type.startsWith("image/")) {
    showToast("Hanya gambar JPG/PNG/WEBP!");
    event.target.value = "";
    return;
  }

  showToast("Memproses gambar...");

  resizeImage(file, 1024)
    .then((resizedBase64) => {
      pendingCoverBase64 = resizedBase64;
      renderUploadPreview(resizedBase64);
      showToast("Gambar siap (dikompres otomatis)");
    })
    .catch(() => {
      showToast("Gagal proses gambar");
      event.target.value = "";
    });
}

function renderUploadPreview(src) {
  const area = document.getElementById("upload-area");
  const preview = document.getElementById("upload-preview");
  area.classList.add("has-image");
  preview.innerHTML = `
    <img src="${src}" class="cover-preview-img" alt="preview cover" />
    <button class="upload-remove-btn" onclick="removeCoverPreview(event)">✕ Hapus cover</button>
  `;
}

function removeCoverPreview(event) {
  event.stopPropagation();
  pendingCoverBase64 = null;
  document.getElementById("f-cover").value = "";
  const area = document.getElementById("upload-area");
  area.classList.remove("has-image");
  document.getElementById("upload-preview").innerHTML = `
    <div class="upload-placeholder">
      <span class="upload-icon">📖</span>
      <span class="upload-text">Klik untuk upload cover</span>
      <span class="upload-hint">JPG, PNG, WEBP — maks 2MB</span>
    </div>
  `;
}

// ============================================================
//  tambahBuku() — setara void tambahBuku(Buku*, int* jumlah)
// ============================================================
async function tambahBuku() {
  const judul = document.getElementById("f-judul").value;
  const pengarang = document.getElementById("f-pengarang").value;
  const stok = parseInt(document.getElementById("f-stok").value);

  if (!judul || !pengarang) {
    showToast("Isi data dengan lengkap!");
    return;
  }

  // FORCE ID: Selalu gunakan urutan berikutnya dari jumlah buku yang ada
  const nextId = inventaris.length + 1;

  try {
    const newBook = await apiCall("/books", "POST", {
      _id: nextId, // Kirim ID yang sudah kita tentukan secara urut
      judul,
      pengarang,
      stok,
      cover: pendingCoverBase64 || "",
    });

    // Update alamat memori simulasi
    newBook.addr = getAddr(inventaris.length);
    inventaris.push(newBook);

    // Sinkronkan kembali idCounter
    idCounter = inventaris.length + 1;

    // Reset UI
    document.getElementById("f-judul").value = "";
    document.getElementById("f-pengarang").value = "";
    pendingCoverBase64 = null;

    render();
    showToast(`Buku #${nextId} berhasil ditambahkan!`);
  } catch (error) {
    console.error("Gagal menambah buku:", error);
    // Jika gagal karena ID duplikat di DB, paksa sync
    showToast("Gagal! Mencoba sinkronisasi ulang...");
    loadBooks();
  }
}

// ============================================================
//  cariBuku() — Buku* cariBuku(id) → return pointer atau null
// ============================================================
function cariBuku(id) {
  log(
    `<span class="log-op">cariBuku(id=${id})</span> <span class="log-info">scanning array...</span>`,
  );
  for (let i = 0; i < inventaris.length; i++) {
    if (inventaris[i]._id === id) {
      const addr = getAddr(i);
      log(
        `<span class="log-info">  found at index ${i} →</span> <span class="log-ptr">return</span> <span class="log-addr">&amp;inventaris[${i}] = ${addr}</span>`,
      );
      return { ptr: inventaris[i], addr, idx: i };
    }
  }
  log(
    `<span class="log-ptr">return</span> <span class="log-val">nullptr</span> <span class="log-info">(not found)</span>`,
  );
  return null;
}

// ============================================================
//  updateStok() — void updateStok(Buku* buku, int stokBaru)
// ============================================================
async function updateStok() {
  if (!selectedPtr) return;
  const val = parseInt(document.getElementById("edit-stok").value);
  if (isNaN(val) || val < 0) {
    showToast("Stok tidak valid");
    return;
  }

  try {
    const old = selectedPtr.ptr.stok;
    const updated = await updateBookStok(selectedPtr.ptr._id, val);
    selectedPtr.ptr.stok = updated.stok;

    log(
      `<span class="log-op">updateStok()</span> <span class="log-ptr">buku-&gt;stok</span> <span class="log-info">@ <span class="log-addr">${selectedPtr.addr}</span></span>`,
    );
    log(
      `<span class="log-info">  ${old}</span> <span class="log-op">→</span> <span class="log-val">${updated.stok}</span>`,
    );

    render();
    selectBuku(selectedPtr.ptr._id);
    showToast("Stok diperbarui ✓");
  } catch (error) {
    console.error("Error updating book:", error);
  }
}

// ============================================================
//  hapusBuku() — menggeser array, update pointer
// ============================================================
async function hapusBuku() {
  if (!selectedPtr) return;

  const targetId = selectedPtr._id;
  if (!confirm(`Hapus buku "${selectedPtr.judul}"? Semua ID akan dirapatkan.`))
    return;

  try {
    // 1. Hapus buku target dari DB
    await deleteBook(targetId);

    // 2. Buat array baru tanpa buku tersebut
    const filtered = inventaris.filter((b) => b._id !== targetId);

    // 3. RE-INDEXING LOKAL: Paksa ID jadi 1, 2, 3...
    const sanitizedData = filtered.map((buku, index) => {
      return {
        ...buku,
        _id: index + 1, // ID baru urut
        addr: getAddr(index), // Alamat memori baru urut
      };
    });

    // 4. SYNC KE SERVER: Timpa isi database dengan data yang sudah rapi
    await apiCall("/books/sync", "POST", { data: sanitizedData });

    // 5. Update state aplikasi
    inventaris = sanitizedData;
    idCounter = inventaris.length + 1;
    selectedPtr = null;

    closeModal();
    render();
    showToast("Buku dihapus & ID dirapatkan kembali");
  } catch (error) {
    console.error("Gagal saat proses hapus/sync:", error);
    showToast("Terjadi kesalahan sinkronisasi");
  }
}

// ============================================================
//  selectBuku() — Buku* selectedPtr = cariBuku(id)
// ============================================================
function selectBuku(id) {
  selectedPtr = inventaris.find((b) => b._id === id);

  log(
    `<span class="log-ptr">selectedPtr</span> = <span class="log-addr">${selectedPtr.addr}</span>`,
  );

  renderModalContent();
  openModal();
  render(); // Update highlight di tabel
}

// Fungsi baru untuk merender konten di dalam modal
// --- Fungsi untuk merender isi Modal ---
function renderModalContent() {
  const container = document.getElementById("modal-body");
  if (!selectedPtr) return;

  // Gunakan cover dari data, jika kosong pakai placeholder
  const coverSrc =
    selectedPtr.cover && selectedPtr.cover !== ""
      ? selectedPtr.cover
      : "https://via.placeholder.com/150x200?text=No+Cover";

  container.innerHTML = `
    <div style="text-align: center;">
      <img src="${coverSrc}" class="modal-cover-preview" alt="Cover Buku">
      
      <div style="font-family: var(--mono); font-size: 11px; color: var(--accent); margin-bottom: 5px;">
        ADDR: ${selectedPtr.addr}
      </div>
      <h2 style="font-family: var(--serif); margin-bottom: 5px; color: var(--ink);">${selectedPtr.judul}</h2>
      <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 20px;">oleh ${selectedPtr.pengarang}</p>
      
      <div class="divider"></div>

      <div style="margin-top: 20px;">
        <label style="font-weight: bold; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--muted);">
          Manajemen Stok
        </label>
        
        <div class="stock-control-wrapper">
          <button class="btn-qty" onclick="handleStepStok(-1)">−</button>
          <div class="stock-display" id="modal-stok-val">${selectedPtr.stok}</div>
          <button class="btn-qty" onclick="handleStepStok(1)">+</button>
        </div>
      </div>

      <button class="btn-primary" 
              style="background: transparent; color: #c0392b; border: 1px solid #c0392b; width: 100%; margin-top: 30px; font-size: 0.8rem;" 
              onclick="hapusBuku()">
        🗑 Hapus dari Inventaris
      </button>
    </div>
  `;
}

// --- Fungsi Handler untuk menjembatani UI dan api.js ---
async function handleStepStok(delta) {
  if (!selectedPtr) return;

  const newStok = Math.max(0, selectedPtr.stok + delta);

  // Jika tidak ada perubahan, tidak perlu panggil API
  if (newStok === selectedPtr.stok) return;

  try {
    // MEMANGGIL FUNGSI ASLI KAMU: updateBookStok(id, stok)
    const updated = await updateBookStok(selectedPtr._id, newStok);

    // Update data di memory lokal (pointer)
    selectedPtr.stok = updated.stok;

    // Update angka di layar modal secara langsung (instan)
    const display = document.getElementById("modal-stok-val");
    if (display) display.textContent = selectedPtr.stok;

    showToast(`Stok berhasil diubah: ${selectedPtr.stok}`);
    render(); // Update tabel di background
  } catch (error) {
    console.error("Gagal update stok:", error);
  }
}

// Fungsi internal untuk menangani klik tombol + / -
async function handleUpdateStok(delta) {
  if (!selectedPtr) return;

  const newStok = Math.max(0, selectedPtr.stok + delta);

  // Jika stok tidak berubah (misal sudah 0 lalu dikurang), jangan panggil API
  if (newStok === selectedPtr.stok) return;

  try {
    // Memanggil fungsi updateBookStok sesuai yang ada di api.js
    const updated = await updateBookStok(selectedPtr._id, newStok);

    // Update data di pointer lokal
    selectedPtr.stok = updated.stok;

    // Update tampilan UI modal secara instan
    const display = document.getElementById("modal-stok-val");
    if (display) display.textContent = selectedPtr.stok;

    showToast(`Stok diperbarui menjadi ${selectedPtr.stok}`);
    render(); // Refresh tabel di background
  } catch (error) {
    console.error("Gagal update stok:", error);
  }
}

// Fungsi Kontrol Modal
function openModal() {
  const modal = document.getElementById("edit-modal");
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("show"), 10);
}

function closeModal() {
  const modal = document.getElementById("edit-modal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
    selectedPtr = null;
    render();
  }, 300);
}

// Tambahkan event listener untuk menutup modal jika klik di luar box
window.onclick = function (event) {
  const modal = document.getElementById("edit-modal");
  if (event.target == modal) {
    closeModal();
  }
};

// ============================================================
//  RENDER
// ============================================================
function render() {
  const query = document.getElementById("search").value.toLowerCase();
  const list = document.getElementById("book-list");

  const filtered = inventaris.filter(
    (b) =>
      b.judul.toLowerCase().includes(query) ||
      b.pengarang.toLowerCase().includes(query),
  );

  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="empty-state">// tidak ada data ditemukan</div>';
  } else {
    list.innerHTML = filtered
      .map((b) => {
        const realIdx = inventaris.indexOf(b);
        const addr = getAddr(realIdx);
        const stokClass =
          b.stok === 0 ? "stok-empty" : b.stok <= 3 ? "stok-low" : "stok-ok";
        const isSelected = selectedPtr && selectedPtr.ptr._id === b._id;

        const coverCell = b.cover
          ? `<img src="${b.cover}" class="cover-thumb" alt="cover" onerror="this.style.display='none';this.nextSibling.style.display='flex'" style="background:#f0f0f0;border-radius:4px;" />
             <div class="cover-placeholder" style="display:none;position:absolute;">📖</div>`
          : `<div class="cover-placeholder">📖</div>`;

        return `
        <div class="book-row ${isSelected ? "selected" : ""}" onclick="selectBuku(${b._id})">
          <span class="book-id">#${b._id}</span>
          ${coverCell}
          <div style="min-width:0">
            <div class="book-title">${b.judul}</div>
            <div class="book-author">${b.pengarang}</div>
          </div>
          <span class="ptr-badge col-addr ${isSelected ? "green" : ""}">${addr}</span>
          <span class="stok-badge ${stokClass}">${b.stok}</span>
          <button class="action-btn" onclick="event.stopPropagation();selectBuku(${b._id})">Edit</button>
        </div>`;
      })
      .join("");
  }

  // Update header stats
  const totalStok = inventaris.reduce((s, b) => s + b.stok, 0);
  const lowCount = inventaris.filter((b) => b.stok <= 3).length;
  document.getElementById("total-buku").textContent = inventaris.length;
  document.getElementById("total-stok").textContent = totalStok;
  document.getElementById("stok-low-count").textContent = lowCount;
}

// ── SEARCH listener ──
document.getElementById("search").addEventListener("input", () => {
  log(
    `<span class="log-op">cariBuku()</span> <span class="log-info">filter: "${document.getElementById("search").value}"</span>`,
  );
  render();
});

// ── LOAD DATA FROM SERVER ──
// [index.js]
async function loadBooks() {
  try {
    // 1. Ambil data dari API
    const books = await getAllBooks();

    if (books && books.length > 0) {
      // 2. Petakan data dan berikan alamat memori simulasi (addr)
      inventaris = books.map((b, i) => ({
        ...b,
        addr: getAddr(i),
      }));

      // 3. CARI ID TERTINGGI (Penting agar ID baru tidak duplikat/melompat)
      const maxId = Math.max(...inventaris.map((b) => b._id));
      idCounter = maxId + 1;

      log('<span class="log-info">// inventaris[] loaded from MongoDB</span>');
    } else {
      inventaris = [];
      idCounter = 1; // Jika kosong, mulai dari ID 1
      log('<span class="log-info">// Database kosong</span>');
    }
  } catch (error) {
    console.error("Gagal memuat buku:", error);
  }

  // 4. Update tampilan tabel
  render();
}

// ── SIDE PANEL TOGGLE ──
function toggleSidePanel() {
  const sidePanel = document.querySelector(".side-panel");
  const toggleBtn = document.getElementById("toggle-side");
  const mainPanel = document.querySelector(".main-panel");

  sidePanel.classList.toggle("open");
  const isOpen = sidePanel.classList.contains("open");

  toggleBtn.textContent = isOpen ? "✕" : "☰";
  toggleBtn.title = isOpen ? "Tutup panel" : "Buka panel";

  mainPanel.classList.toggle("has-open-panel", isOpen);
}

// Load books when page loads
// Cukup satu blok DOMContentLoaded saja
// Hapus semua baris dari "document.addEventListener" sampai paling bawah,
// lalu ganti dengan ini:

document.addEventListener("DOMContentLoaded", () => {
  hideSplash();
  loadBooks();

  // Setup listener untuk menutup modal jika area luar (overlay) diklik
  const modal = document.getElementById("edit-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
});
