import { Schema, model } from 'mongoose';

const StudentSchema = new Schema({
    name: String,
    email: String,
    password: String
})

export default model('students', StudentSchema);