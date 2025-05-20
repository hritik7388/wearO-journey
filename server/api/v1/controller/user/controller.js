const Joi = require("joi");
import bcrypt from "bcryptjs";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import responseMessage from "../../../../../assets/responseMessage";
export class userController { 


 
  async signUp(req, res, next) {
        const validationSchema = Joi.object({
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
            password: Joi.string().required(),
            confirmPassword: Joi.string().required(),
            userName: Joi.string().required(),
            mobileNumber: Joi.string().required(),
            email: Joi.string().email().required(),
            dateOfBirth: Joi.string().required(), // string as per schema
            gender: Joi.string().valid("male", "female", "other", "prefer_not_to_say").required(),
            address: Joi.string().required(),
            location: Joi.object({
                type: Joi.string().valid("Point").default("Point"),
                coordinates: Joi.array().items(Joi.number()).length(2).required(),
            }).required(),
            profilePic: Joi.string().optional(),
            coverImage: Joi.string().optional(),
            countryCode: Joi.string().optional(),
            state: Joi.string().optional(),
            streetName: Joi.string().optional(),
            buildingName: Joi.string().optional(),
            city: Joi.string().optional(),
            zipCode: Joi.string().optional(),
            country: Joi.string().optional(),
            deviceToken: Joi.string().optional(),
            deviceType: Joi.string().optional(),
        });
        try {
            var validatedBody = await Joi.validate(req.body, validationSchema);
            const {
                firstName,
                lastName,
                email,
                password,
                confirmPassword,
                userName,
                mobileNumber,
                dateOfBirth,
                gender,
                address,
                location,
                profilePic,
                coverImage,
                countryCode,
                state,
                streetName,
                buildingName,
                city,
                zipCode,
                country,
                deviceToken,
                deviceType,
            } = validatedBody;
            if (password !== confirmPassword) {
                throw apiError.response(responseMessage.PASSWORD_NOT_MATCH);
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
                    await updateUser(
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
                                OTP,
                            },
                            responseMessage.OTP_SEND
                        )
                    );
                }
                throw apiError.conflict(responseMessage.USER_EXISTS);
            }
            const hashPassword = await bcrypt.hash(password, 10);
            validatedBody.OTP = commonFunction.getOTP();
            validatedBody.otpExpTime = new Date().getTime() + 180000; // 3 minutes expiry
            const usersInfo = {
                firstName: validatedBody.firstName,
                lastName: validatedBody.lastName,
                userName: validatedBody.userName,
                email: validatedBody.email,
                mobileNumber: validatedBody.mobileNumber,
                dateOfBirth: validatedBody.dateOfBirth,
                address: validatedBody.address,
                password: hashPassword,
                otp: validatedBody.otp,
                otpExpTime: validatedBody.otpExpTime,
                location: validatedBody.location,
                gender: validatedBody.gender,
                coverImage: validatedBody.coverImage ,
                profilePic: validatedBody.profilePic  ,
                countryCode: validatedBody.countryCode  ,
                state: validatedBody.state  ,
                streetName: validatedBody.streetName  ,
                buildingName: validatedBody.buildingName  ,
                city: validatedBody.city ,
                zipCode: validatedBody.zipCode  ,
                country: validatedBody.country  ,
                deviceToken: validatedBody.deviceToken ,
                deviceType: validatedBody.deviceType  ,
            };

            const newUser = await userModel.create(usersInfo);
            return res.json(new response(newUser, responseMessage.USER_CREATED));
        } catch (error) {
            console.error("Error during sign-up:", error);
            return next(error);
        }
    }
}
export default new userController();
