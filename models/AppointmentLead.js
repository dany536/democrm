import { Schema, model } from 'mongoose';

const AppointmentLeadSchema = new Schema({
  name: String,
  appointmentDate: Date,
  budget: String,
  email: String,
  phone: String,
  project: String,
  remark: String,
  data_source: String,
  dateOfLead: Date,
  status: { type: String, default: "No Update" },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee' },
  lastAssignedDate: Date,
  lastStatusUpdate: { type: Date, default: Date.now }
});

export default model('AppointmentLead', AppointmentLeadSchema);
