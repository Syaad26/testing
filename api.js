// ============================================================
//  API CLIENT — komunikasi dengan backend server
// ============================================================

const API_URL = "https://testing-production-298b.up.railway.app/api";

async function apiCall(endpoint, method = "GET", data = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "API Error");
    }
    return await response.json();
  } catch (error) {
    console.error(`API Error (${method} ${endpoint}):`, error.message);
    showToast(`Error: ${error.message}`);
    throw error;
  }
}

// GET all books
async function getAllBooks(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiCall(`/books${query}`);
}

// GET single book
async function getBook(id) {
  return apiCall(`/books/${id}`);
}

// POST tambah buku
async function addBook(judul, pengarang, stok, cover = "") {
  return apiCall("/books", "POST", { judul, pengarang, stok, cover });
}

// PUT update stok
async function updateBookStok(id, stok) {
  return apiCall(`/books/${id}/stok`, "PUT", { stok });
}

// DELETE hapus buku
async function deleteBook(id) {
  return apiCall(`/books/${id}`, "DELETE");
}

// GET stats
async function getStats() {
  return apiCall("/stats");
}

// SEED data
async function seedData() {
  return apiCall("/seed", "POST");
}
