const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const router = express.Router();

// Register API
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validasi input
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Periksa apakah email sudah terdaftar
    const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user ke database
    await pool.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [
      username,
      email,
      hashedPassword,
    ]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login API
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Cari user berdasarkan email
    const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Verifikasi password
    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Buat token JWT
    const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;
