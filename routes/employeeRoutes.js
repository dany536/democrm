// routes/employeeRoutes.js
import { Router } from 'express';
const router = Router();
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import Lead from '../models/Lead.js';

// Create a new employee
// router.post('/addEmployee', async (req, res) => {
//   try {
//     const employee = new Employee(req.body);
//     await employee.save();
//     res.status(201).json(employee);
//     // res.json({Message: "New Employee Added Successfully"})
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

router.post('/addEmployee', async (req, res) => {
  try {
    // Fetch and sort all employees by `order`, fallback to `createdAt` if missing
    let employees = await Employee.find().sort({ order: 1, createdAt: 1 });


    // Sanitize input
    const newEmployee = new Employee(req.body);

    // If no employees exist yet, just add at position 0
    if (employees.length === 0) {
      newEmployee.order = 0;
      await newEmployee.save();
      return res.status(201).json({ message: "First employee added", employee: newEmployee });
    }

    // If employees have missing `order`, fix them first
    let updated = false;
    for (let i = 0; i < employees.length; i++) {
      if (employees[i].order === undefined || employees[i].order === null) {
        employees[i].order = i;
        await employees[i].save();
        updated = true;
      }
    }

    // Re-fetch if we had to fix order fields
    if (updated) {
      employees = await Employee.find().sort({ order: 1 });
      console.log("Re-fetched Employees after order fix:");
      console.log(employees);
    }

    // If less than 3 employees, just append to end
    if (employees.length < 3) {
      newEmployee.order = employees.length;
      await newEmployee.save();
      return res.status(201).json({
        message: "Employee added at the end (less than 3 employees)",
        employee: newEmployee
      });
    }

    // Insert at 3rd-last position
    const insertIndex = employees.length - 3;

    // Shift orders of employees at insertIndex and after
    const bulkOps = employees
      .filter(emp => emp.order >= insertIndex)
      .map(emp => ({
        updateOne: {
          filter: { _id: emp._id },
          update: { $inc: { order: 1 } }
        }
      }));

    if (bulkOps.length > 0) {
      await Employee.bulkWrite(bulkOps);
    }

    // Now insert new employee
    newEmployee.order = insertIndex;
    await newEmployee.save();

    res.status(201).json({
      message: `Employee added at 3rd-last position (index ${insertIndex})`,
      employee: newEmployee
    });

  } catch (error) {
    console.error("Error in /addEmployee:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find()
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get one employee
router.get('/employee/:id', async (req, res) => {
  try {
    const employee = await Employee.find({ _id: req.params.id })
    res.json(employee[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get leader Pannel
router.get('/leaderPannel/:id', async (req, res) => {
  try {
    const employee = await Employee.find({ teamLeader: req.params.id })
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a employee
router.put('/employee/:id', async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(employee[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//  Delete a employee
router.delete('/employee/:id', async (req, res) => {
  
  try {
    const filter = { assignedTo: req.params.id};
    const update = { $set: { status: "No Update" } };
    console.log("Updating leads with filter:", filter, "and update:", update);

    // Use updateMany for the efficient modification in the database
    await Lead.updateMany(filter, update);

    await Employee.findByIdAndDelete({ _id: req.params.id });
    res.json({ message: 'Employee deleted' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /leads/update-and-fetch-by-employee/:employeeId
// router.delete('/employee/:id', async (req, res) => {
//     const { employeeId } = req.params;
//     const newStatus = 'no update'; 

//     try {
//         // --- 1. SEARCH: Find the leads before they are updated ---
//         // We use find() to retrieve the documents first.
//         const leadsToUpdate = await Lead.find({ assignedTo: employeeId });

//         if (leadsToUpdate.length === 0) {
//             return res.status(404).json({ 
//                 message: `No leads found assigned to employee ID: ${employeeId}`,
//                 updatedLeads: [] 
//             });
//         }

//         // --- 2. UPDATE: Update the status of the matching leads ---
//         const filter = { assignedTo: employeeId };
//         const update = { $set: { status: newStatus } };

//         // Use updateMany for the efficient modification in the database
//         const updateResult = await Lead.updateMany(filter, update);

//         await Employee.findByIdAndDelete({ _id: req.params.id });

//         // --- 3. RESPOND: Return the original lead data and the result ---
//         res.json({
//             message: `Successfully updated ${updateResult.modifiedCount} leads to status: '${newStatus}'`,
//             originalLeadsFound: leadsToUpdate.length,
//             modifiedCount: updateResult.modifiedCount,
//             // Returning the leads found *before* the update might be useful for logging/auditing
//             leadsDataBeforeUpdate: leadsToUpdate 
//         });

//     } catch (error) {
//         res.status(500).json({ 
//             message: 'Error processing leads status update and fetch', 
//             error: error.message 
//         });
//     }
// });

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  Employee.findOne({ email })
    .then(user => {
      if (user) {
        if (user.password === password) {

          // Create JWT payload
          const payload = {
            user: {
              id: user.id,
              name: user.name
            }
          };

          const accessToken = jwt.sign(payload, "jwt-access-token-secret-key", { expiresIn: '1h' })
          res.cookie('accessToken', accessToken, { maxAge: 36000000 })
          if (user.email === "admin@gmail.com") {
            return res.json({ Role: "Admin", Message: "Admin Login", Id: user._id })
          } else {
            return res.json({ Role: "Employee", Message: "User Login", Id: user._id })
          }
        } else {
          return res.json({ Message: "Incorrect Password" })
        }
      } else {
        res.json({ Message: "Incorrect Email Id" });
      }
    })
    .catch(err => res.json(err))
})

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

// router.get('/login', varifyUser, (req, res) => {
//   return res.json({valid: true, message: "authorized"})
// })



export default router;
