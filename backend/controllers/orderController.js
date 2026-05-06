const mongoose = require("mongoose");
const Order = require("../models/Order");

/* ================= CREATE ORDER ================= */
exports.createOrder = async (req, res) => {
    try {
        const { serviceId } = req.body;

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        const filePaths = req.files ? req.files.map(file => file.path) : [];

        const order = await Order.create({
            user: new mongoose.Types.ObjectId(req.user.id),
            service: new mongoose.Types.ObjectId(serviceId),
            files: filePaths,
            status: "pending",
            reason: ""
        });

        res.status(201).json({
            success: true,
            message: "Order submitted successfully",
            order
        });

    } catch (error) {
        console.error("CREATE ORDER ERROR:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/* ================= USER ORDERS ================= */
exports.getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            user: new mongoose.Types.ObjectId(req.user.id)
        })
        .populate("service")
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            orders
        });

    } catch (error) {
        console.error("USER ORDERS ERROR:", error);
        res.status(500).json({
            success: false,
            orders: [],
            message: error.message
        });
    }
};

/* ================= ADMIN ALL ORDERS ================= */
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name identifier")
            .populate("service")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            orders
        });

    } catch (error) {
        console.error("ADMIN ORDERS ERROR:", error);
        res.status(500).json({
            success: false,
            orders: [],
            message: error.message
        });
    }
};

/* ================= UPDATE STATUS ================= */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, reason } = req.body;

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                status,
                reason: reason || ""
            },
            { new: true }
        );

        res.json({
            success: true,
            message: "Order updated successfully",
            order
        });

    } catch (error) {
        console.error("UPDATE ERROR:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
const PDFDocument = require("pdfkit");

exports.downloadInvoice = async (req, res) => {
    try {

        const order = await Order.findById(req.params.id)
            .populate("user")
            .populate("service");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const isAdmin = req.user.role === "admin";
        const isOwner = order.user._id.toString() === req.user.id;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice-${order._id}.pdf`
        );

        res.setHeader("Content-Type", "application/pdf");

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(24).text("Verma Enterprises", { align: "center" });
        doc.moveDown();

        doc.fontSize(16).text("INVOICE / RECEIPT", { align: "center" });
        doc.moveDown(2);

        doc.fontSize(12);
        doc.text(`Invoice ID: ${order._id}`);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
        doc.moveDown();

        doc.text(`Customer Name: ${order.user?.name || "Customer"}`);
        doc.text(`Identifier: ${order.user?.identifier || ""}`);
        doc.moveDown();

        doc.text(`Service: ${order.service?.name || ""}`);
        doc.text(`Amount: INR ₹${order.service?.finalPrice || 0}`);
        doc.text(`Status: ${order.status}`);

        doc.moveDown(3);

        doc.text(`Dear ${order.user?.name || "Customer"},`);
        doc.moveDown();

        doc.text("Thank you for choosing Verma Enterprises.");
        doc.text("We hope we delivered on your expectations.");
        doc.text("Please visit the shop to take your hard copies.");

        doc.end();

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.uploadFinalWork = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file selected"
            });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        order.finalWorkFile = req.file.path;
        await order.save();

        res.json({
            success: true,
            message: "Final work uploaded successfully"
        });

    } catch (error) {
        console.error("UPLOAD WORK ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};