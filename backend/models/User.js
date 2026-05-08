const mongoose = require("mongoose");

/* User Schema */

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    identifier: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        default: "user"
    }

}, {
    timestamps: true
});

/* Prevent Model Overwrite */

const User =

mongoose.models.User ||

mongoose.model(
    "User",
    userSchema
);

module.exports = User;