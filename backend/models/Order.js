const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },

    files: [{
        type: String
    }],

    finalWorkFile: {
        type: String,
        default: ""
    },

    status: {
        type: String,
        enum: ["pending", "completed", "rejected"],
        default: "pending"
    },

    reason: {
        type: String,
        default: ""
    }

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);