const express = require("express");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/booksRoutes");
const cors = require("cors");  // Jika ingin mengizinkan akses dari luar
require("dotenv").config();    // Jika menggunakan .env untuk variabel lingkungan

const app = express();

// Middleware untuk log setiap request yang masuk
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} request to ${req.originalUrl}`);
  next();
});

// Middlewares
app.use(cors());                // Mengizinkan akses dari luar (opsional)
app.use(express.json());        // Middleware untuk JSON
app.use(express.urlencoded({ extended: true })); // Middleware untuk form URL-encoded

// Routes
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/auth", authRoutes);  // Jika Anda memiliki route otentikasi
app.use("/api/books", bookRoutes); // Route untuk buku

// Handle 404 errors (rute tidak ditemukan)
app.use((req, res, next) => {
  res.status(404).send("Page not found");
});

// Menjalankan server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`LiteraSearch app listening on port ${PORT}`);
});
