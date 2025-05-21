const Joi = require("joi");
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import responseMessage from "../../../../../assets/responseMessage";
import {userServices} from "../../services/userServices";
const {
    checkUserExists,
    createUser,
    findUser,
    findUserForOtp,
    emailMobileExist,
    findUserData,
    updateUser,
    updateUserForOtp,
    updateUserById,
    paginateSearch,
    paginateSearchAllUser,
    paginateFriendId,
    findFriend,
    userAllDetails,
    findCount,
} = userServices;

export class adminController {
    /**
     * @swagger
     * /admin/login:
     *   post:
     *     tags:
     *       - ADMIN
     *     description: login with email || mobileNumber and passCode
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: login
     *         description: Login details
     *         in: body
     *         required: true
     *         schema:
     *           type: object
     *           properties:
     *             email:
     *               type: string
     *             password:
     *               type: string
     *             deviceToken:
     *               type: string
     *             deviceType:
     *               type: string
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async login(req, res, next) {
        var validationSchema = {
            email: Joi.string().required(),
            password: Joi.string().optional(),
            deviceToken: Joi.string().allow("").optional(),
            deviceType: Joi.string().allow("").optional(),
        };
        try {
            let results;
            var validatedBody = await Joi.validate(req.body, validationSchema);
            const {email, password, deviceToken, deviceType} = validatedBody;
            let userResult = await userModel.findOne({
                email: email,
                userType: userType.ADMIN,
                status: {$ne: status.DELETE},
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            if (!bcrypt.compareSync(password, userResult.password)) {
                throw apiError.conflict(responseMessage.PASSWORD_NOT_MATCH);
            } else {
                var token = await commonFunction.getToken({
                    _id: userResult._id,
                    email: userResult.email,
                    userType: userResult.userType,
                    status: userResult.status,
                    deviceToken: deviceToken,
                    deviceType: deviceType,
                });
                results = {
                    _id: userResult._id,
                    email: email,
                    speakeasy: userResult.speakeasy,
                    userType: userResult.userType,
                    token: token,
                };
            }
            return res.json(new response(results, responseMessage.LOGIN));
        } catch (error) {
            console.log(error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/verifyOtp:
     *   post:
     *     tags:
     *       - ADMIN
     *     description: Verify OTP by an admin for password reset
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: body
     *         description: OTP verification details
     *         in: body
     *         required: true
     *         schema:
     *           type: object
     *           properties:
     *             email:
     *               type: string
     *               description: Admin's email
     *             otp:
     *               type: integer
     *               description: OTP (One-Time Password) for verification
     *     responses:
     *       200:
     *         description: Returns user details and authentication token upon successful OTP verification
     */
    async verifyOtp(req, res, next) {
        const validationSchema = {
            email: Joi.string().required(),
            otp: Joi.number().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);
            const {email, otp} = validatedBody;
            const userData = await userModel.findOne({
                email: email,
                userType: userType.ADMIN,
                status: {
                    $ne: status.DELETE,
                },
            });
            if (!userData) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            if (new Date().getTime() > userData.otpExpTime) {
                throw apiError.badRequest(responseMessage.OTP_EXPIRED);
            }
            if (userData.otp !== validatedBody.otp) {
                throw apiError.badRequest(responseMessage.INVALID_OTP);
            }
            const upadteUser = await userModel.findByIdAndUpdate(
                {
                    _id: userData._id,
                },
                {
                    $set: {
                        otpVerification: true,
                        otp: null,
                        otpExpTime: null,
                    },
                },
                {new: true}
            );

            var token = await commonFunction.getToken({
                id: upadteUser._id,
                email: upadteUser.email,
                mobileNumber: upadteUser.mobileNumber,
                userType: upadteUser.userType,
            });
            console.log("token=================>>>>", token);
            var userInfo = {
                _id: upadteUser._id,
                email: upadteUser.email,
                token: token,
                otpVerification: upadteUser.otpVerification,
                status: upadteUser.status,
            };
            return res.json(new response(userInfo, responseMessage.OTP_VERIFIED));
        } catch (error) {
            console.error("Error during OTP verification:======>>>>>>", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/updateAdminProfile:
     *   put:
     *     summary: Update admin profile
     *     tags:
     *       - ADMIN
     *     description: Update admin profile with editable fields
     *     consumes:
     *       - multipart/form-data
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         in: header
     *         required: true
     *         description: Bearer token
     *         type: string
     *       - name: fullName
     *         in: formData
     *         required: true
     *         type: string
     *         description: Full name of the admin
     *       - name: firstName
     *         in: formData
     *         required: true
     *         type: string
     *         description: First name of the admin
     *       - name: lastName
     *         in: formData
     *         required: true
     *         type: string
     *         description: Last name of the admin
     *       - name: email
     *         in: formData
     *         required: true
     *         type: string
     *         description: Email address
     *       - name: mobileNumber
     *         in: formData
     *         required: true
     *         type: string
     *         description: Mobile number
     *       - name: countryCode
     *         in: formData
     *         required: true
     *         type: string
     *         description: Country code (e.g., +91)
     *       - name: dateOfBirth
     *         in: formData
     *         required: true
     *         type: string
     *         description: Date of birth (e.g., 20/08/2001)
     *       - name: gender
     *         in: formData
     *         required: true
     *         type: string
     *         enum: [MALE, FEMALE, OTHER]
     *         description: Gender
     *       - name: password
     *         in: formData
     *         required: true
     *         type: string
     *         description: New password
     *       - name: state
     *         in: formData
     *         required: true
     *         type: string
     *         description: State name
     *       - name: address
     *         in: formData
     *         required: true
     *         type: string
     *         description: Full address
     *       - name: streetName
     *         in: formData
     *         required: false
     *         type: string
     *         description: Street name (optional)
     *       - name: buildingName
     *         in: formData
     *         required: false
     *         type: string
     *         description: Building name (optional)
     *       - name: city
     *         in: formData
     *         required: false
     *         type: string
     *         description: City (optional)
     *       - name: zipCode
     *         in: formData
     *         required: false
     *         type: string
     *         description: Zip code (optional)
     *       - name: country
     *         in: formData
     *         required: false
     *         type: string
     *         description: Country name (optional)
     *       - name: location[type]
     *         in: formData
     *         required: true
     *         type: string
     *         enum: [Point]
     *         description: GeoJSON type (must be "Point")
     *       - name: location[coordinates][0]
     *         in: formData
     *         required: true
     *         type: number
     *         description: Longitude
     *       - name: location[coordinates][1]
     *         in: formData
     *         required: true
     *         type: number
     *         description: Latitude
     *       - name: profilePic
     *         in: formData
     *         required: false
     *         type: file
     *         description: Profile picture file (image)
     *       - name: coverImage
     *         in: formData
     *         required: false
     *         type: file
     *         description: Cover image file (image)
     *     responses:
     *       200:
     *         description: Returns success message with updated user data
     *       400:
     *         description: Bad request or validation error
     *       404:
     *         description: Admin user not found
     *       409:
     *         description: Email or mobile already in use
     *       500:
     *         description: Internal server error
     */
    async updateAdminProfile(req, res, next) {
        const validationSchema = {
            fullName: Joi.string().required(),
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
            email: Joi.string().email().required(),
            mobileNumber: Joi.string().required(),
            countryCode: Joi.string().required(),
            dateOfBirth: Joi.string().required(), // "20/08/2001" format
            gender: Joi.string().valid("MALE", "FEMALE", "OTHER").required(),
            password: Joi.string().required(),
            state: Joi.string().required(),
            address: Joi.string().required(),
            streetName: Joi.string().optional(),
            buildingName: Joi.string().optional(),
            city: Joi.string().optional(),
            zipCode: Joi.string().optional(),
            country: Joi.string().optional(),
            location: Joi.object({
                type: Joi.string().valid("Point").required(),
                coordinates: Joi.array().items(Joi.number()).length(2).required(), // [longitude, latitude]
            }).required(),
            profilePic: Joi.string().optional(),
            coverImage: Joi.string().optional(),
        };
        try {
            console.log("token=================>>>>", req.headers.token);

            var validatedBody = await Joi.validate(req.body, validationSchema);
            const {
                fullName,
                firstName,
                lastName,
                email,
                mobileNumber,
                countryCode,
                dateOfBirth,
                gender,
                password,
                state,
                address,
                location,
                profilePic,
                coverImage,
                streetName,
                buildingName,
                city,
                zipCode,
                country,
            } = validatedBody;
            const userdata = await userModel.findOne({
                _id: req.userId,
                userType: userType.ADMIN,
                status: {
                    $ne: status.DELETE,
                },
            });
            if (!userdata) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            if (validatedBody.profilePic) {
                validatedBody.profilePic = validatedBody.profilePic;
                validatedBody.profilePic = await commonFunction.getImageUrl(validatedBody.profilePic);
            }
            if (validatedBody.mobileNumber) {
                const checkMobile = await userModel.findOne({
                    mobileNumber: validatedBody.mobileNumber,
                    _id: {$ne: req.userId},
                    userType: userType.ADMIN,
                    status: {$ne: status.DELETE},
                });
                if (checkMobile) {
                    throw apiError.conflict(responseMessage.MOBILE_ALREADY_IN_USE);
                }
            }
            if (validatedBody.email) {
                const checkEmail = await userModel.findOne({
                    email: validatedBody.email,
                    _id: {$ne: req.userId},
                    userType: userType.ADMIN,
                    status: {$ne: status.DELETE},
                });
                if (checkEmail) {
                    throw apiError.conflict(responseMessage.EMAIL_ALREADY_IN_USE);
                }
            }
            if (validatedBody.password) {
                const salt = await bcrypt.genSalt(10);
                validatedBody.password = await bcrypt.hash(validatedBody.password, salt);
            }
            if (validatedBody.coverImage) {
                validatedBody.coverImage = await commonFunction.getImageUrl(validatedBody.coverImage);
            }
            const updateUser = await userModel.findByIdAndUpdate(
                {
                    _id: req.userId,
                },
                {
                    $set: {
                        fullName: validatedBody.fullName,
                        firstName: validatedBody.firstName,
                        lastName: validatedBody.lastName,
                        email: validatedBody.email,
                        mobileNumber: validatedBody.mobileNumber,
                        countryCode: validatedBody.countryCode,
                        dateOfBirth: validatedBody.dateOfBirth,
                        gender: validatedBody.gender,
                        password: validatedBody.password,
                        state: validatedBody.state,
                        address: validatedBody.address,
                        location: validatedBody.location,
                        profilePic: validatedBody.profilePic,
                        coverImage: validatedBody.coverImage,
                        streetName: validatedBody.streetName,
                        buildingName: validatedBody.buildingName,
                        city: validatedBody.city,
                        zipCode: validatedBody.zipCode,
                        country: validatedBody.country,
                    },
                },
                {new: true}
            );
            return res.json(new response(updateUser, responseMessage.PROFILE_UPDATED));
        } catch (error) {
            console.error("Error during profile update:======>>>>>>", error);
            return next(error);
        }
    }
 
/**
 * @swagger
 * /admin/forgotPassword:
 *   post:
 *     tags:
 *       - ADMIN
 *     description: Admin initiates the forgot password process
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Forgot password details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               description: Admin's email address
 *     responses:
 *       200:
 *         description: Returns success message after initiating the forgot password process 
 */
  async forgotPassword(req, res, next) {
    var validationSchema = {
      email: Joi.string().required(),
    };
    try {
      if (req.body.email) {
        req.body.email = req.body.email.toLowerCase();
      }
      var validatedBody = await Joi.validate(req.body, validationSchema);
      const { email } = validatedBody;
      var userResult = await userModel.findOne({
        email: email,
        status: { $ne: status.DELETE },
        userType: userType.ADMIN,
      });
      if (!userResult) {
        throw apiError.notFound(responseMessage.USER_NOT_FOUND);
      } else {
        var otp = commonFunction.getOTP();
        var newOtp = otp;
        var time = Date.now() + 180000;
      //  await commonFunction.sendMailOtpForgetAndResend(email, otp);
        var updateResult = await userModel.findByIdAndUpdate(
          { _id: userResult._id },
          { $set: { otp: newOtp, otpExpTime: time,otpVerification:false } } , {new: true}
        );
        return res.json(new response(updateResult,responseMessage.OTP_SENT));
      }
    } catch (error) {
      console.log(error);
      return next(error);
    }
  }

    /**
   * @swagger
   * /admin/resetPassword:
   *   post:
   *     tags:
   *       - ADMIN
   *     description: Change password or reset password When ADMIN need to chnage
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: token
   *         description: token
   *         in: header
   *         required: true
   *       - name: password
   *         description: password
   *         in: formData
   *         required: true
   *       - name: confirmPassword
   *         description: confirmPassword
   *         in: formData
   *         required: true
   *     responses:
   *       200:
   *         description: Your password has been successfully changed.
   *       404:
   *         description: This user does not exist.
   *       422:
   *         description: Password not matched.
   *       500:
   *         description: Internal Server Error
   *       501:
   *         description: Something went wrong!
   */
  async resetPassword(req, res, next) {
    const validationSchema = {
      password: Joi.string().required(),
      confirmPassword: Joi.string().required(),
    };
    try {
      const { password, confirmPassword } = await Joi.validate(
        req.body,
        validationSchema
      );
      var userResult = await userModel.findOne({
        _id: req.userId,
        status: { $ne: status.DELETE },
        userType: userType.ADMIN,
      });
      if (!userResult) {
        throw apiError.notFound(responseMessage.USER_NOT_FOUND);
      } else {
        if (password == confirmPassword) {
          let update = await userModel.findByIdAndUpdate(
            { _id: userResult._id },
            { password: bcrypt.hashSync(password) },{new: true}
          );
          return res.json(new response(update, responseMessage.PASSWORD_RESET_SUCCESS));
        } else {
          throw apiError.notFound(responseMessage.PASSWORD_NOT_MATCH);
        }
      }
    } catch (error) {
      console.log(error);
      return next(error);
    }
  }

  /**
   * @swagger
   * /admin/resendOTP:
   *   post:
   *     tags:
   *       - ADMIN
   *     description: after OTP expire or not get any OTP with that frameOfTime ADMIN resendOTP for new OTP
   *     produces:
   *       - application/json
   *     parameters:
 *       - name: body
 *         description: Forgot password details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               description: Admin's email address
   *     responses:
   *       200:
   *         description: Returns success message
   */
  async resendOTP(req, res, next) {
    var validationSchema = {
      email: Joi.string().required(),
    };
    try {
      if (req.body.field) {
        req.body.field = req.body.field.toLowerCase();
      }
      var validatedBody = await Joi.validate(req.body, validationSchema);
      const { email } = validatedBody;
      var userResult = await userModel.findOne({
        email: validatedBody.email,
        status: { $ne: status.DELETE },
        userType: userType.ADMIN,
      });
      if (!userResult) {
        throw apiError.notFound(responseMessage.USER_NOT_FOUND);
      }
      var otp = commonFunction.getOTP();
      var otpTime = new Date().getTime() + 180000;
    //   await commonFunction.sendMailOtpForgetAndResend(
    //     "info@rival.finance",
    //     otp
    //   );
      // await commonFunction.sendMailOtpForgetAndResend(email, otp);
      var updateResult = await userModel.findByIdAndUpdate(
        { _id: userResult._id },
        { otp: otp, otpTime: otpTime },{new: true}
      );
      return res.json(new response(updateResult, responseMessage.OTP_SEND));
    } catch (error) {
      console.log(error);
      return next(error);
    }
  }

/**
 * @swagger
 * /admin/changePassword:
 *   patch:
 *     tags:
 *       - ADMIN
 *     summary: Change password by ADMIN
 *     description: Allows an ADMIN to change their password on the platform.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: header
 *         name: token
 *         type: string
 *         required: true
 *         description: Authorization token
 *       - in: body
 *         name: body
 *         required: true
 *         description: Admin password change details
 *         schema:
 *           type: object
 *           required:
 *             - oldPassword
 *             - newPassword
 *           properties:
 *             oldPassword:
 *               type: string
 *             newPassword:
 *               type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Unauthorized or token missing/invalid
 *       500:
 *         description: Internal server error
 */
  async changePassword(req, res, next) {
    const validationSchema = {
      oldPassword: Joi.string().required(),
      newPassword: Joi.string().required(),
    };
    try {
      let validatedBody = await Joi.validate(req.body, validationSchema);
      let userResult = await userModel.findOne({
        _id: req.userId,
        status: { $ne: status.DELETE },
        userType: userType.ADMIN,
      });
      if (!userResult) {
        throw apiError.notFound(responseMessage.USER_NOT_FOUND);
      }
      if (!bcrypt.compareSync(validatedBody.oldPassword, userResult.password)) {
        throw apiError.badRequest(responseMessage.PWD_NOT_MATCH);
      }
      let updated = await userModel.findByIdAndUpdate(userResult._id, {
        password: bcrypt.hashSync(validatedBody.newPassword),
      },{new:true});
      return res.json(new response(updated, responseMessage.PWD_CHANGED));
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /admin/adminProfile:
   *   get:
   *     tags:
   *       - ADMIN
   *     description: get his own profile details with adminProfile API
   *     produces:
   *       - application/json
   *     parameters:
   *       - name: token
   *         description: token
   *         in: header
   *         required: true
   *     responses:
   *       200:
   *         description: Returns success message
   */
  async adminProfile(req, res, next) {
    try {
      let adminResult = await userModel.findOne({
        _id: req.userId,
        status: { $ne: status.DELETE },
        userType: userType.ADMIN,
      });
      if (!adminResult) {
        throw apiError.notFound(responseMessage.USER_NOT_FOUND);
      }
     

      return res.json(new response(adminResult, responseMessage.USER_DETAILS));
    } catch (error) {
        console.log("==================================>",error);
      return next(error);
    }
  }
}
export default new adminController();
//work on progress
