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

    params: (req, file) => {

        const folder =
        file.fieldname === "workFile"

        ?

        "verma-enterprises/final-work"

        :

        "verma-enterprises/user-documents";

        return {

            folder,

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

module.exports =
upload;