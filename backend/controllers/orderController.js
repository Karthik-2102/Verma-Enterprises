const Order       = require("../models/Order");
const Service     = require("../models/Service");
const User        = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const PDFDocument = require("pdfkit");
const { json } = require("express");

/* =============================================
   CREATE ORDER
   POST /api/orders/create
   ============================================= */
async function createOrder(req, res) {
    try {
        const { serviceId } = req.body;

        if (!serviceId) {
            return res.status(400).json({ success: false, message: "Service ID required" });
        }

        /* Cloudinary returns file.path as secure URL */
        const fileURLs = (req.files || []).map(f => f.path);

        const order = await Order.create({
            user:            req.user.id,
            service:         serviceId,
            files:           fileURLs,
            status:          "pending",
            timelineStage:   "Order Placed",
            timelineHistory: [{ stage: "Order Placed", updatedAt: new Date() }]
        });

        res.json({ success: true, order });

    } catch (err) {
        console.error(
            "Upload work error:",
            err.message || err,
            err.stack || ""
            
        );
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/* =============================================
   GET USER ORDERS
   GET /api/orders/my-orders
   ============================================= */
async function getUserOrders(req, res) {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate("service")
            .populate("user", "name identifier")
            .sort({ createdAt: -1 });

        res.json({ success: true, orders });

    } catch (err) {
        console.error("Get user orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/* =============================================
   GET ALL ORDERS — ADMIN
   GET /api/orders/
   ============================================= */
async function getAllOrders(req, res) {
    try {
        const orders = await Order.find()
            .populate("service")
            .populate("user", "name identifier")
            .sort({ createdAt: -1 });

        res.json({ success: true, orders });

    } catch (err) {
        console.error("Get all orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/* =============================================
   UPDATE ORDER STATUS — ADMIN
   PUT /api/orders/update/:id
   ============================================= */
async function updateOrderStatus(req, res) {
    try {
        const { status, reason } = req.body;

        const updateData = { status };
        if (reason) updateData.reason = reason;

        /* Auto-advance timeline when completing */
        if (status === "completed") {
            updateData.timelineStage = "Completed";
            updateData.$push = {
                timelineHistory: { stage: "Completed", updatedAt: new Date() }
            };
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate("service").populate("user", "name identifier");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        /* Log admin activity */
        const admin = await User.findById(req.user.id);
        await ActivityLog.create({
            admin:     req.user.id,
            adminName: admin?.name || "Admin",
            action:    `Updated order status to "${status}" for ${order.service?.name || "order"}`,
            category:  "order"
        });

        res.json({ success: true, order });

    } catch (err) {
        console.error("Update status error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/* =============================================
   UPLOAD FINAL WORK — ADMIN
   POST /api/orders/upload-work/:id
   ============================================= */
async function uploadFinalWork(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        /* Cloudinary returns secure URL in req.file.path */
        const fileURL = req.file.path;

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { finalWorkFile: fileURL },
            { new: true }
        ).populate("service").populate("user", "name identifier");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        /* Log admin activity */
        const admin = await User.findById(req.user.id);
        await ActivityLog.create({
            admin:     req.user.id,
            adminName: admin?.name || "Admin",
            action:    `Uploaded final work for ${order.service?.name || "order"} (${order.user?.name || "user"})`,
            category:  "upload"
        });

        res.json({ success: true, order });

    } catch (err) {
        console.error(
            "Upload work error;",
            JSON.stringify(
                err,
                null,
                2,
            )
        );
        res.status(500).json({ success: false, message: "Server error" });
    }
}

/* =============================================
   INVOICE GENERATION
   GET /api/orders/invoice/:id
   Generates a branded PDF invoice with PDFKit.

   Install: npm install pdfkit
   ============================================= */
async function downloadInvoice(req, res) {
    try {
        const order = await Order.findById(req.params.id)
            .populate("service")
            .populate("user", "name identifier");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        /* Only completed orders get invoices */
        if (order.status !== "completed") {
            return res.status(400).json({
                success: false,
                message: "Invoice only available for completed orders"
            });
        }

        const service      = order.service;
        const user         = order.user;
        const invoiceDate  = new Date(order.updatedAt || order.createdAt);
        const invoiceNo    = `VE-${new Date().getFullYear()}-${String(order._id).slice(-6).toUpperCase()}`;

        const appCharge    = service?.applicationCharge || service?.basePrice || 0;
        const servCharge   = service?.serviceCharge || 0;
        const total        = service?.finalPrice || (appCharge + servCharge);

        /* PDF Setup */
        const doc = new PDFDocument({
            size: "A4",
            margin: 50,
            info: {
                Title:   `Invoice ${invoiceNo} — Verma Enterprises`,
                Author:  "Verma Enterprises",
                Subject: "Service Invoice"
            }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="VermaEnterprises-Invoice-${invoiceNo}.pdf"`
        );
        doc.pipe(res);

        /* ---- HEADER BACKGROUND ---- */
        doc.rect(0, 0, doc.page.width, 130).fill("#020710");

        /* ---- BRAND NAME ---- */
        doc.fontSize(28)
           .font("Helvetica-Bold")
           .fillColor("#FFFFFF")
           .text("VERMA ENTERPRISES", 50, 38, { align: "left" });

        doc.fontSize(10)
           .font("Helvetica")
           .fillColor("#99BABB")
           .text("All Cyber Cafe Services at One Place", 50, 72);

        /* ---- INVOICE LABEL ---- */
        doc.fontSize(22)
           .font("Helvetica-Bold")
           .fillColor("#D0060D")
           .text("INVOICE", doc.page.width - 180, 40, { align: "right" });

        doc.fontSize(10)
           .font("Helvetica")
           .fillColor("#CCCCCC")
           .text(`Invoice No: ${invoiceNo}`, doc.page.width - 270, 70, { align: "right", width: 220 })
           .text(`Date: ${invoiceDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, { align: "right", width: 220 });

        /* ---- DIVIDER ---- */
        doc.moveTo(50, 135).lineTo(doc.page.width - 50, 135)
           .lineWidth(1).strokeColor("#2C4550").stroke();

        /* ---- BILLING DETAILS ---- */
        let y = 155;

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#99BABB")
           .text("BILLED TO", 50, y);

        doc.fontSize(13).font("Helvetica-Bold").fillColor("#111111")
           .text(user?.name || "Customer", 50, y + 18);

        doc.fontSize(10).font("Helvetica").fillColor("#444444")
           .text(user?.identifier || "", 50, y + 36);

        /* ---- COMPANY DETAILS (right side) ---- */
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#99BABB")
           .text("FROM", doc.page.width - 260, y);

        doc.fontSize(12).font("Helvetica-Bold").fillColor("#111111")
           .text("Verma Enterprises", doc.page.width - 260, y + 18);

        doc.fontSize(9).font("Helvetica").fillColor("#444444")
           .text("Dasarthapur Chowk, Mangalpur Road", doc.page.width - 260, y + 34)
           .text("West Champaran, Bihar — 845105", doc.page.width - 260, y + 48)
           .text("+91 95768 82823(WhatsApp), 9546853220", doc.page.width - 260, y + 62)
           .text("karthikvikash02@gmail.com", doc.page.width - 260, y + 76);

        /* ---- TABLE HEADER ---- */
        const tableTop = y + 110;

        doc.rect(50, tableTop, doc.page.width - 100, 32).fill("#020710");

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#FFFFFF");
        doc.text("Service",            62,  tableTop + 10);
        doc.text("Category",           280, tableTop + 10);
        doc.text("Amount",             doc.page.width - 120, tableTop + 10);

        /* ---- TABLE ROW ---- */
        const rowY = tableTop + 32;
        doc.rect(50, rowY, doc.page.width - 100, 38).fill("#F7F9FA");

        doc.fontSize(11).font("Helvetica").fillColor("#111111");
        doc.text(service?.name || "Service", 62, rowY + 12, { width: 200 });

        doc.fontSize(9).fillColor("#555555")
           .text(service?.category || "Government Services", 280, rowY + 14, { width: 160 });

        doc.fontSize(12).font("Helvetica-Bold").fillColor("#111111")
           .text(`Rs. ${total}`, doc.page.width - 130, rowY + 12, { align: "right", width: 80 });

        /* ---- PRICE BREAKDOWN ---- */
        const breakY = rowY + 55;

        doc.fontSize(9).font("Helvetica").fillColor("#666666")
           .text("Application / Form Charge:", 300, breakY)
           .text(`Rs. ${appCharge}`, doc.page.width - 130, breakY, { align: "right", width: 80 });

        doc.text("Service Charge:", 300, breakY + 16)
           .text(`Rs. ${servCharge}`, doc.page.width - 130, breakY + 16, { align: "right", width: 80 });

        /* ---- TOTAL BOX ---- */
        const totalBoxY = breakY + 38;
        doc.rect(300, totalBoxY, doc.page.width - 350, 36).fill("#020710");

        doc.fontSize(12).font("Helvetica-Bold").fillColor("#FFFFFF")
           .text("TOTAL AMOUNT", 310, totalBoxY + 10);

        doc.fontSize(14).font("Helvetica-Bold").fillColor("#D0060D")
           .text(`Rs. ${total}`, doc.page.width - 130, totalBoxY + 9, { align: "right", width: 80 });

        /* ---- ORDER DETAILS ---- */
        const detY = totalBoxY + 56;
        doc.moveTo(50, detY).lineTo(doc.page.width - 50, detY)
           .lineWidth(.5).strokeColor("#CCCCCC").stroke();

        doc.fontSize(9).font("Helvetica").fillColor("#777777")
           .text(`Order ID: ${order._id}`, 50, detY + 12)
           .text(`Order Date: ${new Date(order.createdAt).toLocaleString("en-IN")}`, 50, detY + 26)
           .text(`Completion Date: ${invoiceDate.toLocaleString("en-IN")}`, 50, detY + 40)
           .text(`Status: Completed`, 50, detY + 54);

        /* ---- DIGITAL SIGNATURE AREA ---- */
        const sigY = detY + 90;
        doc.moveTo(50, sigY).lineTo(doc.page.width - 50, sigY)
           .lineWidth(.5).strokeColor("#CCCCCC").stroke();

        doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
           .text("Authorised Signatory", doc.page.width - 220, sigY + 12);

        doc.fontSize(9).font("Helvetica").fillColor("#777777")
           .text("Verma Enterprises", doc.page.width - 220, sigY + 28)
           .text("(Digitally Verified)", doc.page.width - 220, sigY + 44);

        /* ---- FOOTER ---- */
        const footY = doc.page.height - 70;
        doc.rect(0, footY, doc.page.width, 70).fill("#020710");

        doc.fontSize(9).font("Helvetica").fillColor("#99BABB")
           .text("Thank you for choosing Verma Enterprises.", 50, footY + 14, { align: "center", width: doc.page.width - 100 })
           .text("Mon–Sat · 10 AM – 7 PM  |  +91 95768 82823(WhatsApp), 9546853220  |  karthikvikash02@gmail.com", 50, footY + 30, { align: "center", width: doc.page.width - 100 })
           .text("Dasarthapur Chowk, Mangalpur Road, West Champaran, Bihar 845105", 50, footY + 46, { align: "center", width: doc.page.width - 100 });

        doc.end();

    } catch (err) {
        console.error("Invoice error:", err);
        res.status(500).json({ success: false, message: "Invoice generation failed" });
    }
}

/* =============================================
   PUBLIC STATS — NO AUTH REQUIRED
   GET /api/orders/stats
   ─────────────────────────────────────────────
   Returns live counts from the Order collection.
   Used by the landing page hero stat counters.
   Response shape:
   {
     success: true,
     stats: {
       total:     <number>,   // all orders ever placed
       completed: <number>,   // status === "completed"
       pending:   <number>,   // status === "pending"
       rejected:  <number>    // status === "rejected"
     }
   }
   ============================================= */
async function getPublicStats(req, res) {
    try {
        /* Run all counts in parallel for minimum latency */
        const [total, completed, pending, rejected] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ status: "completed" }),
            Order.countDocuments({ status: "pending" }),
            Order.countDocuments({ status: "rejected" })
        ]);

        res.json({
            success: true,
            stats: { total, completed, pending, rejected }
        });

    } catch (err) {
        console.error("getPublicStats error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = {
    createOrder,
    getUserOrders,
    getAllOrders,
    updateOrderStatus,
    downloadInvoice,
    uploadFinalWork,
    getPublicStats          /* ← new export */
};