const express = require("express");
const router = express.Router();

const nodemailer = require("nodemailer");

const Otp = require("../models/Otp");

/* MAIL TRANSPORTER */

const transporter = nodemailer.createTransport({

    host: "smtp.gmail.com",

    port: 587,

    secure: false,

    auth: {

        user: process.env.EMAIL_USER,

        pass: process.env.EMAIL_PASS

    },

    tls: {

        rejectUnauthorized: false

    }

});

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

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: identifier,

            subject: "Verma Enterprises OTP",

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

            message:"Server error"

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

            message:"OTP verified"

        });

    } catch(err){

        res.status(500).json({

            message:"Server error"

        });

    }

});

module.exports = router;