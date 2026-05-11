const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Otp = require("../models/Otp");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const auth = require("../middleware/authMiddleware");
const ActivityLog = require("../models/ActivityLog");

/* Normalize Login Identifier */

function normalizeIdentifier(identifier){

    return identifier
    ?.trim()
    ?.toLowerCase();

}

/* REGISTER */

router.post("/register", async (req, res) => {
    try {
        let { name, identifier, password } = req.body;

        identifier = identifier?.trim()?.toLowerCase();

        const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        const isMobile = /^[6-9]\d{9}$/.test(identifier);

        if (!isEmail && !isMobile) {
            return res.json({
                success: false,
                message: "Enter a valid email or 10-digit mobile number ❌"
            });
        }

        if (!name || !password) {
            return res.json({ success: false, message: "All fields required ❌" });
        }

        const existing = await User.findOne({ identifier });
        if (existing) {
            return res.json({ success: false, message: "User already exists ❌" });
        }

        const hash = await bcrypt.hash(password, 10);

        await User.create({
            name: name.trim(),
            identifier,
            password: hash,
            role: "user"
        });

        res.json({ success: true, message: "Registered successfully ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* LOGIN */

router.post("/login", async (req, res) => {

    try {

        let {
            identifier,
            password
        } = req.body;

        identifier =
        normalizeIdentifier(
            identifier
        );

        const user =
        await User.findOne({

            identifier

        });

        if (!user) {

            return res.json({

                success: false,

                message:
                "User not found ❌"

            });

        }

        const match =
        await bcrypt.compare(

            password.trim(),

            user.password

        );

        if (!match) {

            return res.json({

                success: false,

                message:
                "Wrong password ❌"

            });

        }

        /* Generate JWT Token */

        const token =
        jwt.sign(

            {

                id:
                user._id,

                role:
                user.role

            },

            "verma_enterprises_secure_2003",

            {

                expiresIn:
                "1d"

            }

        );

        res.json({

            success: true,

            token,

            message:
            "Login successful ✅"

        });

    }

    catch (err) {

        console.error(err);

        res.json({

            success: false,

            message:
            "Server error ❌"

        });

    }

});

/* RESET PASSWORD */

router.post("/reset-password", async (req, res) => {
    try {
        let { identifier, newPassword } = req.body;

        identifier = normalizeIdentifier(identifier);

        if (!identifier || !newPassword) {
            return res.json({ success: false, message: "All fields required ❌" });
        }

        const user = await User.findOne({ identifier });
        if (!user) {
            return res.json({ success: false, message: "User not found ❌" });
        }

        if (user.role === "admin") {
            return res.json({ success: false, message: "Admin must use the admin panel ❌" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ identifier }, { password: hash });

        res.json({ success: true, message: "Password updated ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* Current User Profile */

router.get("/me", auth, async (req, res) => {

    try {

        const user =
        await User.findById(
            req.user.id
        ).select("-password");

        if (!user) {

            return res.status(404).json({

                success: false,

                message: "User not found"

            });

        }

        res.json({

            success: true,

            user

        });

    }

    catch (error) {

        res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

});

/* ADMIN CHANGE PASSWORD (called after OTP verified on frontend) */
router.post("/admin-change-password-direct", auth, async (req, res) => {
    try {
        const { newPassword } = req.body;

        const user = await User.findById(req.user.id);

        if (!user || user.role !== "admin") {
            return res.json({ success: false, message: "Unauthorized ❌" });
        }

        if (!newPassword) {
            return res.json({ success: false, message: "Password required ❌" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ _id: req.user.id }, { password: hash });

        res.json({ success: true, message: "Password updated ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* ADMIN FORGOT PASSWORD — Send OTP */
router.post("/admin-forgot-otp", async (req, res) => {
    try {
        const { identifier } = req.body;

        if (!identifier) {
            return res.json({ success: false, message: "Email required ❌" });
        }

        const user = await User.findOne({ identifier: identifier.trim().toLowerCase() });

        if (!user || user.role !== "admin") {
            return res.json({ success: false, message: "Admin account not found ❌" });
        }

        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await Otp.create({ identifier: identifier.trim().toLowerCase(), otp });

        await resend.emails.send({
            from: "Verma Enterprises <onboarding@resend.dev>",
            to: identifier,
            subject: "Admin Password Reset OTP - Verma Enterprises",
            html: `
                <div style="font-family:Arial,sans-serif;padding:30px;background:#f8f8f8;border-radius:12px;max-width:500px;margin:auto;border:1px solid #e5e5e5;">
                    <h2 style="color:#D0060D;">Verma Enterprises — Admin Reset</h2>
                    <p style="color:#333;font-size:16px;">Your password reset OTP:</p>
                    <h1 style="font-size:32px;letter-spacing:4px;color:#111;margin:15px 0;">${otp}</h1>
                    <p style="color:#666;font-size:14px;">Valid for 5 minutes. Do not share this with anyone.</p>
                </div>
            `
        });

        res.json({ success: true, message: "OTP sent to admin email ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* ADMIN FORGOT PASSWORD — Verify OTP + Reset */
router.post("/admin-forgot-reset", async (req, res) => {
    try {
        let { identifier, otp, newPassword } = req.body;

        identifier = identifier?.trim()?.toLowerCase();

        if (!identifier || !otp || !newPassword) {
            return res.json({ success: false, message: "All fields required ❌" });
        }

        const user = await User.findOne({ identifier });
        if (!user || user.role !== "admin") {
            return res.json({ success: false, message: "Admin account not found ❌" });
        }

        const valid = await Otp.findOne({ identifier, otp });
        if (!valid) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ identifier }, { password: hash });
        await Otp.deleteMany({ identifier });

        res.json({ success: true, message: "Password reset successfully ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

module.exports =
router;