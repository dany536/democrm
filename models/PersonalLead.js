import { Schema, model } from 'mongoose';

const PersonalLeadSchema = new Schema({
  name: String,
  email: String,
  phone: String,
  project: String,
  remark: String,
  data_source: String,
  dateOfLead: { type: Date, default: Date.now },
  status: { type: String, default: "No Update" },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee' },
  lastAssignedDate: Date,
  lastStatusUpdate: { type: Date, default: Date.now }
});

export default model('PersonalLead', PersonalLeadSchema);
