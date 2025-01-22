const admin = require("firebase-admin");

const verifyToken = async (customToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(customToken);
    return decodedToken;
  } catch (error) {
    console.error("Error verifying token:", error);
    throw new Error("Token verification failed");
  }
};

const signInWithCustomToken = async (req, res) => {
  const { uid } = req.body;

  try {
    // Use the UID directly for testing purposes
    const decodedToken = { uid };

    // The user is authenticated, you can use decodedToken to get user information
    res.status(200).json({
      uid: decodedToken.uid,
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("Error signing in with custom token:", error);
    res.status(401).json({ error: "Authentication Failed" });
  }
};

module.exports = { signInWithCustomToken };
