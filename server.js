import "dotenv/config";
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import leadRoutes from './routes/leadRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import personalLeadRoutes from './routes/personalRoutes.js';
import appointmentRoutes from "./routes/appointmentRoutes.js";
import path from 'path';
import cron from "node-cron";
import twilio from 'twilio';

import Lead from './models/Lead.js';
import Employee from './models/Employee.js';
import LeadHistory from './models/LeadHistory.js';
import Appointment from "./models/Appointment.js";
import EmployeeLeadHistory from "./models/EmployeeLeadHistory.js";


const PORT = process.env.PORT || 5000

const app = express();
app.use(express.json());
app.use(cookieParser())

// write a number of leads to be suffle daily
const leadCount = 400;
const notAssignLeadCount = 10;
const allowedEmployeeNames = ["All Leads"]; // Add more names as needed for daily suffling


//orginal
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // Twilio Sandbox number
const client = new twilio(accountSid, authToken);

const corsOptions = {
    origin: 'http://localhost:5173',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200,
}


// When deploy project
//app.use(cors());

// When run locally project
app.use(cors(corsOptions));

// Database email : deepankar@veroestate.in (Testing Database) (Dummy)
mongoose.connect("mongodb+srv://deepankar:yzQ5wZnfjyXN9VKY@demolead.x51vsvt.mongodb.net/?retryWrites=true&w=majority&appName=DemoLead")
    .then(() => console.log("Database is connected"))
    .catch((error) => console.log(error));

app.use('/', leadRoutes);
app.use('/', employeeRoutes);
app.use('/', personalLeadRoutes);


app.get('/test', (req, res) => {
    res.json({ message: 'Backend Connected Successfully!' });
});


const varifyUser = (req, res, next) => {
    console.log("we are in verify user")
    const accesstoken = req.cookies.accessToken;
    if (!accesstoken) {
        // if(renewToken(req, res)) {
        //     next()
        // }
    } else {
        jwt.verify(accesstoken, 'jwt-access-token-secret-key', (err, decoded) => {
            if (err) {
                return res.json({ valid: false, message: "Invalid Token" })
            } else {
                req.id = decoded.id
                next()
            }
        })
    }
}

app.get('/dashboard', varifyUser, (req, res) => {
    return res.json({ valid: true, message: "authorized" })
})


async function transferLeads() {
    try {
        const leads = await Lead.find({
            status: ['Did Not Answer', 'Switched Off', 'Incoming Not Available', 'Busy', 'Call Cut', 'No Available', 'Call Later']
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });


        // const availableEmployees = employees.slice(0, -8); // Exclude last 8
        // const availableEmployees = employees.slice(2, 5); // 3rd to 5th position (index 2, 3, 4)
        const availableEmployees = employees; // Use all allowed employees
        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;
        console.log(availableEmployees);

        for (const lead of leads) {
            if (transferredCount >= leadCount) break; // Stop after transferring given number of leads

            const daysSinceAssignment = Math.floor((currentDate - lead.lastAssignedDate) / (1000 * 60 * 60 * 24));

            if (daysSinceAssignment >= 7) {
                var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

                // Handle case where current assigned employee is not in the availableEmployees list
                if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

                const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
                const newEmployee = availableEmployees[newEmployeeIndex];

                lead.assignedTo = newEmployee._id;
                lead.lastAssignedDate = currentDate;
                lead.status = "No Update";
                lead.remark = "";
                await lead.save();

                const leadHistory = new LeadHistory({
                    leadId: lead._id,
                    employeeName: newEmployee.name,
                    remark: "Lead Transfer",
                    status: lead.status,
                    lastAssignedDate: lead.lastAssignedDate,
                    lastStatusUpdate: lead.lastStatusUpdate
                });
                await leadHistory.save();

                // Append Employee Lead History Log
                await EmployeeLeadHistory.findOneAndUpdate(
                    {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    },
                    {
                        $set: {
                            leadName: lead.name,
                            lastAssignDate: new Date(),
                            leadNumber: lead.phone,
                            project: lead.project
                        },
                        $setOnInsert: {
                            employeeId: newEmployee._id,
                            leadId: lead._id
                        }
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                console.log(`Lead ${lead.name} transferred to employee ${newEmployee.name}`);
                employeeIndex = (employeeIndex + 1) % availableEmployees.length;
                transferredCount++;
            }
        }

        console.log(`Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in lead transfer process:', error);
    }
}

async function transferNotInterestedLeads() {
    try {
        const leads = await Lead.find({
            status: ['Not Interested']
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
        const availableEmployees = employees; // Use all allowed employees

        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;

        for (const lead of leads) {
            if (transferredCount >= leadCount) break; // Stop after transferring 20 leads

            const daysSinceAssignment = Math.floor((currentDate - lead.lastAssignedDate) / (1000 * 60 * 60 * 24));

            if (daysSinceAssignment >= 7) {
                var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

                // Handle case where current assigned employee is not in the availableEmployees list
                if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

                const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
                const newEmployee = availableEmployees[newEmployeeIndex];

                lead.assignedTo = newEmployee._id;
                lead.lastAssignedDate = currentDate;
                lead.status = "No Update";
                lead.remark = "";
                await lead.save();

                const leadHistory = new LeadHistory({
                    leadId: lead._id,
                    employeeName: newEmployee.name,
                    remark: "Lead transfer",
                    status: lead.status,
                    lastAssignedDate: lead.lastAssignedDate,
                    lastStatusUpdate: lead.lastStatusUpdate
                });
                await leadHistory.save();

                // Append Employee Lead History Log
                await EmployeeLeadHistory.findOneAndUpdate(
                    {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    },
                    {
                        $set: {
                            leadName: lead.name,
                            lastAssignDate: new Date(),
                            leadNumber: lead.phone,
                            project: lead.project
                        },
                        $setOnInsert: {
                            employeeId: newEmployee._id,
                            leadId: lead._id
                        }
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                console.log(`Lead ${lead.name} transferred to employee ${newEmployee.name}`);
                employeeIndex = (employeeIndex + 1) % availableEmployees.length;
                transferredCount++;
            }
        }

        console.log(`Not Interested Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in lead transfer process:', error);
    }
}

async function transferNoUpdateLeads() {
    try {
        const leads = await Lead.find({
            status: ['No Update']
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
        const availableEmployees = employees; // Use all allowed employees

        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;

        for (const lead of leads) {
            if (transferredCount >= leadCount) break;

            const daysSinceAssignment = Math.floor((currentDate - lead.lastAssignedDate) / (1000 * 60 * 60 * 24));

            if (daysSinceAssignment >= 2) {
                var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

                // Handle case where current assigned employee is not in the availableEmployees list
                if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

                const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
                const newEmployee = availableEmployees[newEmployeeIndex];

                lead.assignedTo = newEmployee._id;
                lead.lastAssignedDate = currentDate;
                lead.status = "No Update";
                lead.remark = "";
                await lead.save();

                const leadHistory = new LeadHistory({
                    leadId: lead._id,
                    employeeName: newEmployee.name,
                    remark: "Lead transfer",
                    status: lead.status,
                    lastAssignedDate: lead.lastAssignedDate,
                    lastStatusUpdate: lead.lastStatusUpdate
                });
                await leadHistory.save();

                // Append Employee Lead History Log
                await EmployeeLeadHistory.findOneAndUpdate(
                    {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    },
                    {
                        $set: {
                            leadName: lead.name,
                            lastAssignDate: new Date(),
                            leadNumber: lead.phone,
                            project: lead.project
                        },
                        $setOnInsert: {
                            employeeId: newEmployee._id,
                            leadId: lead._id
                        }
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                console.log(`Lead ${lead.name} transferred to employee ${newEmployee.name}`);
                employeeIndex = (employeeIndex + 1) % availableEmployees.length;
                transferredCount++;
            }
        }

        console.log(`NoUpdate Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in lead transfer process:', error);
    }
}

async function transferFollowUpLeads() {
    try {
        const leads = await Lead.find({
            status: ['In Follow Up']
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
        const availableEmployees = employees; // Use all allowed employees

        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;

        for (const lead of leads) {
            if (transferredCount >= leadCount) break;

            const daysSinceUpdate = Math.floor((currentDate - lead.lastStatusUpdate) / (1000 * 60 * 60 * 24));

            if (daysSinceUpdate >= 15) {
                var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

                // Handle case where current assigned employee is not in the availableEmployees list
                if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

                const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
                const newEmployee = availableEmployees[newEmployeeIndex];

                lead.assignedTo = newEmployee._id;
                lead.lastAssignedDate = currentDate;
                // lead.lastStatusUpdate = currentDate;
                lead.remark = "";
                lead.status = "No Update";
                await lead.save();

                const leadHistory = new LeadHistory({
                    leadId: lead._id,
                    employeeName: newEmployee.name,
                    remark: "Lead transfer",
                    status: lead.status,
                    lastAssignedDate: lead.lastAssignedDate,
                    lastStatusUpdate: lead.lastStatusUpdate
                });
                await leadHistory.save();

                // Append Employee Lead History Log
                await EmployeeLeadHistory.findOneAndUpdate(
                    {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    },
                    {
                        $set: {
                            leadName: lead.name,
                            lastAssignDate: new Date(),
                            leadNumber: lead.phone,
                            project: lead.project
                        },
                        $setOnInsert: {
                            employeeId: newEmployee._id,
                            leadId: lead._id
                        }
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                console.log(`Follow Up Lead ${lead.name} transferred to employee ${newEmployee.name}`);
                employeeIndex = (employeeIndex + 1) % availableEmployees.length;
                transferredCount++;
            }
        }

        console.log(`In Follow Up Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in In Follow Up Lead transfer process:', error);
    }
}

async function transferFutureProspectLeads() {
    try {
        const leads = await Lead.find({
            status: ['Future Prospect']
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
        const availableEmployees = employees; // Use all allowed employees

        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;

        for (const lead of leads) {
            if (transferredCount >= leadCount) break;

            const dayslastStatusUpdate = Math.floor((currentDate - lead.lastStatusUpdate) / (1000 * 60 * 60 * 24));

            if (dayslastStatusUpdate > 60) {
                var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

                // Handle case where current assigned employee is not in the availableEmployees list
                if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

                const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
                const newEmployee = availableEmployees[newEmployeeIndex];

                lead.assignedTo = newEmployee._id;
                lead.lastAssignedDate = currentDate;
                // lead.lastStatusUpdate = currentDate;
                lead.status = "No Update";
                lead.remark = "";
                await lead.save();

                const leadHistory = new LeadHistory({
                    leadId: lead._id,
                    employeeName: newEmployee.name,
                    remark: "Lead transfer",
                    status: lead.status,
                    lastAssignedDate: lead.lastAssignedDate,
                    lastStatusUpdate: lead.lastStatusUpdate
                });
                await leadHistory.save();

                // Append Employee Lead History Log
                await EmployeeLeadHistory.findOneAndUpdate(
                    {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    },
                    {
                        $set: {
                            leadName: lead.name,
                            lastAssignDate: new Date(),
                            leadNumber: lead.phone,
                            project: lead.project
                        },
                        $setOnInsert: {
                            employeeId: newEmployee._id,
                            leadId: lead._id
                        }
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                console.log(`Future Prospect Lead ${lead.name} transferred to employee ${newEmployee.name}`);
                employeeIndex = (employeeIndex + 1) % availableEmployees.length;
                transferredCount++;
            }
        }

        console.log(`Future Prospect Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in Future Prospect Lead transfer process:', error);
    }
}

async function transferDeleteLeads() {
    try {
        const leads = await Lead.find({
            status: ['Spam', 'Broker', 'Invalid Number']
        });

        for (const lead of leads) {
            console.log(`Lead with name : ${lead.name} Deleted`)
            await Lead.findByIdAndDelete(lead._id);
        }
        console.log('Lead Deletion process completed');
    } catch (error) {
        console.error('Error in lead deletion process:', error);
    }
}

async function transferLeadsToJunkEmployee() {
    try {
        // Find the "Junk Leads" employee
        const junkEmployee = await Employee.findOne({ name: "Junk Leads" });

        if (!junkEmployee) {
            console.log('No employee found with name "Junk Leads"');
            return;
        }

        const currentDate = new Date();

        // Get leads that are Spam, Broker, or Invalid Number
        // and are NOT already assigned to Junk Leads
        const leads = await Lead.find({
            status: { $in: ['Spam', 'Broker', 'Invalid Number'] },
            assignedTo: { $ne: junkEmployee._id }
        });

        if (!leads.length) {
            console.log("No leads to transfer");
            return;
        }

        const bulkOps = [];
        const historyDocs = [];

        for (const lead of leads) {

            // Find previous employee
            const previousEmployee = lead.assignedTo
                ? await Employee.findById(lead.assignedTo)
                : null;

            // Update Lead
            bulkOps.push({
                updateOne: {
                    filter: {
                        _id: lead._id,
                        assignedTo: { $ne: junkEmployee._id }
                    },
                    update: {
                        $set: {
                            assignedTo: junkEmployee._id,
                            lastAssignedDate: currentDate
                        }
                    }
                }
            });

            // Lead History
            historyDocs.push({
                leadId: lead._id,
                employeeName: previousEmployee
                    ? previousEmployee.name
                    : "Unknown",
                remark: "Lead transferred to Junk Leads for spam check",
                status: lead.status,
                lastAssignedDate: currentDate,
                lastStatusUpdate: lead.lastStatusUpdate
            });

            // Employee Lead History
            await EmployeeLeadHistory.findOneAndUpdate(
                {
                    employeeId: junkEmployee._id,
                    leadId: lead._id
                },
                {
                    $set: {
                        leadName: lead.name,
                        lastAssignDate: currentDate,
                        leadNumber: lead.phone,
                        project: lead.project
                    },
                    $setOnInsert: {
                        employeeId: junkEmployee._id,
                        leadId: lead._id
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );
        }

        // Bulk update leads
        if (bulkOps.length > 0) {
            await Lead.bulkWrite(bulkOps);
        }

        // Insert Lead History
        if (historyDocs.length > 0) {
            await LeadHistory.insertMany(historyDocs);
        }

        console.log(
            `${bulkOps.length} leads transferred to employee "Junk Leads" (${junkEmployee._id})`
        );

    } catch (error) {
        console.error(
            'Error in lead transfer to junk employee:',
            error
        );
    }
}

async function transferNotAssignedLeads() {
    try {
        const leads = await Lead.find({
            assignedTo: [null]
        });

        // Get employees from DB
        const employees = await Employee.find({ name: { $in: allowedEmployeeNames } });
        const availableEmployees = employees; // Use all allowed employees

        const currentDate = new Date();
        let employeeIndex = 0;
        let transferredCount = 0;

        for (const lead of leads) {
            if (transferredCount >= notAssignLeadCount) break; // Stop after transferring given number of leads

            var currentEmployeeIndex = availableEmployees.findIndex(emp => emp._id.equals(lead.assignedTo));

            // Handle case where current assigned employee is not in the availableEmployees list
            if (currentEmployeeIndex === -1) currentEmployeeIndex = 0;

            const newEmployeeIndex = (currentEmployeeIndex + employeeIndex) % availableEmployees.length;
            const newEmployee = availableEmployees[newEmployeeIndex];

            lead.assignedTo = newEmployee._id;
            lead.lastAssignedDate = currentDate;
            lead.status = "No Update";
            lead.remark = "";
            await lead.save();

            const leadHistory = new LeadHistory({
                leadId: lead._id,
                employeeName: newEmployee.name,
                remark: "Lead Transfer",
                status: lead.status,
                lastAssignedDate: lead.lastAssignedDate,
                lastStatusUpdate: lead.lastStatusUpdate
            });
            await leadHistory.save();

            // Append Employee Lead History Log
            await EmployeeLeadHistory.findOneAndUpdate(
                {
                    employeeId: newEmployee._id,
                    leadId: lead._id
                },
                {
                    $set: {
                        leadName: lead.name,
                        lastAssignDate: new Date(),
                        leadNumber: lead.phone,
                        project: lead.project
                    },
                    $setOnInsert: {
                        employeeId: newEmployee._id,
                        leadId: lead._id
                    }
                },
                {
                    upsert: true,
                    new: true
                }
            );

            console.log(`Lead ${lead.name} transferred to employee ${newEmployee.name}`);
            employeeIndex = (employeeIndex + 1) % availableEmployees.length;
            transferredCount++;
        }

        console.log(`Not Assigned Lead transfer process completed. ${transferredCount} leads transferred.`);
    } catch (error) {
        console.error('Error in lead transfer process:', error);
    }
}

//Schedule lead transfer every day at midnight
// stop suffling for a week - 9/4/25
// again start suffling -30/05/2025
cron.schedule('0 0 * * *', async () => {
    console.log('Running lead transfer job');
    transferLeads();
    transferNotInterestedLeads();
    transferNoUpdateLeads();
    transferFollowUpLeads();
    transferFutureProspectLeads();
    transferLeadsToJunkEmployee();

    // transferDeleteLeads();
});

// This function is used to assign fix leads to particular employee
// 1 Amit 11-15
// 2 Kirandeep 25-30
// 3 All lead index
// 4 Sammeer Sir
// 5 Harneet
// 6 Junks
// 7 prashant
// 8 Sachin - 75
// 9 Vaibhav - 75
// 10 Indrajit - 100
// 11 kawaldeep - 20


async function transferManualLeads() {
    try {
        const leads = await Lead.find({
            status: "No Update",
            // data_source: "RM",
            // project: ["-", "M3M Plot", "DAXIN VISTAS", "Signature Global Cloverdale"]
            // project: ["Dharam Sons floor - KD", "Laburnum", "Oberoi 360 North", "paras quartier sammeer sir", "Dharamson Floor", "SJP"]
            // project: /paras quartier/i // Regex to match project names containing "paras quartier"  
            // project: "Elie Saab" // Example: Only transfer leads from this project
            // project: "Dharam Sons floor - KD" // Example: Only transfer leads from this project
            // project : ["Dharam Sons floor - KD", "Laburnum", "Dharamson Floor", "Labournum", "Lake City", "Tarc Tripundra"]
        });

        console.log(`Found ${leads.length} leads to transfer`);

        const employees = await Employee.find();

        if (employees.length === 0) {
            console.log('No employees available for transfer');
            return;
        }

        const currentDate = new Date();

        let employeeIndex = 8; // Employee Serial No
        let count = 20; // Number of leads to transfer

        const newEmployee = employees[employeeIndex - 1];

        for (let i = 0; i < leads.length && count > 0; i++) {
            const lead = leads[i];

            const lastAssignedDate = new Date(lead.lastAssignedDate);
            const daysSinceAssignment = Math.floor(
                (currentDate - lastAssignedDate) / (1000 * 60 * 60 * 24)
            );

            // Transfer only if lead is older than 1 day
            if (daysSinceAssignment <= 0) {
                continue;
            }

            // Check if this lead was already assigned to this employee
            const alreadyAssigned = await LeadHistory.findOne({
                leadId: lead._id,
                employeeName: newEmployee.name
            });

            if (alreadyAssigned) {
                console.log(
                    `Skipping Lead ${lead.name} - already assigned to ${newEmployee.name}`
                );
                continue;
            }

            // Assign lead
            lead.assignedTo = newEmployee._id;
            lead.lastAssignedDate = currentDate;
            lead.status = "No Update";
            lead.remark = "";

            await lead.save();

            // Save history
            const leadHistory = new LeadHistory({
                leadId: lead._id,
                employeeName: newEmployee.name,
                remark: "Lead transfer By Admin",
                status: lead.status,
                lastAssignedDate: lead.lastAssignedDate,
                lastStatusUpdate: lead.lastStatusUpdate
            });

            await leadHistory.save();

            // Append Employee Lead History Log
            await EmployeeLeadHistory.create({
                leadId: lead._id,
                employeeId: newEmployee._id,
                leadName: lead.name,
                lastAssignDate: new Date(),
                leadNumber: lead.phone,
                project: lead.project
            });

            console.log(
                `Lead ${lead.name} transferred to employee ${newEmployee.name}`
            );

            count--;
        }

        console.log('Lead transfer process completed');
    } catch (error) {
        console.error('Error in lead transfer process:', error);
    }
}

// function to count no of No-Update to particular team member.
async function countNoUpdateLead() {
    try {
        const Leads = await Lead.find({ status: ['No Update'] });
        const employees = await Employee.find();

        for (const employee of employees) {
            const employeeId = employee._id;
            const employeeLeads = Leads.filter(lead =>
                lead.assignedTo && lead.assignedTo.toString() === employeeId.toString()
            );

            console.log(`Employee: ${employee.name}`);
            console.log(`Assigned 'No Update' Leads Count: ${employeeLeads.length}`);

            const count = employeeLeads.length;

            // Send WhatsApp notification
            // Only send message if there are leads
            if (count > 0 && employee.phone) {

                await client.messages.create({
                    contentSid: 'HX526a9d27f79337cae50e571ef441fa5e',
                    contentVariables: JSON.stringify({
                        '1': employee.name,
                        '2': count.toString()
                    }),
                    from: whatsappFrom,
                    to: `whatsapp:+91${employee.phone}`  // Phone number in E.164 format, e.g., +919876543210
                });

                console.log(`Message sent to ${employee.name}`);
            } else {
                console.log(`No leads or no phone number for employee: ${employee.name}`);
            }
        }

        console.log('Count No-Update Lead completed');
    } catch (error) {
        console.error('Error in process:', error);
    }
}

// function to count no of In follow up to particular team member.
async function countInfollowupLead() {
    console.log("In follow up function called");
    try {
        const Leads = await Lead.find({ status: 'In Follow Up' });  // Use string, not array
        const employees = await Employee.find();
        const currentDate = Date.now();

        for (const employee of employees) {
            const employeeId = employee._id;

            const employeeLeads = Leads.filter(lead =>

                lead.assignedTo && lead.assignedTo.toString() === employeeId.toString()

            );

            // Filter leads that haven't been updated in the last 14 days
            const oldLeads = employeeLeads.filter(lead => {
                // if (!lead.lastStatusUpdate) return false;
                const lastUpdate = new Date(lead.lastStatusUpdate).getTime();
                const daysSinceUpdate = Math.floor((currentDate - lastUpdate) / (1000 * 60 * 60 * 24));
                return daysSinceUpdate >= 14;
            });

            const count = oldLeads.length;

            console.log(`Employee Name: ${employee.name}`);
            console.log(`Employee Phone: ${employee.phone}`);
            console.log(`Assigned 'In follow Up' Leads Count (14+ days): ${count}`);

            // Send WhatsApp message only if there are leads and a phone number
            if (count > 0 && employee.phone) {
                await client.messages.create({
                    contentSid: 'HXe9709fa26b7ca9c33562c6725a1b7dbb',
                    contentVariables: JSON.stringify({
                        '1': employee.name,
                        '2': count.toString()
                    }),
                    from: whatsappFrom,
                    to: `whatsapp:+91${employee.phone}`
                });

                console.log(`Message sent to ${employee.name}`);
            } else {
                console.log(`No qualifying leads or phone number for employee: ${employee.name}`);
            }
        }

        console.log('Count No-Update Lead completed');
    } catch (error) {
        console.error('Error in process:', error);
    }
}

// function to count no of future prospect to particular team member.
async function countFutureProspectLead() {
    try {
        const Leads = await Lead.find({ status: 'Future Prospect' });  // Use string, not array
        const employees = await Employee.find();
        const currentDate = Date.now();

        for (const employee of employees) {
            const employeeId = employee._id;

            const employeeLeads = Leads.filter(lead =>
                lead.assignedTo && lead.assignedTo.toString() === employeeId.toString()
            );

            // Filter leads that haven't been updated in the last 29 days
            const oldLeads = employeeLeads.filter(lead => {
                if (!lead.lastAssignedDate) return false;
                const lastUpdate = new Date(lead.lastStatusUpdate).getTime();
                const daysSinceUpdate = Math.floor((currentDate - lastUpdate) / (1000 * 60 * 60 * 24));
                return daysSinceUpdate >= 89;
            });

            const count = oldLeads.length;

            console.log(`Employee: ${employee.name}`);
            console.log(`Assigned 'Future Prospect' Leads Count (30+ days): ${count}`);

            // Send WhatsApp message only if there are leads and a phone number
            if (count > 0 && employee.phone) {
                await client.messages.create({
                    contentSid: 'HX8624ccc2203d44ffee22adb2c5291f72',
                    contentVariables: JSON.stringify({
                        '1': employee.name,
                        '2': count.toString()
                    }),
                    from: whatsappFrom,
                    to: `whatsapp:+91${employee.phone}`
                });

                console.log(`Message sent to ${employee.name}`);
            } else {
                console.log(`No qualifying leads or phone number for employee: ${employee.name}`);
            }
        }

        console.log('Count No-Update Lead completed');
    } catch (error) {
        console.error('Error in process:', error);
    }
}

// Schedule the job to run every day at 10:00 AM IST
cron.schedule('0 10 * * *', async () => {
    console.log('10:00 am Running fix timer lead transfer job');
    countNoUpdateLead();
    countInfollowupLead();
    countFutureProspectLead();
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"   // ✅ Important: ensures it runs in IST
});

async function syncEmployeeLeadHistory() {
    try {
        const leads = await Lead.find({
            assignedTo: { $ne: null }
        }).populate("assignedTo");

        console.log(`Found ${leads.length} assigned leads`);

        let added = 0;
        let skipped = 0;

        for (const lead of leads) {
            // Skip if employee doesn't exist
            if (!lead.assignedTo) continue;

            // Check if history already exists
            const alreadyExists = await EmployeeLeadHistory.findOne({
                leadId: lead._id,
                employeeId: lead.assignedTo._id,
            });

            if (alreadyExists) {
                skipped++;
                console.log(`Skipped: ${lead.name}`);
                continue;
            }

            // Create history
            await EmployeeLeadHistory.create({
                leadId: lead._id,
                employeeId: lead.assignedTo._id,
                leadName: lead.name,
                lastAssignDate: lead.lastAssignedDate || new Date(),
                leadNumber: lead.phone,
                project: lead.project,
            });

            added++;
            console.log(`Added: ${lead.name}`);
        }

        console.log("--------------------------------");
        console.log(`Added: ${added}`);
        console.log(`Skipped: ${skipped}`);
        console.log("Employee Lead History Sync Completed");
    } catch (error) {
        console.error("Error syncing Employee Lead History:", error);
    }
}


app.use('/', appointmentRoutes);

function formatInIST(dateLike) {
    const d = new Date(dateLike); // Date or ISO string
    const formatter = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return formatter.format(d);
}

// Run every 5 minutes
// call back and appointment reminder
cron.schedule("* * * * *", async () => {
    console.log("Running appointment reminder job");
    const check = await Appointment.findOne();
    try {
        const now = new Date();
        const reminderStart = new Date(now.getTime() + 1 * 60000); // exactly 5 min from now
        const reminderEnd = new Date(now.getTime() + 2 * 60000);   // 5-6 min window


        const appointments = await Appointment.find({
            date: { $gte: reminderStart, $lte: reminderEnd },
            reminderSent: false
        }).populate("leadId").populate("employeeId");

        for (const appt of appointments) {
            const lead = appt.leadId;
            const employee = appt.employeeId
            console.log(appt)

            // Send WhatsApp to employee
            if (employee.phone) {
                const formattedDate = formatInIST(appt.date);

                await client.messages.create({

                    contentSid: 'HXaae1e7b010a460af5634abc58881a695',
                    contentVariables: JSON.stringify({
                        '1': appt.type,
                        '2': lead.name,
                        '3': formattedDate,   // ✅ IST date/time
                        '4': lead.phone.toString(),
                        '5': appt.remark,
                    }),
                    from: whatsappFrom,
                    to: `whatsapp:+91${employee.phone.replace(/\D/g, '')}`
                });
            }

            // Send WhatsApp to lead (if phone exists)
            // if (lead.phone) {
            //     await client.messages.create({
            //         from: whatsappFrom,
            //         to: `whatsapp:+91${lead.phone}`,
            //         body: `🔔 Reminder: Your ${appt.type} with ${employee.name} is scheduled at ${appt.date.toLocaleString()}`
            //     });
            // }

            // ❌ Delete appointment after reminder
            await Appointment.findByIdAndDelete(appt._id);
            console.log(`Reminder sent for appointment ${appt._id}`);
        }
    } catch (err) {
        console.error("Error in appointment reminder job:", err);
    }
});

// Run this code function to delete past-date reminders
// cron.schedule("* * * * *", async () => {
//     console.log("🧹 Deleting past-date reminders");

//     try {
//         const todayStart = new Date();
//         // todayStart.setHours(0, 0, 0, 0); // today 00:00

//         const result = await Appointment.deleteMany({
//             date: { $lt: todayStart }
//         });

//         console.log(`✅ Deleted ${result.deletedCount} old reminders`);
//     } catch (err) {
//         console.error("❌ Error deleting old reminders:", err);
//     }
// });

// Run immediately on server start
(async () => {
    try {
        // await syncEmployeeLeadHistory();
        // await transferManualLeads();
        console.log('syncEmployeeLeadHistory executed immediately');
    } catch (error) {
        console.error(error);
    }
})();

const dirPath = path.resolve();
app.use(express.static("dist"));
app.get('*', (req, res) => {
    res.sendFile(path.resolve(dirPath, "dist", "index.html"));
})

app.listen(PORT, () => {
    console.log(`Serving is running ${PORT}`)
})