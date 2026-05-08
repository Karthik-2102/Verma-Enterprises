const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema({
    stage: {
        type: String,
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: null
    }
}, { _id: false });

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

    timeline: {
        type: [timelineSchema],
        default: [
            {
                stage: "Order Placed",
                completed: true,
                updatedAt: new Date()
            },
            {
                stage: "Documents Verified"
            },
            {
                stage: "Processing"
            },
            {
                stage: "Ready for Delivery"
            },
            {
                stage: "Completed"
            }
        ]
    },

    reason: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    "Order",
    orderSchema
);