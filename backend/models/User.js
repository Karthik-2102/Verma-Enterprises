const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: String,
    identifier: String,
    password: String,

    // 🔥 MUST
    role: {
        type: String,
        default: "user"
    }
});

module.exports = mongoose.model("User", userSchema);