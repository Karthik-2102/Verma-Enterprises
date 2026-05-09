const multer = require("multer");

const {
    CloudinaryStorage
} = require(
    "multer-storage-cloudinary"
);

const cloudinary =
require("../config/cloudinary");

/* Upload Storage Configuration */

const storage =
new CloudinaryStorage({

    cloudinary,

    params:
    async (req, file) => {

        return {

            folder:
            "verma-enterprises",

            resource_type:
            "auto"

        };

    }

});

const upload =
multer({

    storage,

    limits: {

        fileSize:
        10 * 1024 * 1024

    }

});

/* Upload Error Debug */

upload.handleError =
(error) => {

    console.error(

        "Cloudinary Upload Error:",

        JSON.stringify(
            error,
            null,
            2
        )

    );

};

module.exports =
upload;