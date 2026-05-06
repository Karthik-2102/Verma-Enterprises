const express = require("express");
const router = express.Router();
const Service = require("../models/Service");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/* GET ALL */
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

/* GET ONE */
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

/* CREATE (ADMIN ONLY) */
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

        res.json({ success: true, service });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* ✅ FIX: UPDATE SERVICE (ADMIN ONLY) — THIS ROUTE WAS MISSING */
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

        res.json({ success: true, service: updatedService });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error ❌" });
    }
});

/* DELETE (ADMIN ONLY) */
router.delete("/delete/:id", authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;