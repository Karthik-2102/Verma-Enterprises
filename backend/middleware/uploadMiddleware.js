const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* Ensure uploads folder exists */
const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* STORAGE */
const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname);
        const cleanName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;

        cb(null, cleanName);
    }
});

/* FILTER */
const fileFilter = (req, file, cb) => {

    const allowedExt = /pdf|jpg|jpeg|png/i;
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExt.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, JPG, JPEG, PNG files allowed"));
    }
};

/* MULTER */
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

module.exports = upload;