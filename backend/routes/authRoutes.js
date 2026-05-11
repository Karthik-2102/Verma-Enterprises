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

module.exports =
router;