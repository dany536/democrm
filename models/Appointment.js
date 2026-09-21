// models/Appointment.js
import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true }, // appointment or callback time
    type: { type: String, enum: ["appointment", "callback"], default: "callback" },
    createdAt: { type: Date, default: Date.now },
    reminderSent: { type: Boolean, default: false },
    remark: { type: String } // added remark field
});

export default mongoose.model("Appointment", appointmentSchema);
