import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtokens";

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
  // console.log(req.body);

  //validation - not empty
  if (
    [username, email, fullname, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill all fields");
  }

  //check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ username, email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //validation - not empty : avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const CILocalParth = req.files?.coverImage[0]?.path;
  //  if coverimage is not given by the FE
  // console.log('Code reached here');
  let CILocalPath;
  if (
    req.files &&
    req.files.coverImage &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    CILocalPath = req.files?.coverImage[0]?.path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(CILocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //create user object create entry in db
  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  //checking if the user is created or not
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  //return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const generateAccessAndRefreshtokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccesstokens();
    const refreshToken = user.generateRefreshtokens();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      502,
      "Something went wrong while generating access and refesh token  in catch statement"
    );
  }
};
const loginUser = asyncHandler(async (req, res) => {
  /*
   
    get username or email from req.body
    find the user
    password check
    generate access and refresh token
    send cookie
    return 
    */

  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or Email required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not fount");
  }

  const ispasswordValid = await user.isPasswordCorrect(password);

  if (!ispasswordValid) {
    throw new ApiError(404, "User credientials invaild");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshtokens(
    user._id
  );

  const loggedInuser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInuser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: [
      {
        refreshToken: 1,
      },
      {
        new: true,
      },
    ],
  });
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out"));
});

const refreshaccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token not found in cookies");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );
  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Refresh token invaild");
  }

  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token invaild");
  }
  const { accessToken, newRefreshToken } = await generateAccessAndRefreshtokens(
    user._id
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed successfully"
      )
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invaild current Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforSave: false });

  return res.status(202).json(202, {}, "password successfully changed");
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(204)
    .json(204, res.user, "current user is successfully fetched");
});

const updateUserdetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(404, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");
  return res.status(200, user, "User Details updated successfully");
});

const userAvatarUpdate = asyncHandler(async (req, res) => {
  const localavatarpath = req.file?.path;

  if (!localavatarpath) {
    throw new ApiError(404, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(502, "Error while uploading the avatar file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  );
  return res.status(200, user, "User avatar updated successfully");
});

const userCoverImageUpdate = asyncHandler(async (req, res) => {
  const localcoverpath = req.file?.path;

  if (!localcoverpath) {
    throw new ApiError(404, "cover image file is missing");
  }

  const coverImage = await uploadOnCloudinary(localcoverpath);

  if (!coverImage.url) {
    throw new ApiError(502, "Error while uploading the coverImage file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  );
  return res.status(200, user, "User coverImage updated successfully");
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshaccessToken,
  getCurrentUser,
  changeCurrentPassword,
  updateUserdetails,
  userAvatarUpdate,
  userCoverImageUpdate,
};
