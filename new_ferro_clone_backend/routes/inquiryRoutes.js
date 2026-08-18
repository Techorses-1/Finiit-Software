const express = require("express");
const router = express.Router();
const Inquiry = require("../models/inquiry");
const nodemailer = require("nodemailer");

// POST inquiry form
router.post("/submit", async (req, res) => {
  try {
    const { name, company, email, phone, message } = req.body;

    // Validate required fields
    if (!name || !company || !email || !message) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    // Save inquiry to DB
    const inquiry = new Inquiry({ name, company, email, phone, message });
    await inquiry.save();

    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // use STARTTLS
      auth: {
        user: "md@ferrotubeindia.com",
        pass: "hglprncshfttmwpc", // paste the one you just generated
      },
    });


    const mailOptions = {
      from: "md@ferrotubeindia.com",
      to: "md@ferrotubeindia.com", // send to self for demo
      subject: `New Inquiry from ${name}`,
      html: `
        <h2>New Inquiry Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Inquiry submitted successfully" });
  } catch (error) {
    console.error("Inquiry submission error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
