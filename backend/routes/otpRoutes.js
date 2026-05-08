const express = require("express");

const router = express.Router();

const { Resend } = require("resend");

const Otp = require("../models/Otp");

/* Email Service Configuration */

const resend = new Resend(
    process.env.RESEND_API_KEY
);

/* Send OTP */

router.post("/send-otp", async (req, res) => {

    try {

        const { identifier } = req.body;

        if (!identifier) {

            return res.status(400).json({

                message:
                "Enter email"

            });

        }

        const otp =
        Math.floor(
            100000 +
            Math.random() * 900000
        ).toString();

        await Otp.create({

            identifier,

            otp

        });

        await resend.emails.send({

            from:
            "Verma Enterprises <onboarding@resend.dev>",

            to:
            identifier,

            subject:
            "Your OTP - Verma Enterprises",

            html: `

                <div style="
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    background: #f8f8f8;
                    border-radius: 12px;
                    max-width: 500px;
                    margin: auto;
                    border: 1px solid #e5e5e5;
                ">

                    <h2 style="
                        color: #D0060D;
                        margin-bottom: 20px;
                    ">
                        Verma Enterprises
                    </h2>

                    <p style="
                        color: #333;
                        font-size: 16px;
                        margin-bottom: 10px;
                    ">
                        Your verification code:
                    </p>

                    <h1 style="
                        font-size: 32px;
                        letter-spacing: 4px;
                        color: #111;
                        margin: 15px 0;
                    ">
                        ${otp}
                    </h1>

                    <p style="
                        color: #666;
                        font-size: 14px;
                    ">
                        Valid for 5 minutes.
                    </p>

                </div>

            `

        });

        res.json({

            success: true,

            message:
            "OTP sent successfully"

        });

    } catch (err) {

        console.log(
            "OTP SEND ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
            "Server error"

        });

    }

});

/* Verify OTP */

router.post("/verify-otp", async (req, res) => {

    try {

        const {
            identifier,
            otp
        } = req.body;

        const data =
        await Otp.findOne({

            identifier,

            otp

        });

        if (!data) {

            return res.status(400).json({

                success: false,

                message:
                "Invalid OTP"

            });

        }

        res.json({

            success: true,

            message:
            "OTP verified"

        });

    } catch (err) {

        console.log(
            "OTP VERIFY ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            message:
            "Server error"

        });

    }

});

module.exports =
router;