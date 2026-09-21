import { Schema, model } from 'mongoose';

const LeadSchema = new Schema({
  name: {
    type: String,
    trim: true
  },
  email: String,

  phone: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    set: function (value) {
      if (!value) return value;
      // Keep only digits
      const digits = value.toString().replace(/\D/g, "");
      // Save only last 10 digits
      return digits.slice(-10);
    }
  },

  project: String,
  remark: String,
  data_source: String,
  dateOfLead: { type: Date, default: Date.now },
  budget: String,
  constructionStatus: String,
  propertyType: String,
  status: { type: String, default: "No Update" },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee' },
  lastAssignedDate: { type: Date, default: Date.now },
  lastStatusUpdate: { type: Date, default: Date.now }

}, {
  timestamps: true
});

export default model('Lead', LeadSchema);
