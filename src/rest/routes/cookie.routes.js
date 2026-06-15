const express = require("express");
const { csrfProtection } = require("../middleware/cookie.middleware");

const router = express.Router();

// Set cookie
router.post("/set-cookie", (req, res) => {
  res.cookie("username", "john_doe", {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
  });
  res.send("Cookie has been set");
});

// Get cookie
router.get("/get-cookie", (req, res) => {
  res.json(req.cookies);
});

// Delete cookie
router.delete("/delete-cookie", (req, res) => {
  res.clearCookie("username");
  res.send("Cookie deleted");
});

// Get CSRF token
router.get("/csrf/token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protected route
router.post("/csrf/set-cookie", csrfProtection, (req, res) => {
  res.cookie("user", "secure_user");
  res.send("CSRF protected cookie set");
});

module.exports = router;