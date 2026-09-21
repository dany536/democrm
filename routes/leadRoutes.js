import "dotenv/config";
import { Router } from 'express';
const router = Router();
import Lead from '../models/Lead.js';
import AppointmentLead from '../models/AppointmentLead.js';
import Employee from '../models/Employee.js';
import LeadHistory from '../models/LeadHistory.js';
import RoundRobin from '../models/RoundRobin.js';
import twilio from 'twilio';
import EmployeeLeadHistory from '../models/EmployeeLeadHistory.js';

// Load the team configuration mapping
import { teamProjectMapping } from '../config/teams.js';

// Secure credentials using environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // Twilio Sandbox number

const client = new twilio(accountSid, authToken);

// Utility function to handle WhatsApp Notifications safely
const sendWhatsAppNotification = async (employee, lead) => {
  try {
    await client.messages.create({
      contentSid: 'HX048ac60e3c7de01189d7462339d0a4a1',
      contentVariables: JSON.stringify({
        '1': employee.name,
        '2': lead.name,
        '3': lead.phone?.toString() || '',
        '4': lead.project?.toString() || '',
        '5': lead.data_source?.toString() || '',
        '6': lead.email?.toString() || ''
      }),
      from: whatsappFrom,
      to: `whatsapp:+91${employee.phone}`
    });
    console.log(`WhatsApp notification successfully sent to ${employee.name} (${employee.phone})`);
  } catch (err) {
    console.error(`WhatsApp Alert Failed for ${employee.name}:`, err.message);
  }
};

// ==========================================
// CORE ROUTES
// ==========================================

// Create a new Appointment Lead
router.post('/addAppointment', async (req, res) => {
  try {
    const appointmentLead = new AppointmentLead(req.body);
    await appointmentLead.save();
    res.status(201).json(appointmentLead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Single Dynamic Lead Generation & Routing Endpoint (Replaces all individual project /addLead paths)
router.post('/addLead', async (req, res) => {
  try {
    const { phone, assignedTo, project } = req.body;

    // 1. Enforce unique check across active phone numbers
    const existingLead = await Lead.findOne({ phone });
    if (existingLead) {
      return res.status(400).json({ message: 'Contact number already exists' });
    }

    let employee;

    // 2. Direct Explicit Assignment Bypass
    if (assignedTo) {
      employee = await Employee.findById(assignedTo);
      if (!employee) {
        return res.status(404).json({ message: "Requested explicit employee assignment target not found" });
      }
    }
    // 3. Dynamic Team Round-Robin Logic based on incoming Project parameter
    else {
      // Find which team owns the incoming project configuration
      const targetTeamConfig = teamProjectMapping.find(config =>
        config.projects.some(p => p.toLowerCase() === (project || "").toLowerCase().trim())
      );

      // Fallback fallback mechanism if project isn't explicitly configured inside config/teams.js
      const allowedEmployeeNames = targetTeamConfig
        ? targetTeamConfig.allowedEmployees
        : ["Kirandeep Kaur"]; // Global fallback agent array

      const teamIdentifier = targetTeamConfig ? targetTeamConfig.teamName : "Global_Fallback";

      // Query database for match pools
      const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
      if (employees.length === 0) {
        return res.status(400).json({ message: `No active systemic employees found inside designated pool: ${teamIdentifier}` });
      }

      // Atomic pointer configuration unique to each calculated team context
      let rr = await RoundRobin.findOne({ teamName: teamIdentifier });
      if (!rr) {
        rr = await RoundRobin.create({ teamName: teamIdentifier, pointer: 0 });
      }

      // Safe bounds evaluation wrap-around (protects against team array alterations mid-runtime)
      let currentPointer = rr.pointer;
      if (currentPointer >= employees.length) {
        currentPointer = 0;
      }

      employee = employees[currentPointer];

      // Mutate and save Round Robin tracking document indices incrementally
      rr.pointer = (currentPointer + 1) % employees.length;
      await rr.save();

      req.body.assignedTo = employee._id;
    }

    // 4. Persistence Phase
    const lead = new Lead(req.body);
    await lead.save();

    // 5. Fire Dispatch Tasks Asynchronously 
    sendWhatsAppNotification(employee, lead);

    // 6. Append History Entries Log
    await LeadHistory.create({
      leadId: lead._id,
      employeeName: employee.name,
      remark: 'New lead successfully added and automatically sorted',
      status: lead.status,
      lastAssignedDate: lead.lastAssignedDate,
      lastStatusUpdate: lead.lastStatusUpdate
    });

    // 7. Append Employee Lead History Log
    await EmployeeLeadHistory.create({
      leadId: lead._id,
      employeeId: employee._id,
      leadName: lead.name,
      lastAssignDate: new Date(),
      leadNumber: lead.phone,
      project: lead.project
    });

    res.status(201).json({
      message: "Lead processed and assigned successfully",
      lead
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk Lead Integration Entry-Point (Refactored to mirror identical processing maps safely)
router.post('/bulkAddLead', async (req, res) => {
  try {
    const { phone, assignedTo, project } = req.body;

    const existingLead = await Lead.findOne({ phone });
    if (existingLead) {
      return res.status(400).json({ message: 'Contact number validation conflict: details already recorded' });
    }

    let employee;

    if (assignedTo) {
      employee = await Employee.findById(assignedTo);
      if (!employee) return res.status(404).json({ message: "Assigned employee not found" });
    } else {
      const targetTeamConfig = teamProjectMapping.find(config =>
        config.projects.some(p => p.toLowerCase() === (project || "").toLowerCase().trim())
      );

      const allowedEmployeeNames = targetTeamConfig ? targetTeamConfig.allowedEmployees : ["Kirandeep Kaur", "Sammeer Ajmani"];
      const teamIdentifier = targetTeamConfig ? targetTeamConfig.teamName : "Bulk_Fallback";

      const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
      if (employees.length === 0) return res.status(400).json({ message: "No operational team entities available" });

      let rr = await RoundRobin.findOne({ teamName: teamIdentifier });
      if (!rr) rr = await RoundRobin.create({ teamName: teamIdentifier, pointer: 0 });

      let currentPointer = rr.pointer >= employees.length ? 0 : rr.pointer;
      employee = employees[currentPointer];

      rr.pointer = (currentPointer + 1) % employees.length;
      await rr.save();

      req.body.assignedTo = employee._id;
    }

    const lead = new Lead(req.body);
    await lead.save();

    await LeadHistory.create({
      leadId: lead._id,
      employeeName: employee.name,
      remark: 'Bulk upload registration finished',
      status: lead.status,
      lastAssignedDate: lead.lastAssignedDate,
      lastStatusUpdate: lead.lastStatusUpdate
    });

    await EmployeeLeadHistory.create({
      leadId: lead._id,
      employeeId: employee._id,
      leadName: lead.name,
      lastAssignDate: new Date(),
      leadNumber: lead.phone,
      project: lead.project
    });

    res.status(201).json({ message: "Lead added successfully via dynamic bulk engine", lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// FETCHING & UTILITY ROUTING LAYER
// ==========================================

// Get all leads sorted by newest first
router.get('/leads', async (req, res) => {
  try {
    const leads = await Lead.find().populate('assignedTo').sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get context ledger history for unique lead targets
router.get('/leadHistory/:id', async (req, res) => {
  try {
    const leads = await LeadHistory.find({ leadId: req.params.id }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get context ledger history for unique employee targets
router.get('/employeeLeadHistory/:id', async (req, res) => {
  try {
    const leads = await EmployeeLeadHistory.find({ employeeId: req.params.id }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin structural data outputs
router.get('/leadsadmin', async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Filter leads exclusively assigned to an individual staff identification signature
router.get('/leadsadmin/:id', async (req, res) => {
  try {
    const leads = await Lead.find({ assignedTo: req.params.id }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Isolate and identify a specific single lead
router.get('/lead/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedTo');
    if (!lead) return res.status(404).json({ message: "Lead instance not found" });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update an individual lead's state
router.put('/lead/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: "Lead instance target modification path failed" });

    res.json(lead);

    // Context execution tracker processing block
    const employee = await Employee.findById(lead.assignedTo);
    if (employee) {
      await LeadHistory.create({
        leadId: lead._id,
        employeeName: employee.name,
        remark: lead.remark || 'Lead status details updated manually',
        dateOfLead: lead.dateOfLead,
        status: lead.status,
        lastAssignedDate: lead.lastAssignedDate,
        lastStatusUpdate: lead.lastStatusUpdate
      });
    }
    if (employee) {
      await EmployeeLeadHistory.findOneAndUpdate(
        {
          employeeId: employee._id,
          leadId: lead._id
        },
        {
          $set: {
            lastAssignDate: lead.lastAssignedDate
          },
          $setOnInsert: {
            leadName: lead.name,
            leadNumber: lead.phone,
            project: lead.project
          }
        },
        {
          new: true,
          upsert: true
        }
      );
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a targeted pipeline lead entry
router.delete('/lead/:id', async (req, res) => {
  try {
    const status = await Lead.findByIdAndDelete(req.params.id);
    if (!status) return res.status(404).json({ message: "Item was missing or removed previously" });
    res.json({ message: 'Lead deleted permanently' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve Employee Headers validation indexes safely
router.get('/employeeHeader/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (employee) return res.json(employee._id);

    const lead = await Lead.findById(id);
    if (lead) return res.json(lead.assignedTo);

    return res.status(404).json("Not found any thing");
  } catch (error) {
    console.error("Error resolving ID parameters inside route context wrapper:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;