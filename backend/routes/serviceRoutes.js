const express = require("express");
const router = express.Router();
const Service = require("../models/Service");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/* Service List with Category and Search Filters */
router.get("/", async (req, res) => {
    try {
        const { category, search } = req.query;

        let filter = {};

        if (category && category !== "all") {
            filter.category = category;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } }
            ];
        }

        const services = await Service.find(filter).sort({ createdAt: -1 });
        res.json(services);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* Single Service by ID */
router.get("/:id", async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }
        res.json(service);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* Create Service (Admin Only) */
router.post("/create", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            name,
            basePrice,
            finalPrice,
            applicationCharge,
            serviceCharge,
            documents,
            category
        } = req.body;

        const service = await Service.create({
            name,
            basePrice: basePrice || applicationCharge || 0,
            finalPrice: finalPrice || (applicationCharge + serviceCharge) || 0,
            applicationCharge: applicationCharge || basePrice || 0,
            serviceCharge: serviceCharge || 0,
            documents: documents || [],
            category: category || "Government Services"
        });

        /* Log Activity */
        const admin = await User.findById(req.user.id);
        await ActivityLog.create({
            admin: req.user.id,
            adminName: admin?.name || "Admin",
            action: `Added service: ${name}`,
            category: "service"
        });

        res.json({ success: true, service });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* Update Service (Admin Only) */
router.put("/update/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            name,
            basePrice,
            finalPrice,
            applicationCharge,
            serviceCharge,
            documents,
            category
        } = req.body;

        const updatedService = await Service.findByIdAndUpdate(
            req.params.id,
            {
                name,
                basePrice: basePrice || applicationCharge || 0,
                finalPrice: finalPrice || (applicationCharge + serviceCharge) || 0,
                applicationCharge: applicationCharge || basePrice || 0,
                serviceCharge: serviceCharge || 0,
                documents: documents || [],
                category: category || "Government Services"
            },
            { new: true }
        );

        if (!updatedService) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        /* Log Pricing Update Activity */
        const admin = await User.findById(req.user.id);
        await ActivityLog.create({
            admin: req.user.id,
            adminName: admin?.name || "Admin",
            action: `Updated service: ${name} (₹${(applicationCharge || basePrice || 0) + (serviceCharge || 0)} total)`,
            category: "pricing"
        });

        res.json({ success: true, service: updatedService });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* Delete Service (Admin Only) */
router.delete("/delete/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);

        /* Log Deletion Activity */
        const admin = await User.findById(req.user.id);
        await ActivityLog.create({
            admin: req.user.id,
            adminName: admin?.name || "Admin",
            action: `Deleted service: ${service?.name || req.params.id}`,
            category: "service"
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;