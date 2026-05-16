const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

/* Sanitize file name — allows any name, removes unsafe characters */
function sanitizeFileName(originalName) {
    return originalName
        .replace(/\s+/g, "_")            /* spaces → underscore */
        .replace(/[^a-zA-Z0-9._\-]/g, "") /* remove unsafe special chars */
        .replace(/_{2,}/g, "_")           /* collapse multiple underscores */
        .toLowerCase();
}

/* Detect correct Cloudinary resource_type by mimetype */
function getResourceType(mimetype) {

    /* Keep PDFs as raw for stable uploads */
    if (mimetype === "application/pdf") return "raw";

    if (mimetype.startsWith("image/")) return "image";

    if (mimetype.startsWith("video/")) return "video";

    return "raw";

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
            resource_type: getResourceType(file.mimetype),
            public_id:     `${safeName}_${Date.now()}`,
            format:file.mimetype === "application/pdf" ? "pdf" :
                     file.mimetype === "image/png"        ? "png" :
                     file.mimetype === "image/webp"       ? "webp" : "jpg"
                     
        };
    }
});

/* File Filter — accept PDF, JPG, PNG, JPEG, WEBP */
function fileFilter(req, file, cb) {

    const allowedTypes = [

        "application/pdf",

        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",

        "image/heic",
        "image/heif",

        "application/octet-stream"

    ];

    const extension =

        file.originalname
            .toLowerCase();

    const isHeicByExtension =

        extension.endsWith(".heic") ||
        extension.endsWith(".heif");

    if (

        allowedTypes.includes(
            file.mimetype
        )

        ||

        isHeicByExtension

    ) {

        cb(null, true);

    }

    else {

        cb(

            new Error(

                `File type not supported: ${file.originalname}`

            ),

            false

        );

    }

}

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 /* 5 MB limit */
    },
    fileFilter
});

/* Upload Error Handler Middleware */
/* Use this AFTER all routes in server.js */
function handleUploadError(err, req, res, next) {

    console.error("Upload Error Full Object:", err);
    console.error("Upload Error JSON:", JSON.stringify(err, null, 2));
    console.error("Upload Error Stack:", err?.stack || "No stack available");

    /* Password-protected PDF */
    if (err?.message === "Request aborted") {
    return res.status(400).json({
        success: false,
        message: "Upload was interrupted. Please try again."
    });
}
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

    /* Unsupported file type */
    if (err?.message?.toLowerCase().includes("file type not supported")) {
        return res.status(400).json({
            success: false,
            message: err.message
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