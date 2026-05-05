const cookieParser = require("cookie-parser");
const express = require("express");
const csrf = require("csurf");

// Create CSRF middleware (cookie-based)
const csrfProtection = csrf({ cookie: true });

// Base middleware function
const applyMiddleware = (app) => {
  app.use(cookieParser());
  app.use(express.json());
};

module.exports = {
  applyMiddleware,
  csrfProtection
};