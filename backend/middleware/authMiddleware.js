const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    /* Read token from request header */

    const token =
    req.headers.authorization;

    if (!token) {

        return res.status(401).json({

            success: false,

            message:
            "No token provided ❌"

        });

    }

    try {

        /* Verify JWT token */

        const decoded =
        jwt.verify(

            token,

            "verma_enterprises_secure_2003"

        );

        /* Attach user data to request */

        req.user =
        decoded;

        next();

    }

    catch (err) {

        return res.status(401).json({

            success: false,

            message:
            "Invalid token ❌"

        });

    }

};

module.exports =
authMiddleware;