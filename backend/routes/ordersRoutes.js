const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
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

/* CREATE ORDER */
router.post(
    "/create",
    authMiddleware,
    upload.array("documents", 5),
    createOrder
);

/* USER ORDERS */
router.get(
    "/my-orders",
    authMiddleware,
    getUserOrders
);

/* ADMIN ALL ORDERS */
router.get(
    "/",
    authMiddleware,
    adminMiddleware,
    getAllOrders
);

/* UPDATE STATUS */
router.put(
    "/update/:id",
    authMiddleware,
    adminMiddleware,
    updateOrderStatus
);

/* INVOICE - ALL LOGGED USERS */
router.get(
    "/invoice/:id",
    authMiddleware,
    downloadInvoice
);

/* FINAL WORK UPLOAD - ADMIN */
router.post(
    "/upload-work/:id",
    authMiddleware,
    adminMiddleware,
    upload.single("workFile"),
    uploadFinalWork
);

module.exports = router;