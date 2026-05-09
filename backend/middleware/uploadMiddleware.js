const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

/* Sanitize file name — allows any name, removes unsafe characters */
function sanitizeFileName(originalName) {
    return originalName
        .replace(/\s+/g, "_")           /* spaces → underscore */
        .replace(/[^a-zA-Z0-9._\-]/g, "") /* remove unsafe special chars */
        .replace(/_{2,}/g, "_")          /* collapse multiple underscores */
        .toLowerCase();
}

/* Upload Storage Configuration */
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const safeName = sanitizeFileName(
            file.originalname.replace(/\.[^/.]+$/, "") /* strip extension */
        );
        return {
            folder:        "verma-enterprises",
            resource_type: "auto",
            public_id:     `${safeName}_${Date.now()}`
        };
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024  /* 10 MB */
    }
});

/* Password-protected PDF error handler middleware */
/* Use this AFTER your upload route middleware */
function handleUploadError(err, req, res, next) {

    console.error("Upload Error Full Object:", err);
    console.error("Upload Error JSON:", JSON.stringify(err, null, 2));
    console.error("Upload Error Stack:", err?.stack || "No stack available");

    /* Password-protected PDF */
    if (
        err?.message?.toLowerCase().includes("password") ||
        err?.message?.toLowerCase().includes("password-protected")
    ) {
        return res.status(400).json({
            success: false,
            message: "This PDF is password-protected. Please remove the password and try again."
        });
    }

    /* Invalid / corrupted PDF */
    if (err?.message?.toLowerCase().includes("invalid pdf")) {
        return res.status(400).json({
            success: false,
            message: "This file appears to be corrupted or is not a valid PDF. Please try a different file."
        });
    }

    /* File too large */
    if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File is too large. Maximum allowed size is 10 MB."
        });
    }

    /* Generic fallback */
    return res.status(500).json({
        success: false,
        message: err?.message || "Upload failed. Please try again."
    });
}

module.exports = { upload, handleUploadError };