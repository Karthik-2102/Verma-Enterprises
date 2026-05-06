const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

/* ROUTES */
const otpRoutes = require("./routes/otpRoutes");
const authRoutes = require("./routes/authRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const orderRoutes = require("./routes/ordersRoutes");

/* MIDDLEWARE */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ROUTES USE */
app.use("/api/otp", otpRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/orders", orderRoutes);

/* DB */
mongoose.connect(process.env.MONGO_URI)
.then(()=> console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));

app.listen(5000, ()=> console.log("Server running on 5000"));