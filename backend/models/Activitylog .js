const mongoose = require("mongoose");

/* Admin Activity Log Schema */
const activityLogSchema = new mongoose.Schema({

    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    adminName: {
        type: String,
        default: "Admin"
    },

    action: {
        type: String,
        required: true
        /* Examples:
           "Added service: PAN Card"
           "Deleted service: Passport"
           "Updated pricing: Aadhaar"
           "Updated order status: completed"
           "Uploaded final work for order"
           "Updated order timeline: Processing"
        */
    },

    category: {
        type: String,
        enum: ["service", "order", "upload", "pricing", "timeline"],
        default: "order"
    }

}, { timestamps: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);