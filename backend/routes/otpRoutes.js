const express = require("express");

const router = express.Router();

const { Resend } = require("resend");

const Otp = require("../models/Otp");

/* RESEND */

const resend = new Resend(
    process.env.RESEND_API_KEY
);

/* SEND OTP */

router.post("/send-otp", async (req, res) => {

    try {

        const { identifier } = req.body;

        if(!identifier){

            return res.status(400).json({

                message:"Enter email"

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

            to: identifier,

            subject:
            "Your OTP - Verma Enterprises",

            html: `

                <h2>
                    Verma Enterprises
                </h2>

                <p>
                    Your OTP is:
                </p>

                <h1>
                    ${otp}
                </h1>

                <p>
                    Valid for 5 minutes.
                </p>

            `

        });

        res.json({

            message:
            "OTP sent successfully"

        });

    } catch(err){

        console.log(err);

        res.status(500).json({

            message:
            "Server error"

        });

    }

});

/* VERIFY OTP */

router.post("/verify-otp", async (req, res) => {

    try {

        const { identifier, otp } = req.body;

        const data =
        await Otp.findOne({

            identifier,
            otp

        });

        if(!data){

            return res.status(400).json({

                message:"Invalid OTP"

            });

        }

        res.json({

            message:
            "OTP verified"

        });

    } catch(err){

        res.status(500).json({

            message:
            "Server error"

        });

    }

});

module.exports = router;