const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Otp = require("../models/Otp");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const auth = require("../middleware/authMiddleware");

/* Normalize Login Identifier */

function normalizeIdentifier(identifier){

    return identifier
    ?.trim()
    ?.toLowerCase();

}

/* REGISTER */

router.post("/register", async (req, res) => {

    try {

        let {
            name,
            identifier,
            password,
            otp
        } = req.body;

        identifier =
        identifier
        ?.trim()
        ?.toLowerCase();

        const valid =
        await Otp.findOne({

            identifier,

            otp

        });

        if (!valid) {

            return res.json({

                success:false,

                message:
                "Invalid OTP ❌"

            });

        }

        const existing =
        await User.findOne({

            identifier

        });

        if (existing) {

            return res.json({

                success:false,

                message:
                "User already exists ❌"

            });

        }

        const hash =
        await bcrypt.hash(
            password,
            10
        );

        await User.create({

            name:
            name.trim(),

            identifier,

            password:
            hash,

            role:
            "user"

        });

        await Otp.deleteMany({

            identifier

        });

        res.json({

            success:true,

            message:
            "Registered successfully ✅"

        });

    } catch(err){

        console.error(err);

        res.json({

            success:false,

            message:
            "Server error ❌"

        });

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

                success:false,

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

                success:false,

                message:
                "Wrong password ❌"

            });

        }

        const token =
        jwt.sign({

            id:
            user._id,

            role:
            user.role

        },
        "secret123",
        {
            expiresIn:
            "1d"
        });

        res.json({

            success:true,

            token,

            message:
            "Login successful ✅"

        });

    } catch(err){

        console.error(err);

        res.json({

            success:false,

            message:
            "Server error ❌"

        });

    }

});

/* RESET PASSWORD */

router.post("/reset-password", async (req, res) => {

    try {

        let {
            identifier,
            otp,
            newPassword
        } = req.body;

        identifier =
        normalizeIdentifier(
            identifier
        );

        const valid =
        await Otp.findOne({

            identifier,

            otp

        });

        if (!valid) {

            return res.json({

                success:false,

                message:
                "Invalid OTP ❌"

            });

        }

        const hash =
        await bcrypt.hash(

            newPassword,

            10

        );

        await User.updateOne(

            {
                identifier
            },

            {
                password:
                hash
            }

        );

        await Otp.deleteMany({

            identifier

        });

        res.json({

            success:true,

            message:
            "Password updated ✅"

        });

    } catch(err){

        console.error(err);

        res.json({

            success:false,

            message:
            "Server error ❌"

        });

    }

});

module.exports =
router;