const express = require("express");
const router = express.Router();

const { upload } = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const {
    createOrder,
    getUserOrders,
    getAllOrders,
    updateOrderStatus,
    downloadInvoice,
    uploadFinalWork
} = require("../controllers/orderController");

const Order = require("../models/Order");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

/* Order Creation */
router.post(
    "/create",
    authMiddleware,
    upload.array("documents", 5),
    createOrder
);

/* User Order List */
router.get(
    "/my-orders",
    authMiddleware,
    getUserOrders
);

/* Admin: All Orders */
router.get(
    "/",
    authMiddleware,
    adminMiddleware,
    getAllOrders
);

/* Admin: Update Order Status */
router.put(
    "/update/:id",
    authMiddleware,
    adminMiddleware,
    updateOrderStatus
);

/* Invoice Download — Authenticated Users */
router.get(
    "/invoice/:id",
    authMiddleware,
    downloadInvoice
);

/* Admin: Upload Final Work */
router.post(
    "/upload-work/:id",
    authMiddleware,
    adminMiddleware,
    upload.single("workFile"),
    uploadFinalWork
);

/* Admin: Update Order Timeline Stage */
router.put(
    "/timeline/:id",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const { timelineStage } = req.body;

            const validStages = [
                "Order Placed",
                "Documents Verified",
                "Processing",
                "Ready for Delivery",
                "Completed"
            ];

            if (!validStages.includes(timelineStage)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid timeline stage"
                });
            }

            const order = await Order.findByIdAndUpdate(
                req.params.id,
                {
                    timelineStage,
                    $push: {
                        timelineHistory: {
                            stage: timelineStage,
                            updatedAt: new Date()
                        }
                    }
                },
                { new: true }
            ).populate("service").populate("user");

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            /* Log Admin Activity */
            const admin = await User.findById(req.user.id);
            await ActivityLog.create({
                admin: req.user.id,
                adminName: admin?.name || "Admin",
                action: `Updated order timeline to "${timelineStage}" for ${order.service?.name || "order"}`,
                category: "timeline"
            });

            res.json({ success: true, order });

        } catch (err) {
            console.error("Timeline update error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

/* Admin: Activity Logs */
router.get(
    "/activity-logs",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const { search } = req.query;
            let filter = {};

            if (search) {
                filter.action = { $regex: search, $options: "i" };
            }

            const logs = await ActivityLog.find(filter)
                .sort({ createdAt: -1 })
                .limit(100);

            res.json({ success: true, logs });
        } catch (err) {
            console.error("Activity log fetch error:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

module.exports = router;