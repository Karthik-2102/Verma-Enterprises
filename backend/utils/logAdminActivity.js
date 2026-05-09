const AdminLog = require("../models/ActivityLog ");

async function logAdminActivity(
    adminId,
    action,
    details = ""
) {

    try {

        await AdminLog.create({
            admin: adminId,
            action,
            details
        });

    } catch (error) {

        console.log(
            "Admin activity logging failed:",
            error.message
        );

    }

}

module.exports =
logAdminActivity;