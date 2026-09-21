import { Router } from 'express';
const router = Router();
import PersonalLead from '../models/PersonalLead.js';

// Create a new Personal Lead
router.post('/addPersonalLead', async (req, res) => {
  try {
    const { phone, assignedTo } = req.body;

    // ❗ Optional: handle empty assignedTo (fix your previous error too)
    const assignedUser = assignedTo || null;

    // 🔍 Check if lead already exists for same phone + assignedTo
    const existingLead = await PersonalLead.findOne({
      phone: phone,
      assignedTo: assignedUser
    });

    if (existingLead) {
      return res.status(400).json({
        message: "This phone number is already assigned to this user"
      });
    }

    // ✅ Create new lead
    const Plead = new PersonalLead({
      ...req.body,
      assignedTo: assignedUser
    });

    await Plead.save();

    res.status(201).json({
      message: "Lead created successfully",
      lead: Plead
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Get all Personal Leads of a particular user
router.get('/personalLeads/:id', async (req, res) => {
  try {
    const leads = await PersonalLead.find({ assignedTo: req.params.id })
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all Personal Leads
router.get('/personalLeads', async (req, res) => {
  try {
    const leads = await PersonalLead.find()
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get one Personal Lead details
router.get('/personalLead/:id', async (req, res) => {
  try {
    const lead = await PersonalLead.find({ _id: req.params.id })
    res.json(lead[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a lead
router.put('/personalLead/:id', async (req, res) => {
  try {
    const lead = await PersonalLead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(lead[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//  Delete a lead
router.delete('/personalLead/:id', async (req, res) => {
  try {
    await PersonalLead.findByIdAndDelete({ _id: req.params.id });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
