import { Schema, model } from 'mongoose';

const LeadHistorySchema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  employeeName: String,
  remark: String,
  dateOfLead: Date,
  status: String,
  // assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee' },
  lastAssignedDate: Date,
  lastStatusUpdate: Date
  }, {
  timestamps: true // ✅ adds createdAt and updatedAt automatically
});

export default model('LeadHistory', LeadHistorySchema);
