import mongoose from "mongoose";
import { db_name } from "../contents.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/${db_name}`
    );
    console.log(
      `MongoDB Connected!! DB host: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.error("Error: ", error);
    process.exit(1);
  }
};

export default connectDB;