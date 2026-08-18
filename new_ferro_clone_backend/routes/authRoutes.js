const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /register - Register new user
router.post("/register", async (req, res) => {
  try {
    // Check if user already exists - scan instead of query
    const existingUsers = await User.scan("email").eq(req.body.email).exec();
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create new user
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword
    });

    const savedUser = await user.save();
    
    // Create JWT token
    const token = jwt.sign(
      { userId: savedUser.userId },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        userId: savedUser.userId,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed", error });
  }
});

// POST /login - Authenticate user
router.post("/login", async (req, res) => {
  try {
    // Find user by email - scan instead of query
    const users = await User.scan("email").eq(req.body.email).exec();
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    
    // Compare passwords
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error });
  }
});

module.exports = router;