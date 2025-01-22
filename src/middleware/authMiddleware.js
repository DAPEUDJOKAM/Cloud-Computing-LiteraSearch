const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  // Ambil token dari header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1]; // Ambil token setelah "Bearer"

  try {
    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Simpan data user yang ter-decode ke request object
    next(); // Lanjut ke handler berikutnya
  } catch (error) {
    return res.status(403).json({ message: "Invalid token." });
  }
};

module.exports = authenticateToken;
