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

export class userController {
    /**
     * @swagger
     * /user/signUp:
     *   post:
     *     tags:
     *       - USER
     *     description: SignUp with basic details of the user on the platform for registration
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: signUp
     *         description: Sign up request body
     *         in: body
     *         required: true
     *         schema:
     *           type: object
     *           properties:
     *             fullName:
     *               type: string
     *             email:
     *               type: string
     *             password:
     *               type: string
     *             confirmPassword:
     *               type: string
     *             countryCode:
     *               type: string
     *             mobileNumber:
     *               type: string
     *             location:
     *               type: object
     *               required:
     *                 - type
     *                 - coordinates
     *               properties:
     *                 type:
     *                   type: string
     *                   enum: [Point]
     *                   default: Point
     *                 coordinates:
     *                   type: array
     *                   items:
     *                     type: number
     *                   minItems: 2
     *                   maxItems: 2
     *             deviceToken:
     *               type: string
     *             deviceType:
     *               type: string
     *     responses:
     *       200:
     *         description: OTP sent successfully
     */
    async signUp(req, res, next) {
        const validationSchema = Joi.object({
            fullName: Joi.string().required(),
            email: Joi.string().email().required(),
            countryCode: Joi.string().optional(),
            mobileNumber: Joi.string().required(),
            password: Joi.string().required(),
            confirmPassword: Joi.string().required(),
            location: Joi.object({
                type: Joi.string().valid("Point").default("Point"),
                coordinates: Joi.array().items(Joi.number()).length(2).required(),
            }).required(),
            deviceToken: Joi.string().optional(),
            deviceType: Joi.string().optional(),
        });
        try {
            var validatedBody = await Joi.validate(req.body, validationSchema);
            const {
                fullName,
                email,
                password,
                confirmPassword,
                countryCode,
                mobileNumber,
                location,
                deviceToken,
                deviceType,
            } = validatedBody;
            if (password !== confirmPassword) {
                throw apiError.response(responseMessage.PASSWORD_NOT_MATCH);
            }
            // Check if email is already in use by another active USER
            if (validatedBody.email) {
                const checkEmail = await userModel.findOne({
                    email: validatedBody.email,
                    userType: userType.USER,
                    status: {$ne: status.DELETE},
                });
                if (checkEmail) {
                    throw apiError.conflict(responseMessage.EMAIL_ALREADY_IN_USE);
                }
            }

            // Check if mobile number is already in use by another active USER
            if (validatedBody.mobileNumber) {
                const checkMobile = await userModel.findOne({
                    mobileNumber: validatedBody.mobileNumber,
                    userType: userType.USER,
                    status: {$ne: status.DELETE},
                });
                if (checkMobile) {
                    throw apiError.conflict(responseMessage.MOBILE_ALREADY_IN_USE);
                }
            }
            const existingUser = await userModel.findOne({
                email: validatedBody.email,
                userType: userType.USER,
                status: {
                    $ne: status.DELETE,
                },
            });
            if (existingUser) {
                if (!existingUser.OTPVerification) {
                    const hashPassword = await bcrypt.hash(password, 10);
                    const otp = commonFunction.getOTP();
                    const otpExpTime = new Date().getTime() + 180000; // 3 minutes expiry
                    await userModel.findByIdAndUpdate(
                        {
                            _id: existingUser._id,
                        },
                        {
                            otp,
                            otpExpTime,
                        },
                        {
                            upsert: true,
                            new: true,
                        }
                    );
                    return res.json(
                        new response(
                            {
                                otp,
                            },
                            responseMessage.OTP_SENT
                        )
                    );
                }
                throw apiError.conflict(responseMessage.USER_ALREADY_EXISTS);
            }
            const hashPassword = await bcrypt.hash(password, 10);
            validatedBody.otp = commonFunction.getOTP();
            validatedBody.otpExpTime = new Date().getTime() + 180000; // 3 minutes expiry
            const usersInfo = {
                fullName: validatedBody.firstName,
                email: validatedBody.email,
                mobileNumber: validatedBody.mobileNumber,
                password: hashPassword,
                otp: validatedBody.otp,
                otpExpTime: validatedBody.otpExpTime,
                location: validatedBody.location,
                countryCode: validatedBody.countryCode,
                deviceToken: validatedBody.deviceToken,
                deviceType: validatedBody.deviceType,
            };

            const newUser = await userModel.create(usersInfo);
            return res.json(new response(newUser, responseMessage.USER_REGISTERED));
        } catch (error) {
            console.error("Error during sign-up:", error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /user/verifyOtp:
     *   post:
     *     tags:
     *       - USER
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
            const {email, otp,deviceToken,deviceType} = validatedBody;
            const userData = await userModel.findOne({
                email: email,
                userType: userType.USER,
                status: {
                    $ne: status.DELETE,
                },
            });
            console.log("userData==============>>>>>",userData)
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
                status:updateUser.status,
                userType: upadteUser.userType,
                 deviceToken: deviceToken,
                deviceType: deviceType,
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
     * /user/login:
     *   post:
     *     tags:
     *       - USER
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
                userType: userType.USER,
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
                   mobileNumber: userResult.mobileNumber,
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
     * /user/updateUserProfile:
     *   put:
     *     summary: Update admin profile
     *     tags:
     *       - USER
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
    async updateUserProfile(req, res, next) {
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
                userType: userType.USER,
                status: {
                    $ne: status.DELETE,
                },
            });
            if (!userdata) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }
            // Check if email is already in use by another active USER
            if (validatedBody.email) {
                const checkEmail = await userModel.findOne({
                    email: validatedBody.email,
                    userType: userType.USER,
                    status: {$ne: status.DELETE},
                });
                if (checkEmail) {
                    throw apiError.conflict(responseMessage.EMAIL_ALREADY_IN_USE);
                }
            }

            // Check if mobile number is already in use by another active USER
            if (validatedBody.mobileNumber) {
                const checkMobile = await userModel.findOne({
                    mobileNumber: validatedBody.mobileNumber,
                    userType: userType.USER,
                    status: {$ne: status.DELETE},
                });
                if (checkMobile) {
                    throw apiError.conflict(responseMessage.MOBILE_ALREADY_IN_USE);
                }
            }
            if (validatedBody.profilePic) {
                validatedBody.profilePic = validatedBody.profilePic;
                validatedBody.profilePic = await commonFunction.getImageUrl(validatedBody.profilePic);
            }
            if (validatedBody.mobileNumber) {
                const checkMobile = await userModel.findOne({
                    mobileNumber: validatedBody.mobileNumber,
                    _id: {$ne: req.userId},
                    userType: userType.USER,
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
                    userType: userType.USER,
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
     * /user/listAllUser:
     *   get:
     *     tags:
     *       - USER
     *     description: Get all users with optional search by mobile number
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         description: User authentication token
     *         in: header
     *         required: true
     *       - name: search
     *         description: Search by mobile number
     *         in: query
     *         required: false
     *         type: string
     *       - name: page
     *         description: Page number for pagination
     *         in: query
     *         required: false
     *         type: number
     *       - name: limit
     *         description: Number of results per page
     *         in: query
     *         required: false
     *         type: number
     *     responses:
     *       200:
     *         description: Returns the list of users
     */
    async listAllUser(req, res, next) {
        const validationSchema = {
            search: Joi.string().allow("").optional(),

            page: Joi.number().allow("").optional(),
            limit: Joi.number().allow("").optional(),
        };

        try {
            const validatedQuery = await Joi.validate(req.query, validationSchema);
            let userResult = await userModel.find({
                _id: req.userId,
                status: {$ne: status.DELETE},
            });

            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            let dataResults;

            if (validatedQuery.search) {
                dataResults = await userModel.find({mobileNumber: validatedQuery.search});
                if (!dataResults) {
                    throw apiError.notFound(responseMessage.USER_NOT_FOUND);
                }
            } else {
                dataResults = await paginateSearchAllUser(validatedQuery);
                if (dataResults.docs.length === 0) {
                    throw apiError.notFound(responseMessage.USER_NOT_FOUND);
                }
            }

            return res.json(new response(dataResults, responseMessage.USER_LIST));
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @swagger
     * /user/forgotPassword:
     *   post:
     *     tags:
     *       - USER
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
            const {email} = validatedBody;
            var userResult = await userModel.findOne({
                email: email,
                status: {$ne: status.DELETE},
                userType: userType.USER,
            });
            if (!userResult) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            } else {
                var otp = commonFunction.getOTP();
                var newOtp = otp;
                var time = Date.now() + 180000;
                //  await commonFunction.sendMailOtpForgetAndResend(email, otp);
                var updateResult = await userModel.findByIdAndUpdate(
                    {_id: userResult._id},
                    {$set: {otp: newOtp, otpExpTime: time, otpVerification: false}},
                    {new: true}
                );
                return res.json(new response(updateResult, responseMessage.OTP_SENT));
            }
        } catch (error) {
            console.log(error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /user/resetPassword:
     *   post:
     *     tags:
     *       - USER
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
            const {password, confirmPassword} = await Joi.validate(req.body, validationSchema);
            const userdata = await userModel.findOne({
                _id: req.userId,
                userType: userType.USER,
                status: {
                    $ne: status.DELETE,
                },
            });
            if (!userdata) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }else {
                if (password == confirmPassword) {
                    let update = await userModel.findByIdAndUpdate(
                        {_id: userdata._id},
                        {password: bcrypt.hashSync(password)},
                        {new: true}
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
     * /user/resendOTP:
     *   post:
     *     tags:
     *       - USER
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
     *               description: User's email address
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
            const {email} = validatedBody;
            var userResult = await userModel.findOne({
                email: validatedBody.email,
                status: {$ne: status.DELETE},
                userType: userType.USER,
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
                {_id: userResult._id},
                {otp: otp, otpTime: otpTime},
                {new: true}
            );
            return res.json(new response(updateResult, responseMessage.OTP_SEND));
        } catch (error) {
            console.log(error);
            return next(error);
        }
    }

    /**
     * @swagger
     * /user/changePassword:
     *   patch:
     *     tags:
     *       - USER
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
                userType: userType.USER,
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
     * /user/userProfile:
     *   get:
     *     tags:
     *       - USER
     *     description: get his own profile details with userProfile API
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
    async userProfile(req, res, next) {
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
                userType: userType.USER,
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
                userType: userType.USER,
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
}
export default new userController();
