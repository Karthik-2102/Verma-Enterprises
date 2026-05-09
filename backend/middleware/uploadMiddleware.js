const multer      = require("multer");
const cloudinary  = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* Cloudinary Configuration */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* Cloudinary Storage Engine */
const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
        /* Separate folder per upload type */
        const folder = file.fieldname === "workFile"
            ? "verma-enterprises/final-work"
            : "verma-enterprises/user-documents";

        return {
            folder,
            resource_type: "auto",       /* Supports PDF, images, docs */
            allowed_formats: ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"],
            public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`
        };
    }
});

/* File Filter — Accept PDFs and images only */
function fileFilter(req, file, cb) {
    const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, image, and document files are allowed"), false);
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }   /* 10 MB per file */
});

module.exports = upload;