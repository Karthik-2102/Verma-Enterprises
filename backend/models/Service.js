const mongoose = require("mongoose");

const SERVICE_CATEGORIES = [

    "Government Services",

    "Education Services",

    "Printing Services",

    "Banking Services",

    "Documentation Services"

];

/* Service Schema */

const serviceSchema =
new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    basePrice: {
        type: Number,
        default: 0
    },

    finalPrice: {
        type: Number,
        default: 0
    },

    applicationCharge: {
        type: Number,
        default: 0
    },

    serviceCharge: {
        type: Number,
        default: 0
    },

    documents: {
        type: [String],
        default: []
    },

    category: {

        type: String,

        enum:
        SERVICE_CATEGORIES,

        default:
        "Government Services"

    }

}, {
    timestamps: true
});

/* Prevent Model Overwrite */

const Service =
mongoose.models.Service ||

mongoose.model(
    "Service",
    serviceSchema
);

module.exports =
Service;

module.exports
.SERVICE_CATEGORIES =
SERVICE_CATEGORIES;