import { v2 as cloudinary } from "cloudinary";
import fs from 'fs'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null; //if the file path does not exit it will return nothing
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("The file has been successfully uploaded on cloudinary with url", response.url);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath) //the file is not uploaded on cloudinary and deleted from the server
    return null
  }
};

export {uploadOnCloudinary}