import { Schema, model } from 'mongoose';
import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  password: String,
  role: { type: String, enum: ['admin', 'leader', 'employee'], default: 'employee' },
  teamLeader: { type: Schema.Types.ObjectId, ref: 'Employee' },
  order: { type: Number, default: 0 },
}, { timestamps: true });


export default model('Employee', EmployeeSchema);