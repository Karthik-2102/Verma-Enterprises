const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    // token header se aayega
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No token provided ❌"
        });
    }

    try {
        // verify token
        const decoded = jwt.verify(token, "secret123");

        // user info save karo request me
        req.user = decoded;

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid token ❌"
        });
    }
};

module.exports = authMiddleware;