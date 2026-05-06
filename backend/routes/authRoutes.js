const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/authMiddleware");

/* ========================= */
/* REGISTER */
/* ========================= */
router.post("/register", async (req, res) => {
    try {
        const { name, identifier, password, otp } = req.body;

        const valid = await Otp.findOne({ identifier, otp });
        if (!valid) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const existing = await User.findOne({ identifier });
        if (existing) {
            return res.json({ success: false, message: "User already exists ❌" });
        }

        const hash = await bcrypt.hash(password, 10);

        await User.create({
            name,
            identifier,
            password: hash,
            role: "user" // ✅ default role
        });

        await Otp.deleteMany({ identifier });

        res.json({ success: true, message: "Registered successfully ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* ========================= */
/* LOGIN */
/* ========================= */
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await User.findOne({ identifier });

        if (!user) {
            return res.json({ success: false, message: "User not found ❌" });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.json({ success: false, message: "Wrong password ❌" });
        }

        // ✅ TOKEN CREATE
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role || "user"
            },
            "secret123",
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            token,
            message: "Login successful ✅"
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});

/* ========================= */
/* RESET PASSWORD */
/* ========================= */
router.post("/reset-password", async (req, res) => {
    try {
        const { identifier, otp, newPassword } = req.body;

        const valid = await Otp.findOne({ identifier, otp });
        if (!valid) {
            return res.json({ success: false, message: "Invalid OTP ❌" });
        }

        const user = await User.findOne({ identifier });
        if (!user) {
            return res.json({ success: false, message: "User not found ❌" });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        // ❌ OLD MISTAKE: create()
        // ✅ FIX: updateOne()

        await User.updateOne(
            { identifier },
            { password: hash }
        );

        await Otp.deleteMany({ identifier });

        res.json({ success: true, message: "Password updated ✅" });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Server error ❌" });
    }
});
router.get("/me", auth, async (req, res) => {
    try {

        const user = await User.findById(req.user.id)
        .select("-password");

        res.json({
            success: true,
            user
        });

    } catch (error) {
        res.json({
            success:false,
            message:"Failed to load profile"
        });
    }
});
/* ========================= */
/* CHANGE PASSWORD AFTER LOGIN */
/* ========================= */
router.post("/change-password", auth, async (req, res) => {
    try {

        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.json({
                success: false,
                message: "Password must be at least 6 characters ❌"
            });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        await User.findByIdAndUpdate(
            req.user.id,
            { password: hash }
        );

        res.json({
            success: true,
            message: "Password changed successfully ✅"
        });

    } catch (err) {
        console.error(err);
        res.json({
            success: false,
            message: "Server error ❌"
        });
    }
});
/* =========================
ADMIN SEND OTP
========================= */
router.post("/admin-send-otp", auth, async (req,res)=>{

    const user = await User.findById(req.user.id);

    if(user.role !== "admin"){
        return res.json({
            success:false,
            message:"Admin only ❌"
        });
    }

    const otp =
    Math.floor(100000 + Math.random()*900000)
    .toString();

    await Otp.create({
        identifier:user.identifier,
        otp
    });

    console.log("ADMIN OTP:", otp);

    res.json({
        success:true,
        message:"OTP sent successfully ✅"
    });
});

/* =========================
ADMIN CHANGE PASSWORD
========================= */
router.post("/admin-change-password", auth, async (req,res)=>{

    const { newPassword, otp } = req.body;

    const user = await User.findById(req.user.id);

    if(user.role !== "admin"){
        return res.json({
            success:false,
            message:"Admin only ❌"
        });
    }

    const valid = await Otp.findOne({
        identifier:user.identifier,
        otp
    });

    if(!valid){
        return res.json({
            success:false,
            message:"Invalid OTP ❌"
        });
    }

    const hash =
    await bcrypt.hash(newPassword,10);

    await User.findByIdAndUpdate(
        user._id,
        { password: hash }
    );

    await Otp.deleteMany({
        identifier:user.identifier
    });

    res.json({
        success:true,
        message:"Admin password changed ✅"
    });
});

module.exports = router;