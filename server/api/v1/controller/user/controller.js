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
            validatedBody.OTP = commonFunction.getOTP();
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
}
export default new userController();
