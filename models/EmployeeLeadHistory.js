import { Schema, model } from 'mongoose';

const EmployeeLeadHistorySchema = new Schema(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    leadName: {
      type: String,
      trim: true
    },
    lastAssignDate: {
      type: Date,
      default: Date.now
    },
    leadNumber: {
      type: String,
      trim: true,
      unique: true
    },
    project: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// One record per Employee + Lead
EmployeeLeadHistorySchema.index(
  { employeeId: 1, leadId: 1 },
  { unique: true }
);

export default model('EmployeeLeadHistory', EmployeeLeadHistorySchema);