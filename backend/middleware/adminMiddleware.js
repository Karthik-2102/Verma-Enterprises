const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    /* Authentication Token Extraction */
    const token =
        req.headers.authorization;

    if (!token) {

        return res.status(401).json({
            success: false,
            message: "No token provided"
        });

    }

    try {

        /* Authentication Token Verification */
        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        /* Authenticated User Context */
        req.user = decoded;

        next();

    }

    catch (err) {

        console.error(
            "Authentication Error:",
            err.message || err
        );

        return res.status(403).json({
            success: false,
            message: "Invalid or expired token"
        });

    }

};

module.exports = authMiddleware;