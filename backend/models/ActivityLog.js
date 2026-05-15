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
    },

    category: {
        type: String,
        enum: [
            "service",
            "order",
            "upload",
            "pricing",
            "timeline"
        ],
        default: "order"
    }

}, {
    timestamps: true
});

/* Performance Index */
activityLogSchema.index({ createdAt: -1 });

module.exports =

mongoose.models.ActivityLog ||

mongoose.model(
    "ActivityLog",
    activityLogSchema
);