// model 1
// models/RoundRobin.js
// import { Schema, model } from "mongoose";

// const RoundRobinSchema = new Schema({
//   pointer: { type: Number, default: 0 }
// });

// export default model("RoundRobin", RoundRobinSchema);



// model 2
// models/RoundRobin.js
import { Schema, model } from "mongoose";

const RoundRobinSchema = new Schema(
  {
    // Identifies which team or group this pointer belongs to (e.g., "Team_Alpha", "Team_Beta")
    teamName: { 
      type: String, 
      required: true, 
      unique: true,
      trim: true
    },
    // The current index position for the next round-robin assignment
    pointer: { 
      type: Number, 
      default: 0,
      min: 0
    }
  },
  { 
    // Automatically handles createdAt and updatedAt fields for tracking changes
    timestamps: true 
  }
);

export default model("RoundRobin", RoundRobinSchema);
