const cloudinary = require("cloudinary").v2;

console.log("Cloudinary Environment Check:", {
    cloud: !!process.env.CLOUD_NAME,
    key: !!process.env.CLOUD_API_KEY,
    secret: !!process.env.CLOUD_API_SECRET
});

/* Cloud Storage Configuration */
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

module.exports = cloudinary;