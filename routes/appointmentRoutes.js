// routes/appointmentRoutes.js
import express from "express";
import Appointment from "../models/Appointment.js";

const router = express.Router();

// Create appointment/callback
router.post("/appointment", async (req, res) => {
    try {
        const { leadId, employeeId, date, type, remark } = req.body;

        const appointment = new Appointment({
            leadId,
            employeeId,
            date: new Date(date),
            type,
            remark
        });

        await appointment.save();
        console.log("Appointment created:", appointment);
        res.status(201).json({ message: "Appointment created successfully", appointment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const leads = await Appointment.find({ employeeId: req.params.id }).populate("leadId").sort({ createdAt: -1 });
    //const leads = await Appointment.find().populate('assignedTo').sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const leads = await Appointment.find().populate("leadId").populate("employeeId").sort({ createdAt: -1 });
    //const leads = await Appointment.find().populate('assignedTo').sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a appointment
router.delete('/appointment/:id', async (req, res) => {
  try {
    await Appointment.findByIdAndDelete({ _id: req.params.id });
    res.json({ message: 'Appointment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
