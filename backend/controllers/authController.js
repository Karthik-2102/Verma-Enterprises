const User = require("../models/User");
const jwt = require("jsonwebtoken");

/* ================= GENERATE TOKEN ================= */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,        // 🔥 FIX (MOST IMPORTANT)
            role: user.role
        },
        "secret123",
        { expiresIn: "7d" }
    );
};

/* ================= REGISTER ================= */
exports.register = async (req, res) => {
    try {
        const { name, identifier, password } = req.body;

        const existing = await User.findOne({ identifier });
        if (existing) {
            return res.json({ success: false, message: "User already exists" });
        }

        const user = await User.create({
            name,
            identifier,
            password
        });

        const token = generateToken(user);

        res.json({
            success: true,
            message: "Registered successfully",
            token
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* ================= LOGIN ================= */
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await User.findOne({ identifier });

        if (!user || user.password !== password) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            message: "Login successful",
            token
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};