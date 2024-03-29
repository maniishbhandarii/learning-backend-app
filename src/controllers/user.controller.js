import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  /*
   
    get user details from frontend
    validation - not empty
    check if user already exists: username, email
    check for images, check for avatar
    upload them to cloudinary, avatar
    create user object create entry in db
    remove password and refresh token field from response
    check for user creation
    return res
    
    */

  //get user details from frontend
  const { username, email, fullname, password } = req.body;
  console.log(req.body);

  //validation - not empty
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill all fields");
  }

  //check if user already exists: username, email
  const existedUser = User.findOne({
    $or: [{ username, email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //validation - not empty : avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const CILocalParth = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const CoverImage = await uploadOnCloudinary(CILocalParth);

  //create user object create entry in db
  const user = await User.create(
    fullname,
    (username = username.lowerCase()),
    email,
    password,
    (avatar = avatar.url),
    (coverImage = coverImage?.url || "")
  );

  //checking if the user is created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
});

//return response
return res.status(201)
  .json(new ApiResponse(200, createdUser, "User registered Successfully"));

export { registerUser };
