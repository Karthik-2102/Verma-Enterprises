const mongoose = require("mongoose");

/* Order Timeline Stages */
const TIMELINE_STAGES = [
    "Order Placed",
    "Documents Verified",
    "Processing",
    "Ready for Delivery",
    "Completed"
];

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

    /* Timeline Stage Tracking */
    timelineStage: {
        type: String,
        enum: TIMELINE_STAGES,
        default: "Order Placed"
    },

    /* Timeline History with Timestamps */
    timelineHistory: [{
        stage: { type: String },
        updatedAt: { type: Date, default: Date.now }
    }],

    reason: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

/* Performance Indexes */
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.TIMELINE_STAGES = TIMELINE_STAGES;