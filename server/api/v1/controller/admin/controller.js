const Joi = require("joi");
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel";
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

export class AdminController {
    /**
     * @swagger
     * /admin/dashboard:
     *   get:
     *     summary: dashboard
     *     tags:
     *       - ADMIN
     *     description: dashboard section for all counts of USER,PENDING_KYC,APPROVE_KYC,ACTIVE_USER,BLOCK_USER,TOTAL Counts
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
    async dashboard(req, res, next) {
        try {
            let admin = await findUser({
                _id: req.userId,
                status: {$ne: status.DELETE},
                // userType: userType.ADMIN,
            });
            if (!admin) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            let [activeUser, allSuccessTransaction] = await Promise.all([
                allactiveUser({status: status.ACTIVE, userType: userType.USER}),
                alltransactionCount({transStatusType: transactionStatusType.SUCCESS}),
            ]);
            let obj = {
                activeUser: activeUser,
                allSuccessTransaction: allSuccessTransaction,
                earningAmount: totalEarning,
                totalUserBal: totalUserBal,
                totalAdminBal: 0,
            };
            return res.json(new response(obj, responseMessage.DATA_FOUND));
        } catch (error) {
            console.log("error===>>>", error);
            return next(error);
        }
    }

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
        const validationSchema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().required(),
            deviceToken: Joi.string().allow("").optional(),
            deviceType: Joi.string().allow("").optional(),
        });

        try {
            // Validate request body
            const validatedBody = await validationSchema.validateAsync(req.body);

            const { email, password, deviceToken = "", deviceType = "" } = validatedBody;

            // Find user
            const userResult = await userModel.findOne({
                email,
                userType: userType.ADMIN,
                status: { $ne: status.DELETE },
            });

            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            // Compare password (async)
            const passwordMatch = await bcrypt.compare(password, userResult.password);
            if (!passwordMatch) {
                throw apiError.conflict(responseMessage.PASSWORD_NOT_MATCH);
            }

            // Generate token
            const token = await commonFunction.getToken({
                _id: userResult._id,
                email: userResult.email,
                userType: userResult.userType,
                status: userResult.status,
                deviceToken,
                deviceType,
            });

            const results = {
                _id: userResult._id,
                email: userResult.email,
                speakeasy: userResult.speakeasy,
                userType: userResult.userType,
                token,
            };

            // Push notification only if deviceToken is provided
            if (deviceToken) {
                await commonFunction.pushNotificationDelhi(
                    deviceToken,
                    deviceType,
                    `🎉 Welcome back, ${userResult.name}!`,
                    `Hi ${userResult.name}, you have successfully signed in to your wearO Journey account. 🚀`
                );
            }

            return res.json(new Response(results, responseMessage.LOGIN));
        } catch (error) {
            console.error(error);
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
        const validationSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.number().required(),
});

try {
    const validatedBody = await validationSchema.validateAsync(req.body);
    const { email } = validatedBody;

    const userData = await userModel.findOne({
        email,
        userType: userType.ADMIN,
        status: { $ne: status.DELETE },
    });

    if (!userData) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

    if (Date.now() > userData.otpExpTime) throw apiError.badRequest(responseMessage.OTP_EXPIRED);

    if (userData.otp !== validatedBody.otp) throw apiError.badRequest(responseMessage.INVALID_OTP);

    const updatedUser = await userModel.findByIdAndUpdate(
        userData._id,
        { $set: { otpVerification: true, otp: null, otpExpTime: null } },
        { new: true }
    );

    const token = await commonFunction.getToken({
        id: updatedUser._id,
        email: updatedUser.email,
        mobileNumber: updatedUser.mobileNumber,
        userType: updatedUser.userType,
    });

    const userInfo = {
        _id: updatedUser._id,
        email: updatedUser.email,
        token,
        otpVerification: updatedUser.otpVerification,
        status: updatedUser.status,
    };

    return res.json(new response(userInfo, responseMessage.OTP_VERIFIED));

} catch (error) {
    console.error("Error during OTP verification:", error);
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
    const validationSchema = Joi.object({
        fullName: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        mobileNumber: Joi.string().required(),
        countryCode: Joi.string().required(),
        dateOfBirth: Joi.string().required(),
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
            coordinates: Joi.array().items(Joi.number()).length(2).required(),
        }).required(),
        profilePic: Joi.string().optional(),
        coverImage: Joi.string().optional(),
    });

    try {
        const validatedBody = await validationSchema.validateAsync(req.body); // ✅ Use const & validateAsync

        const userData = await userModel.findOne({
            _id: req.userId,
            userType: userType.ADMIN,
            status: { $ne: status.DELETE },
        });
        if (!userData) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

        // Process images
        if (validatedBody.profilePic) {
            validatedBody.profilePic = await commonFunction.getImageUrl(validatedBody.profilePic);
        }
        if (validatedBody.coverImage) {
            validatedBody.coverImage = await commonFunction.getImageUrl(validatedBody.coverImage);
        }

        // Check unique mobile
        if (validatedBody.mobileNumber) {
            const existingMobile = await userModel.findOne({
                mobileNumber: validatedBody.mobileNumber,
                _id: { $ne: req.userId },
                userType: userType.ADMIN,
                status: { $ne: status.DELETE },
            });
            if (existingMobile) throw apiError.conflict(responseMessage.MOBILE_ALREADY_IN_USE);
        }

        // Check unique email
        if (validatedBody.email) {
            const existingEmail = await userModel.findOne({
                email: validatedBody.email,
                _id: { $ne: req.userId },
                userType: userType.ADMIN,
                status: { $ne: status.DELETE },
            });
            if (existingEmail) throw apiError.conflict(responseMessage.EMAIL_ALREADY_IN_USE);
        }

        // Hash password if provided
        if (validatedBody.password) {
            const salt = await bcrypt.genSalt(10);
            validatedBody.password = await bcrypt.hash(validatedBody.password, salt);
        }

        // Update user using object spread
        const updateUser = await userModel.findByIdAndUpdate(
            req.userId,
            { $set: validatedBody },
            { new: true }
        );

        return res.json(new response(updateUser, responseMessage.PROFILE_UPDATED));
    } catch (error) {
        console.error("Error during profile update:", error);
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
    const validationSchema = Joi.object({
        email: Joi.string().email().required(),
    });

    try {
        // Normalize email
        if (req.body.email) {
            req.body.email = req.body.email.toLowerCase();
        }

        const validatedBody = await validationSchema.validateAsync(req.body);
        const { email } = validatedBody;

        const userResult = await userModel.findOne({
            email,
            status: { $ne: status.DELETE },
            userType: userType.ADMIN,
        });

        if (!userResult) {
            throw apiError.notFound(responseMessage.USER_NOT_FOUND);
        }

        // Generate secure OTP
        const otp = commonFunction.getOTP(); // Make sure getOTP uses crypto.randomInt
        const otpExpTime = Date.now() + 3 * 60 * 1000; // 3 minutes from now

        // Optionally send OTP via email
        // await commonFunction.sendMailOtpForgetAndResend(email, otp);

        const updateResult = await userModel.findByIdAndUpdate(
            userResult._id,
            { $set: { otp, otpExpTime, otpVerification: false } },
            { new: true }
        );

        return res.json(new response(updateResult, responseMessage.OTP_SENT));
    } catch (error) {
        console.error("Error during forgotPassword:", error);
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
    const validationSchema = Joi.object({
        password: Joi.string().required(),
        confirmPassword: Joi.string().required(),
    });

    try {
        const { password, confirmPassword } = await validationSchema.validateAsync(req.body);

        if (password !== confirmPassword) {
            throw apiError.badRequest(responseMessage.PASSWORD_NOT_MATCH);
        }

        const userResult = await userModel.findOne({
            _id: req.userId,
            status: { $ne: status.DELETE },
            userType: userType.ADMIN,
        });

        if (!userResult) {
            throw apiError.notFound(responseMessage.USER_NOT_FOUND);
        }

        // Hash password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const updatedUser = await userModel.findByIdAndUpdate(
            userResult._id,
            { password: hashedPassword },
            { new: true }
        );

        return res.json(new response(updatedUser, responseMessage.PASSWORD_RESET_SUCCESS));
    } catch (error) {
        console.error("Error during resetPassword:", error);
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
    const validationSchema = Joi.object({
        email: Joi.string().email().required(),
    });

    try {
        // Normalize email if provided
        if (req.body.email) {
            req.body.email = req.body.email.toLowerCase();
        }

        const validatedBody = await validationSchema.validateAsync(req.body);
        const { email } = validatedBody;

        const userResult = await userModel.findOne({
            email,
            status: { $ne: status.DELETE },
            userType: userType.ADMIN,
        });

        if (!userResult) {
            throw apiError.notFound(responseMessage.USER_NOT_FOUND);
        }

        // Generate secure OTP
        const otp = commonFunction.getOTP(); // ensure this uses crypto.randomInt
        const otpExpTime = Date.now() + 3 * 60 * 1000; // 3 minutes from now

        // Optionally send OTP via email
        // await commonFunction.sendMailOtpForgetAndResend(email, otp);

        const updateResult = await userModel.findByIdAndUpdate(
            userResult._id,
            { otp, otpExpTime, otpVerification: false },
            { new: true }
        );

        return res.json(new response(updateResult, responseMessage.OTP_SEND));
    } catch (error) {
        console.error("Error during resendOTP:", error);
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
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            if (!bcrypt.compareSync(validatedBody.oldPassword, userResult.password)) {
                throw apiError.badRequest(responseMessage.PWD_NOT_MATCH);
            }
            let updated = await userModel.findByIdAndUpdate(
                userResult._id,
                {
                    password: bcrypt.hashSync(validatedBody.newPassword),
                },
                {new: true}
            );
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
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!adminResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            return res.json(new response(adminResult, responseMessage.USER_DETAILS));
        } catch (error) {
            console.log("==================================>", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/viewUser:
     *   get:
     *     tags:
     *       - ADMIN_USER_MANAGEMENT
     *     description: view basic Details of any USER with _id
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         description: token
     *         in: header
     *         required: true
     *       - name: _id
     *         description: _id
     *         in: query
     *         required: false
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async viewUser(req, res, next) {
        const validationSchema = {
            _id: Joi.string().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            let userResult = await findUser({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            var userInfo = await findUser({
                _id: validatedBody._id,
                status: {$ne: status.DELETE},
            });
            console.log("userInfo==>>>>", userInfo);
            if (!userInfo) {
                throw apiError.notFound(responseMessage.DATA_NOT_FOUND);
            }
            return res.json(new response(userInfo, responseMessage.DATA_FOUND));
        } catch (error) {
            console.log("btcBal.balance==>>", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/deleteUser:
     *   delete:
     *     tags:
     *       - ADMIN_USER_MANAGEMENT
     *     description: deleteUser When Admin want to delete Any USER from plateform
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         description: token
     *         in: header
     *         required: true
     *       - name: _id
     *         description: _id
     *         in: query
     *         required: false
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async deleteUser(req, res, next) {
        const validationSchema = {
            _id: Joi.string().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            var {_id} = validatedBody;
            console.log("validatedBody==>>", validatedBody);

            let userResult = await findUser({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            var userInfo = await findUser({
                _id: validatedBody._id,
                userType: userType.USER,
                status: {$ne: status.DELETE},
            });
            if (!userInfo) {
                throw apiError.notFound(responseMessage.DATA_NOT_FOUND);
            }
            let deleteRes = await userModel.findByIdAndUpdate(
                {_id: userInfo._id},
                {$set: {status: status.DELETE}},
                {new: true}
            );
            console.log("deleteRes================>", deleteRes);
            return res.json(new response(deleteRes, responseMessage.DELETE_SUCCESS));
        } catch (error) {
            console.log("error============>>", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/blockUnblockUser:
     *   put:
     *     tags:
     *       - ADMIN_USER_MANAGEMENT
     *     description: blockUnblockUser When ADMIN want to block User or Unblock USER on Plateform
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         description: token
     *         in: header
     *         required: true
     *       - name: _id
     *         description: _id
     *         in: query
     *         required: false
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async blockUnblockUser(req, res, next) {
        const validationSchema = {
            _id: Joi.string().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            let userResult = await findUser({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            var userInfo = await findUser({
                _id: validatedBody._id,
                userType: {$ne: "ADMIN"},
                //status: { $ne: status.DELETE },
            });
            if (!userInfo) {
                throw apiError.notFound(responseMessage.DATA_NOT_FOUND);
            }
            if (userInfo.status == status.ACTIVE) {
                let blockRes = await updateUser({_id: userInfo._id}, {status: status.BLOCK});
                return res.json(new response(blockRes, responseMessage.BLOCK_BY_ADMIN));
            } else {
                let activeRes = await updateUser({_id: userInfo._id}, {status: status.ACTIVE});
                return res.json(new response(activeRes, responseMessage.UNBLOCK_BY_ADMIN));
            }
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/listUser:
     *   get:
     *     tags:
     *       - ADMIN_USER_MANAGEMENT
     *     description: List of all USER on plateform by ADMIN Call this listuser API
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         description: token
     *         in: header
     *         required: true
     *       - name: status1
     *         description: status1
     *         in: query
     *         required: false
     *       - name: search
     *         description: search
     *         in: query
     *         required: false
     *       - name: fromDate
     *         description: fromDate
     *         in: query
     *         required: false
     *       - name: toDate
     *         description: toDate
     *         in: query
     *         required: false
     *       - name: kycStatus
     *         description: kycStatus is PENDING || REJECT ||APPROVE || NOT_APPLIED
     *         in: query
     *         required: false
     *       - name: page
     *         description: page
     *         in: query
     *         type: integer
     *         required: false
     *       - name: limit
     *         description: limit
     *         in: query
     *         type: integer
     *         required: false
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async listUser(req, res, next) {
        const validationSchema = {
            status1: Joi.string().allow("").optional(),
            search: Joi.string().allow("").optional(),
            fromDate: Joi.string().allow("").optional(),
            toDate: Joi.string().allow("").optional(),
            page: Joi.number().allow("").optional(),
            limit: Joi.number().allow("").optional(),
            kycStatus: Joi.string().allow("").optional(),
        };
        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            let userResult = await findUser({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            let dataResults = await paginateSearch(validatedBody);
            if (dataResults.docs.length == 0) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            return res.json(new response(dataResults, responseMessage.DATA_FOUND));
            console.log();
        } catch (error) {
            console.log("error===>>>>", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/deleteProduct:
     *   delete:
     *     tags:
     *       - ADMIN_PRODUCT_MANAGEMENT
     *     description: Admin deletes a product (soft delete by updating status)
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         in: header
     *         required: true
     *         description: Admin's access token
     *       - name: _id
     *         in: query
     *         required: true
     *         description: Product ID to delete
     *     responses:
     *       200:
     *         description: Product deleted successfully
     */
    async deleteProduct(req, res, next) {
        const validationSchema = Joi.object({
            _id: Joi.string().required(),
        });

        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            const {_id} = validatedBody;

            // Validate admin
            const admin = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!admin) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

            // Validate product existence
            const product = await productModel.findOne({
                _id,
                status: {$ne: status.DELETE},
            });
            if (!product) throw apiError.notFound(responseMessage.DATA_NOT_FOUND);

            // Soft delete the product
            const deleted = await productModel.findByIdAndUpdate(_id, {$set: {status: status.DELETE}}, {new: true});

            return res.json(new response(deleted, responseMessage.DELETE_SUCCESS));
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @swagger
     * /admin/blockUnblockProduct:
     *   put:
     *     tags:
     *       - ADMIN_PRODUCT_MANAGEMENT
     *     description: blockUnblockProduct - When Admin wants to block/unblock a product
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         in: header
     *         required: true
     *         description: Admin token
     *       - name: _id
     *         in: query
     *         required: true
     *         description: Product _id to block/unblock
     *     responses:
     *       200:
     *         description: Returns success message
     */
    async blockUnblockProduct(req, res, next) {
        const validationSchema = {
            _id: Joi.string().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.query, validationSchema);
            const {_id} = validatedBody;

            // Validate admin user
            const admin = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!admin) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

            // Find the product
            const product = await productModel.findOne({_id});
            if (!product) throw apiError.notFound(responseMessage.DATA_NOT_FOUND);

            // Toggle productStatus
            const newStatus = product.productStatus === status.ACTIVE ? status.BLOCK : status.ACTIVE;

            const updatedProduct = await productModel.findByIdAndUpdate(
                _id,
                {$set: {productStatus: newStatus}},
                {new: true}
            );

            const message =
                newStatus === status.BLOCK ? "Product blocked successfully" : "Product unblocked successfully";

            return res.json(new response(updatedProduct, message));
        } catch (error) {
            return next(error);
        }
    }
}
export default new adminController();
//work on progress
