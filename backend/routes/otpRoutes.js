const express = require("express");
const router = express.Router();
const Otp = require("../models/Otp");

// SEND OTP
router.post("/send-otp", async (req, res) => {
    try {
        const { identifier } = req.body;

        if (!identifier) {
            return res.status(400).json({ message: "Enter email/mobile" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        console.log("OTP:", otp); // IMPORTANT

        await Otp.create({ identifier, otp });

        res.json({ message: "OTP sent successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});

// VERIFY OTP
router.post("/verify-otp", async (req, res) => {
    try {
        const { identifier, otp } = req.body;

        const data = await Otp.findOne({ identifier, otp });

        if (!data) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        res.json({ message: "OTP verified" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;